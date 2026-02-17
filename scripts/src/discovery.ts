import * as fs from 'fs';
import * as path from 'path';
import { DiscoveredFile } from './types';
import { DATA_DIR, TARGET_CATEGORIES } from './config';

/**
 * Recursively finds all JSON files in a directory.
 * Excludes _folders.json files (Foundry metadata).
 */
function findJsonFiles(dir: string): string[] {
  const results: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.json') &&
      entry.name !== '_folders.json'
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Discovers all target JSON files in the data directory,
 * organized by content category.
 */
export function discoverFiles(
  dataDir: string = DATA_DIR,
  categories: Record<string, string> = TARGET_CATEGORIES,
): DiscoveredFile[] {
  const files: DiscoveredFile[] = [];
  const summary: Record<string, number> = {};

  for (const [dirName, categoryLabel] of Object.entries(categories)) {
    const categoryDir = path.join(dataDir, dirName);

    if (!fs.existsSync(categoryDir)) {
      console.warn(`  Warning: directory not found, skipping: ${dirName}/`);
      continue;
    }

    const jsonFiles = findJsonFiles(categoryDir);
    summary[categoryLabel] = jsonFiles.length;

    for (const filePath of jsonFiles) {
      files.push({ filePath, category: categoryLabel });
    }
  }

  console.log('\nDiscovery summary:');
  let total = 0;
  for (const [cat, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count} files`);
    total += count;
  }
  console.log(`  TOTAL: ${total} files\n`);

  return files;
}
