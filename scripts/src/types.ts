/** A discovered JSON file with its category */
export interface DiscoveredFile {
  filePath: string;
  category: string;
}

/** A parsed game object extracted from a Foundry VTT JSON file */
export interface ParsedDocument {
  sourceId: string;
  sourceFile: string;
  name: string;
  type: string;
  category: string;
  source: string;
  content: string;
  metadata: Record<string, unknown>;
}

/** A chunk ready to be embedded and stored */
export interface RuleChunkInput {
  title: string;
  category: string;
  source: string;
  content: string;
  sourceId: string;
  sourceFile: string;
  metadata: Record<string, unknown>;
}

/** A chunk with its computed embedding vector */
export interface RuleChunkWithEmbedding extends RuleChunkInput {
  embedding: number[];
}

/** Statistics collected during data analysis */
export interface CategoryStats {
  category: string;
  fileCount: number;
  parsedCount: number;
  skippedCount: number;
  chunkCount: number;
  contentLengths: number[];
  skipReasons: Record<string, number>;
  errors: string[];
}

/** Foundry notation patterns found during analysis */
export interface NotationStats {
  uuidRefs: number;
  damageRefs: number;
  checkRefs: number;
  embedRefs: number;
  localizeRefs: number;
}
