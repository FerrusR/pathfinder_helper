/**
 * Data Ingestion Script for Pathfinder 2e Rules
 *
 * Reads Foundry VTT PF2e JSON files, extracts rule text,
 * generates embeddings via Azure OpenAI, and stores in PostgreSQL with pgvector.
 *
 * Usage:
 *   npm run ingest                          # Full ingestion
 *   npm run ingest -- --dry-run             # Parse & chunk only, no DB/embeddings
 *   npm run ingest -- --skip-embedding      # Write to DB without embeddings
 *   npm run ingest -- --clear               # Clear existing chunks before ingesting
 *   npm run ingest -- --categories spells,feats
 *   npm run ingest -- --source ./data/pf2e
 */

import * as path from 'path';
import { config } from 'dotenv';
import { discoverFiles } from './src/discovery';
import { parseFile } from './src/parser';
import { chunkDocument } from './src/chunker';
import { generateEmbeddings } from './src/embedder';
import { writeChunks, clearChunks, getChunkCount, closeDb } from './src/db-writer';
import { RuleChunkInput, RuleChunkWithEmbedding } from './src/types';
import { DATA_DIR, TARGET_CATEGORIES } from './src/config';

config({ path: path.join(__dirname, '..', 'apps', 'backend', '.env') });

interface CliArgs {
  source: string;
  categories?: string[];
  clear: boolean;
  dryRun: boolean;
  skipEmbedding: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    source: DATA_DIR,
    clear: false,
    dryRun: false,
    skipEmbedding: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
        result.source = args[++i];
        break;
      case '--categories':
        result.categories = args[++i].split(',').map((c) => c.trim());
        break;
      case '--clear':
        result.clear = true;
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--skip-embedding':
        result.skipEmbedding = true;
        break;
    }
  }

  return result;
}

async function main() {
  const startTime = Date.now();
  const args = parseArgs();

  console.log('=== Pathfinder 2e Rules Ingestion ===\n');
  console.log(`  Source: ${args.source}`);
  console.log(`  Mode: ${args.dryRun ? 'DRY RUN' : args.skipEmbedding ? 'SKIP EMBEDDING' : 'FULL'}`);
  console.log(`  Clear existing: ${args.clear}`);
  console.log('');

  // Filter categories if specified
  let categories = TARGET_CATEGORIES;
  if (args.categories) {
    categories = {};
    for (const [dir, label] of Object.entries(TARGET_CATEGORIES)) {
      if (args.categories.includes(dir) || args.categories.includes(label)) {
        categories[dir] = label;
      }
    }
    console.log(`  Categories: ${Object.values(categories).join(', ')}\n`);
  }

  // Step 1: Discover files
  console.log('--- Step 1: File Discovery ---');
  const files = discoverFiles(args.source, categories);

  if (files.length === 0) {
    console.log('No files found. Check your --source path and --categories filter.');
    return;
  }

  // Step 2: Parse all files
  console.log('--- Step 2: Parsing Files ---\n');
  const allChunks: RuleChunkInput[] = [];
  let parsedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const chunksByCategory: Record<string, number> = {};

  for (const file of files) {
    const result = parseFile(file.filePath, file.category);

    if (result.error) {
      errorCount++;
      console.error(`  ERROR: ${file.filePath}: ${result.error}`);
      continue;
    }

    if (result.skipped) {
      skippedCount++;
      continue;
    }

    for (const doc of result.documents) {
      parsedCount++;
      const chunks = chunkDocument(doc);
      for (const chunk of chunks) {
        allChunks.push(chunk);
        chunksByCategory[chunk.category] = (chunksByCategory[chunk.category] || 0) + 1;
      }
    }
  }

  console.log(`  Parsed: ${parsedCount} documents`);
  console.log(`  Skipped: ${skippedCount} files`);
  console.log(`  Errors: ${errorCount} files`);
  console.log(`  Total chunks: ${allChunks.length}`);
  console.log('');

  // Show chunks per category
  console.log('  Chunks per category:');
  for (const [cat, count] of Object.entries(chunksByCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }
  console.log('');

  if (args.dryRun) {
    const totalChars = allChunks.reduce((sum, c) => sum + c.content.length, 0);
    const estimatedTokens = Math.round(totalChars / 4);
    const estimatedCost = (estimatedTokens / 1_000_000) * 0.02;

    console.log('--- DRY RUN Complete ---\n');
    console.log(`  Total content: ${totalChars.toLocaleString()} chars`);
    console.log(`  Estimated tokens: ~${estimatedTokens.toLocaleString()}`);
    console.log(`  Estimated embedding cost: ~$${estimatedCost.toFixed(3)}`);
    console.log(`  Elapsed: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    return;
  }

  // Step 3: Clear existing chunks if requested
  if (args.clear) {
    console.log('--- Step 3: Clearing Existing Chunks ---\n');
    await clearChunks();
  }

  // Step 4: Generate embeddings (unless skipped)
  let chunksWithEmbeddings: RuleChunkWithEmbedding[];

  if (args.skipEmbedding) {
    console.log('--- Step 4: Skipping Embedding Generation ---\n');
    chunksWithEmbeddings = allChunks.map((chunk) => ({
      ...chunk,
      embedding: [],
    }));
  } else {
    console.log('--- Step 4: Generating Embeddings ---\n');
    chunksWithEmbeddings = await generateEmbeddings(allChunks);
  }

  // Step 5: Write to database
  console.log('--- Step 5: Writing to Database ---\n');
  await writeChunks(chunksWithEmbeddings, undefined, !args.skipEmbedding);

  // Verify
  const finalCount = await getChunkCount();
  console.log(`Database now contains ${finalCount} total chunks.\n`);

  await closeDb();

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('=== Ingestion Complete ===\n');
  console.log(`  Documents parsed: ${parsedCount}`);
  console.log(`  Chunks created: ${allChunks.length}`);
  console.log(`  Chunks in database: ${finalCount}`);
  console.log(`  Elapsed: ${elapsed}s`);
}

main().catch(async (err) => {
  console.error('\nIngestion failed:', err);
  await closeDb();
  process.exit(1);
});
