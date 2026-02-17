Phase 1: Data Ingestion Pipeline — Implementation Plan
Context
Phase 1 builds the data ingestion pipeline that reads Pathfinder 2e rules from Foundry VTT JSON files (data/pf2e/), converts them to clean text, generates vector embeddings, and stores them in PostgreSQL with pgvector. This is the foundation for the RAG chatbot in Phase 2.

Key change from original roadmap: We're using Foundry VTT PF2e JSON instead of Obsidian SRD Markdown. The Obsidian repo was outdated and derived from Foundry data anyway. This means the parser handles JSON + HTML (not markdown + YAML frontmatter).

Scope: Core rules only — spells, feats, actions, conditions, classes, ancestries, heritages, backgrounds, class-features, ancestry-features, equipment, deities, journals, hazards, familiar-abilities, bestiary-ability-glossary-srd. Creatures/NPCs deferred to a later phase.

Target: Local PostgreSQL with pgvector (via Docker) for development.

Data Structure Summary
~16,000 JSON files across 16 content categories
Each file = one game object (spell, feat, etc.) except journals (multi-page)
Primary text field: system.description.value (HTML with Foundry-specific notation)
Journals use: pages[].text.content (HTML)
Foundry notation: @UUID[...]{text}, @Damage[...], @Check[...], @Embed[...], @Localize[...]
File Structure

scripts/
├── ingest-rules.ts          # Main orchestrator (replace placeholder)
├── analyze-data.ts           # Data analysis / dry-run tool
├── test-retrieval.ts         # Retrieval quality testing (replace placeholder)
├── src/
│   ├── types.ts              # Shared interfaces
│   ├── config.ts             # Paths, categories, parameters
│   ├── discovery.ts          # Find and categorize JSON files
│   ├── parser.ts             # Extract content + metadata from JSON
│   ├── html-processor.ts     # HTML → clean text, Foundry notation handling
│   ├── chunker.ts            # Split large content into chunks
│   ├── embedder.ts           # Azure OpenAI embedding generation
│   └── db-writer.ts          # PostgreSQL writer (raw SQL + pgvector)
├── package.json
└── tsconfig.json
Steps
Step 1: Local PostgreSQL with pgvector via Docker Compose
Create: docker-compose.yml (project root)
Modify: apps/backend/.env.example

Docker Compose with pgvector/pgvector:pg16 image
Port 5432, DB name pathfinder_helper, user/pass postgres
Named volume for persistence
Update .env.example with local connection string
Step 2: Prisma Schema — Add pgvector and Tracking Fields
Modify: apps/backend/prisma/schema.prisma
Create: New migration via prisma migrate dev --create-only, then hand-edit SQL

Changes to RuleChunk model:

Add embedding field using Unsupported("vector(1536)")?
Add sourceId (String?) — Foundry _id for deduplication
Add sourceFile (String?) — file path for traceability
Migration SQL must include:

CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE rule_chunks ADD COLUMN embedding vector(1536);
ALTER TABLE rule_chunks ADD COLUMN source_id TEXT;
ALTER TABLE rule_chunks ADD COLUMN source_file TEXT;
CREATE INDEX rule_chunks_embedding_idx ON rule_chunks USING hnsw (embedding vector_cosine_ops);
Step 3: Install Script Dependencies
Modify: scripts/package.json

Add dependencies:

pg + @types/pg — PostgreSQL driver
html-to-text + @types/html-to-text — HTML conversion
openai — Azure OpenAI SDK for embeddings
Add script entries: "analyze": "ts-node analyze-data.ts"

Step 4: Define Types and Configuration
Create: scripts/src/types.ts, scripts/src/config.ts

Types:

ParsedDocument — parsed game object (sourceId, name, type, category, source, content, metadata)
RuleChunkInput — chunk ready for embedding (title, category, source, content, sourceId, sourceFile, metadata)
RuleChunkWithEmbedding — chunk + embedding vector
Config:

DATA_DIR path, TARGET_CATEGORIES mapping (directory name → category label)
Embedding parameters (model, dimensions, batch size)
Chunk size thresholds
Step 5: Implement File Discovery Module
Create: scripts/src/discovery.ts

Recursively scan target category directories
Find all .json files, exclude _folders.json
Return { filePath, category }[] organized by category
Log summary counts
Step 6: Implement HTML Processor Module
Create: scripts/src/html-processor.ts

Handle Foundry notation (process BEFORE HTML-to-text conversion):

@UUID[...]{Display Text} → extract display text
@Damage[1d6[fire]] → "1d6 fire damage"
@Check[type:athletics|dc:25] → "Athletics check (DC 25)"
@Embed[...] → strip or replace with placeholder
@Localize[...] → strip (flag files that are entirely @Localize)
Action glyph spans → "[one-action]", "[two-actions]", "[reaction]", "[free-action]"
Then convert remaining HTML to plain text via html-to-text:

