/**
 * Test Retrieval Script
 *
 * Tests vector search quality against the ingested rule chunks.
 *
 * Usage:
 *   npm run test-retrieval -- --query "How does flanking work?"
 *   npm run test-retrieval -- --query "fireball spell" --top-k 10
 *   npm run test-retrieval -- --query "blinded condition" --category condition
 *   npm run test-retrieval -- --preset          # Run all preset test queries
 */

import * as path from 'path';
import { config } from 'dotenv';
import { embedQuery } from './src/embedder';
import { searchChunks, getChunkCount, closeDb } from './src/db-writer';

config({ path: path.join(__dirname, '..', 'apps', 'backend', '.env') });

const PRESET_QUERIES = [
  'How does flanking work?',
  'What does the blinded condition do?',
  'What are the alchemist class abilities?',
  'How do I Aid another player?',
  'What is the fireball spell?',
  'What feats does a human get?',
  'How does the dying condition work?',
  'What is the acolyte background?',
  'How much HP does a barbarian get?',
  'What are the domains of Abadar?',
  'How does the Grab an Edge reaction work?',
  'What does the frightened condition do?',
  'What is a versatile heritage?',
  'How does persistent damage work?',
  'What equipment can a rogue use?',
];

interface CliArgs {
  query?: string;
  topK: number;
  category?: string;
  preset: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { topK: 5, preset: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--query':
        result.query = args[++i];
        break;
      case '--top-k':
        result.topK = parseInt(args[++i], 10);
        break;
      case '--category':
        result.category = args[++i];
        break;
      case '--preset':
        result.preset = true;
        break;
    }
  }

  return result;
}

async function runQuery(query: string, topK: number, category?: string): Promise<void> {
  console.log(`\nQuery: "${query}"${category ? ` (category: ${category})` : ''}`);
  console.log('-'.repeat(70));

  const embedding = await embedQuery(query);
  const results = await searchChunks(embedding, topK, category);

  if (results.length === 0) {
    console.log('  No results found.');
    return;
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const preview = r.content.replace(/\n/g, ' ').slice(0, 150);
    console.log(`  ${i + 1}. [${r.similarity.toFixed(4)}] ${r.title}`);
    console.log(`     Category: ${r.category} | Source: ${r.source || 'N/A'}`);
    console.log(`     ${preview}...`);
    console.log('');
  }
}

async function main() {
  const args = parseArgs();

  console.log('=== Pathfinder 2e Retrieval Test ===\n');

  const count = await getChunkCount();
  console.log(`Database contains ${count} chunks.`);

  if (count === 0) {
    console.log('No chunks found. Run the ingestion script first.');
    await closeDb();
    return;
  }

  if (args.preset) {
    console.log(`\nRunning ${PRESET_QUERIES.length} preset queries (top-${args.topK} each)...\n`);
    for (const query of PRESET_QUERIES) {
      await runQuery(query, args.topK, args.category);
    }
  } else if (args.query) {
    await runQuery(args.query, args.topK, args.category);
  } else {
    console.log('\nUsage:');
    console.log('  npm run test-retrieval -- --query "How does flanking work?"');
    console.log('  npm run test-retrieval -- --preset');
    console.log('  npm run test-retrieval -- --query "fireball" --top-k 10 --category spell');
  }

  await closeDb();
  console.log('\n=== Test Complete ===');
}

main().catch(async (err) => {
  console.error('\nRetrieval test failed:', err);
  await closeDb();
  process.exit(1);
});
