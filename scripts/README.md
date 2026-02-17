# Scripts

Data ingestion and utility scripts for loading Pathfinder 2e rules (from Foundry VTT PF2e JSON) into PostgreSQL with pgvector embeddings.

## Prerequisites

- Node.js 22 LTS
- PostgreSQL with pgvector extension running (via Docker Compose)
- Foundry VTT PF2e data in `data/pf2e/` (gitignored)
- Backend `.env` file configured with database and Azure OpenAI credentials

Install dependencies:
```bash
npm install
```

## Available Scripts

### analyze-data.ts

Dry-run analysis tool that scans Foundry VTT data files and reports statistics without touching the database or generating embeddings. Useful for validating data before running a full ingestion.

Reports per-category file/chunk counts, content length distributions, Foundry notation frequency (`@UUID`, `@Damage`, `@Check`, `@Embed`, `@Localize`), unique sources/traits, and estimated embedding cost.

**Usage:**
```bash
npm run analyze
npm run analyze -- --categories spells,feats
```

**Options:**
| Flag | Description |
|------|-------------|
| `--categories <list>` | Comma-separated list of categories to analyze (default: all 16) |

### ingest-rules.ts

Full ingestion pipeline that reads Foundry VTT PF2e JSON files, extracts rule text, converts Foundry-specific notation to clean text, chunks content, generates embeddings via Azure OpenAI, and stores everything in PostgreSQL with pgvector.

**Usage:**
```bash
npm run ingest                              # Full ingestion
npm run ingest -- --dry-run                 # Parse & chunk only, no DB/embeddings
npm run ingest -- --skip-embedding          # Write to DB without embeddings
npm run ingest -- --clear                   # Clear existing chunks before ingesting
npm run ingest -- --categories spells,feats # Ingest specific categories only
npm run ingest -- --source ./data/pf2e      # Override data source path
```

**Options:**
| Flag | Description |
|------|-------------|
| `--source <path>` | Path to the Foundry VTT data directory (default: `data/pf2e/`) |
| `--categories <list>` | Comma-separated list of categories to ingest |
| `--clear` | Clear all existing rule chunks before ingesting |
| `--dry-run` | Parse and chunk files without writing to DB or generating embeddings |
| `--skip-embedding` | Write chunks to DB with empty embeddings (useful for testing) |

### test-retrieval.ts

Tests vector search quality against ingested rule chunks. Requires a completed ingestion with embeddings.

**Usage:**
```bash
npm run test-retrieval -- --query "How does flanking work?"
npm run test-retrieval -- --query "fireball spell" --top-k 10
npm run test-retrieval -- --query "blinded condition" --category condition
npm run test-retrieval -- --preset          # Run all 15 preset test queries
```

**Options:**
| Flag | Description |
|------|-------------|
| `--query <text>` | The search query to test |
| `--top-k <n>` | Number of results to return (default: 5) |
| `--category <name>` | Filter results to a specific category |
| `--preset` | Run a built-in set of 15 representative PF2e questions |

## Supported Categories

The ingestion pipeline processes 16 content categories from the Foundry VTT data:

spell, feat, action, condition, class, ancestry, heritage, background, class-feature, ancestry-feature, equipment, deity, journal, hazard, familiar-ability, bestiary-ability

## Internal Modules

Source code in `src/` is shared across the scripts:

| Module | Purpose |
|--------|---------|
| `config.ts` | Paths, category mappings, embedding/chunking constants |
| `discovery.ts` | Scans `data/pf2e/` directories and discovers JSON files |
| `parser.ts` | Parses Foundry VTT JSON, extracts content and metadata |
| `html-processor.ts` | Converts HTML + Foundry notation (`@UUID`, `@Damage`, etc.) to clean text |
| `chunker.ts` | Splits documents into chunks (single chunk or heading-based splits) |
| `embedder.ts` | Generates embeddings via Azure OpenAI (text-embedding-3-small, 1536 dims) |
| `db-writer.ts` | Writes chunks + embeddings to PostgreSQL via raw SQL |
| `types.ts` | Shared TypeScript interfaces |
