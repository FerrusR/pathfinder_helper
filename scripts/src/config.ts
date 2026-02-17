import * as path from 'path';

/** Root directory of the project */
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** Path to the Foundry VTT PF2e data */
export const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'pf2e');

/**
 * Target content categories to ingest.
 * Maps directory name in data/pf2e/ to the category label used in rule_chunks.
 */
export const TARGET_CATEGORIES: Record<string, string> = {
  'spells': 'spell',
  'feats': 'feat',
  'actions': 'action',
  'conditions': 'condition',
  'classes': 'class',
  'ancestries': 'ancestry',
  'heritages': 'heritage',
  'backgrounds': 'background',
  'class-features': 'class-feature',
  'ancestry-features': 'ancestry-feature',
  'equipment': 'equipment',
  'deities': 'deity',
  'journals': 'journal',
  'hazards': 'hazard',
  'familiar-abilities': 'familiar-ability',
  'bestiary-ability-glossary-srd': 'bestiary-ability',
};

/** Embedding model configuration */
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_BATCH_SIZE = 100;
export const EMBEDDING_DELAY_MS = 200;

/** Chunking thresholds (in characters of plain text) */
export const MAX_CHUNK_CHARS = 6000;
export const LARGE_CHUNK_CHARS = 12000;
export const CHUNK_OVERLAP_CHARS = 200;
export const MIN_CONTENT_CHARS = 20;

/** Database batch insert size */
export const DB_BATCH_SIZE = 50;