Preserve heading structure, lists, tables
Strip styles and classes
Proper paragraph spacing
Step 7: Implement JSON Parser Module
Create: scripts/src/parser.ts

Two parsing paths:

Standard objects (most categories):

Extract name, type, system.description.value (→ HTML processor), system.publication.title
Extract type-specific metadata (level, traits, rarity, prerequisites, etc.)
Journal entries (7 files, up to 1.5MB):

Iterate pages[], each page becomes a separate ParsedDocument
Content from page.text.content
Hazards (special structure):

Combine system.details.description + system.details.disable + system.details.routine
Filtering:

Skip empty descriptions and @Localize-only entries
Skip content under 20 chars after processing
Log skipped files with reasons
Step 8: Implement Content Chunking Module
Create: scripts/src/chunker.ts

Strategy:

< ~6000 chars: Single chunk (most spells, feats, conditions, actions, equipment)
6000–12000 chars: Split at heading boundaries, add title prefix to each chunk
> 12000 chars: Split at h2/h3 boundaries (journal pages primarily), include heading chain in chunk title
~200 char overlap between chunks for context continuity
All chunks inherit parent document's metadata
Step 9: Implement Data Analysis Script
Create: scripts/analyze-data.ts

Dry-run tool using discovery + parser + chunker (no DB, no embeddings):

File count per category
Content length distribution (min/max/median/p95)
Skipped file count and reasons
Single vs multi-chunk count
Foundry notation frequency
Unique publication sources and trait values
Parsing error report
Run this before proceeding to embedding/DB steps to validate assumptions.

Step 10: Implement Embedding Generation Module
Create: scripts/src/embedder.ts

Connect to Azure OpenAI using env vars (AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME)
Batch embedding: send chunks in batches of 100
Rate limiting: configurable delay between batches
Retry with exponential backoff for 429/5xx errors
Progress logging
Estimated cost: ~16K chunks x ~500 tokens avg = ~8M tokens = ~$0.16 total.

Step 11: Implement Database Writer Module
Create: scripts/src/db-writer.ts

Use pg package directly (not Prisma — Prisma can't natively handle pgvector inserts)
Connect via DATABASE_URL env var
Batch inserts (50-100 rows per INSERT) with pgvector literal format '[0.1, 0.2, ...]'
clearChunks() — truncate table for re-ingestion
getChunkCount() — verification helper
UUID generation via crypto.randomUUID()
Step 12: Implement Main Ingestion Orchestrator
Modify: scripts/ingest-rules.ts (replace placeholder)

Pipeline: discover → parse → chunk → embed → store

CLI flags:

--source <path> — data directory (default: data/pf2e/)
--categories <list> — comma-separated filter
--clear — truncate before ingesting
--dry-run — parse + chunk only, no embed/write
--skip-embedding — write to DB without embeddings
Error handling: try/catch per file, continue on individual errors, report summary.
Progress: log counts, elapsed time, estimated cost.

Step 13: Implement Test Retrieval Script
Modify: scripts/test-retrieval.ts (replace placeholder)

Accept --query "text", --top-k N, --category filter
Embed query via Azure OpenAI
Vector similarity search via embedding <=> query_vector
Display: rank, title, category, source, similarity score, content preview
Include 10-15 preset test queries for quick validation
Step 14: Update Documentation
Modify: TECH_STACK_AND_ROADMAP.md

Update data source section (Foundry VTT JSON replaces Obsidian SRD)
Update Phase 1 checklist items
Update rule_chunks schema example
Step 15: End-to-End Testing and Quality Tuning
Execute in order:

docker-compose up -d
npm run backend:prisma:migrate
npm run --workspace scripts analyze → review output, fix issues
npm run --workspace scripts ingest -- --clear
Run test-retrieval with preset queries
Evaluate: relevance, chunk sizes, text quality, missing rules
Tune parameters if needed
Implementation Order

Session A (foundation):     Steps 1, 2, 3, 4
Session B (parsing):        Steps 5, 6, 7, 8
Session C (analysis):       Step 9, run analysis, fix issues
Session D (DB pipeline):    Steps 10, 11, 12
Session E (verification):   Steps 13, 14, 15
Verification
After Step 9: Run analyze-data.ts and verify file counts, content extraction, chunk sizes are reasonable
After Step 12: Run full ingestion against local PostgreSQL, verify chunk count matches expectations (~16K-20K)
After Step 13: Run test queries and confirm relevant results appear in top-5 with high similarity scores
Final: Run all 10-15 preset queries, ensure no major rule categories are missing