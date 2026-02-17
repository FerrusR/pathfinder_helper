/**
 * Data Analysis Script for Pathfinder 2e Foundry VTT Data
 *
 * Dry-run tool that scans all target data files and reports statistics
 * without touching the database or generating embeddings.
 *
 * Usage:
 *   npm run analyze
 *   npm run analyze -- --categories spells,feats
 */

import * as path from 'path';
import { config } from 'dotenv';
import { discoverFiles } from './src/discovery';
import { parseFile } from './src/parser';
import { chunkDocument } from './src/chunker';
import { CategoryStats, NotationStats } from './src/types';
import { DATA_DIR, TARGET_CATEGORIES } from './src/config';

config({ path: path.join(__dirname, '..', 'apps', 'backend', '.env') });

function parseArgs(): { categories?: string[] } {
  const args = process.argv.slice(2);
  const result: { categories?: string[] } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--categories' && args[i + 1]) {
      result.categories = args[i + 1].split(',').map((c) => c.trim());
      i++;
    }
  }

  return result;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

async function main() {
  console.log('=== Pathfinder 2e Data Analysis ===\n');

  const args = parseArgs();

  // Filter categories if specified
  let categories = TARGET_CATEGORIES;
  if (args.categories) {
    categories = {};
    for (const [dir, label] of Object.entries(TARGET_CATEGORIES)) {
      if (args.categories.includes(dir) || args.categories.includes(label)) {
        categories[dir] = label;
      }
    }
    console.log(`Filtering to categories: ${Object.values(categories).join(', ')}\n`);
  }

  // Step 1: Discover files
  console.log('--- File Discovery ---');
  const files = discoverFiles(DATA_DIR, categories);

  // Step 2: Parse and chunk all files, collecting stats
  console.log('--- Parsing & Chunking ---\n');

  const categoryStats = new Map<string, CategoryStats>();
  const globalNotation: NotationStats = {
    uuidRefs: 0,
    damageRefs: 0,
    checkRefs: 0,
    embedRefs: 0,
    localizeRefs: 0,
  };
  const allSources = new Set<string>();
  const allTraits = new Set<string>();
  let totalFiles = 0;
  let totalParsed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalChunks = 0;
  let totalContentLength = 0;
  const allChunkLengths: number[] = [];

  for (const file of files) {
    totalFiles++;
    const { category } = file;

    if (!categoryStats.has(category)) {
      categoryStats.set(category, {
        category,
        fileCount: 0,
        parsedCount: 0,
        skippedCount: 0,
        chunkCount: 0,
        contentLengths: [],
        skipReasons: {},
        errors: [],
      });
    }
    const stats = categoryStats.get(category)!;
    stats.fileCount++;

    const result = parseFile(file.filePath, category);

    // Accumulate notation stats
    globalNotation.uuidRefs += result.notationStats.uuidRefs;
    globalNotation.damageRefs += result.notationStats.damageRefs;
    globalNotation.checkRefs += result.notationStats.checkRefs;
    globalNotation.embedRefs += result.notationStats.embedRefs;
    globalNotation.localizeRefs += result.notationStats.localizeRefs;

    if (result.error) {
      totalErrors++;
      stats.errors.push(`${file.filePath}: ${result.error}`);
      continue;
    }

    if (result.skipped) {
      totalSkipped++;
      stats.skippedCount++;
      const reason = result.skipReason || 'unknown';
      stats.skipReasons[reason] = (stats.skipReasons[reason] || 0) + 1;
      continue;
    }

    for (const doc of result.documents) {
      totalParsed++;
      stats.parsedCount++;
      stats.contentLengths.push(doc.content.length);
      totalContentLength += doc.content.length;

      // Collect unique sources and traits
      if (doc.source) allSources.add(doc.source);
      const traits = doc.metadata.traits as string[] | undefined;
      if (traits) {
        for (const t of traits) allTraits.add(t);
      }

      // Chunk the document
      const chunks = chunkDocument(doc);
      stats.chunkCount += chunks.length;
      totalChunks += chunks.length;

      for (const chunk of chunks) {
        allChunkLengths.push(chunk.content.length);
      }
    }
  }

  // Step 3: Report results
  console.log('=== RESULTS ===\n');

  // Per-category summary
  console.log('--- Per-Category Summary ---\n');
  console.log(
    `${'Category'.padEnd(22)} ${'Files'.padStart(7)} ${'Parsed'.padStart(7)} ${'Skipped'.padStart(8)} ${'Errors'.padStart(7)} ${'Chunks'.padStart(7)} ${'Avg Len'.padStart(8)}`,
  );
  console.log('-'.repeat(75));

  const sortedCategories = [...categoryStats.entries()].sort((a, b) => b[1].fileCount - a[1].fileCount);

  for (const [, stats] of sortedCategories) {
    const avgLen =
      stats.contentLengths.length > 0
        ? Math.round(stats.contentLengths.reduce((a, b) => a + b, 0) / stats.contentLengths.length)
        : 0;

    console.log(
      `${stats.category.padEnd(22)} ${formatNumber(stats.fileCount).padStart(7)} ${formatNumber(stats.parsedCount).padStart(7)} ${formatNumber(stats.skippedCount).padStart(8)} ${formatNumber(stats.errors.length).padStart(7)} ${formatNumber(stats.chunkCount).padStart(7)} ${formatNumber(avgLen).padStart(8)}`,
    );
  }
  console.log('-'.repeat(75));
  console.log(
    `${'TOTAL'.padEnd(22)} ${formatNumber(totalFiles).padStart(7)} ${formatNumber(totalParsed).padStart(7)} ${formatNumber(totalSkipped).padStart(8)} ${formatNumber(totalErrors).padStart(7)} ${formatNumber(totalChunks).padStart(7)} ${totalParsed > 0 ? formatNumber(Math.round(totalContentLength / totalParsed)).padStart(8) : '0'.padStart(8)}`,
  );

  // Content length distribution
  console.log('\n--- Content Length Distribution (parsed documents) ---\n');
  for (const [, stats] of sortedCategories) {
    if (stats.contentLengths.length === 0) continue;
    const sorted = [...stats.contentLengths].sort((a, b) => a - b);
    console.log(
      `${stats.category.padEnd(22)} min=${formatNumber(sorted[0]).padStart(6)}  median=${formatNumber(percentile(sorted, 50)).padStart(6)}  p95=${formatNumber(percentile(sorted, 95)).padStart(6)}  max=${formatNumber(sorted[sorted.length - 1]).padStart(6)}`,
    );
  }

  // Chunk length distribution
  console.log('\n--- Chunk Length Distribution ---\n');
  if (allChunkLengths.length > 0) {
    const sorted = [...allChunkLengths].sort((a, b) => a - b);
    console.log(`Total chunks: ${formatNumber(totalChunks)}`);
    console.log(`Min: ${formatNumber(sorted[0])} chars`);
    console.log(`Median: ${formatNumber(percentile(sorted, 50))} chars`);
    console.log(`P95: ${formatNumber(percentile(sorted, 95))} chars`);
    console.log(`Max: ${formatNumber(sorted[sorted.length - 1])} chars`);
    console.log(
      `Estimated tokens: ~${formatNumber(Math.round(sorted.reduce((a, b) => a + b, 0) / 4))} (at ~4 chars/token)`,
    );

    const singleChunkDocs = sortedCategories.reduce(
      (sum, [, s]) => sum + s.parsedCount,
      0,
    );
    const multiChunkDocs = totalChunks - singleChunkDocs;
    console.log(`\nSingle-chunk documents: ${formatNumber(singleChunkDocs - multiChunkDocs)}`);
    console.log(`Multi-chunk documents (produced extra chunks): ${formatNumber(multiChunkDocs)}`);
  }

  // Skip reasons
  console.log('\n--- Skip Reasons ---\n');
  const allReasons: Record<string, number> = {};
  for (const [, stats] of categoryStats) {
    for (const [reason, count] of Object.entries(stats.skipReasons)) {
      allReasons[reason] = (allReasons[reason] || 0) + count;
    }
  }
  for (const [reason, count] of Object.entries(allReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${formatNumber(count)}`);
  }

  // Foundry notation stats
  console.log('\n--- Foundry Notation Frequency ---\n');
  console.log(`  @UUID references:     ${formatNumber(globalNotation.uuidRefs)}`);
  console.log(`  @Damage references:   ${formatNumber(globalNotation.damageRefs)}`);
  console.log(`  @Check references:    ${formatNumber(globalNotation.checkRefs)}`);
  console.log(`  @Embed references:    ${formatNumber(globalNotation.embedRefs)}`);
  console.log(`  @Localize references: ${formatNumber(globalNotation.localizeRefs)}`);

  // Sources
  console.log(`\n--- Unique Publication Sources (${allSources.size}) ---\n`);
  const sortedSources = [...allSources].sort();
  for (const source of sortedSources.slice(0, 30)) {
    console.log(`  ${source}`);
  }
  if (sortedSources.length > 30) {
    console.log(`  ... and ${sortedSources.length - 30} more`);
  }

  // Traits (top 30)
  console.log(`\n--- Unique Traits (${allTraits.size} total, showing top values) ---\n`);
  const sortedTraits = [...allTraits].sort();
  for (const trait of sortedTraits.slice(0, 30)) {
    console.log(`  ${trait}`);
  }
  if (sortedTraits.length > 30) {
    console.log(`  ... and ${sortedTraits.length - 30} more`);
  }

  // Errors
  if (totalErrors > 0) {
    console.log(`\n--- Parse Errors (${totalErrors}) ---\n`);
    for (const [, stats] of categoryStats) {
      for (const error of stats.errors.slice(0, 10)) {
        console.log(`  ${error}`);
      }
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors in ${stats.category}`);
      }
    }
  }

  // Embedding cost estimate
  const totalChars = allChunkLengths.reduce((a, b) => a + b, 0);
  const estimatedTokens = Math.round(totalChars / 4);
  const estimatedCost = (estimatedTokens / 1_000_000) * 0.02;
  console.log('\n--- Embedding Cost Estimate ---\n');
  console.log(`  Total content: ${formatNumber(totalChars)} chars`);
  console.log(`  Estimated tokens: ~${formatNumber(estimatedTokens)}`);
  console.log(`  Estimated cost (text-embedding-3-small): ~$${estimatedCost.toFixed(3)}`);

  console.log('\n=== Analysis Complete ===');
}

main().catch((err) => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
