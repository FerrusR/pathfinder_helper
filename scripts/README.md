# Scripts

This directory contains utility scripts for the Pathfinder Helper project.

## Available Scripts

### ingest-rules.ts
Data ingestion script that loads Pathfinder 2e rules into the database with vector embeddings.

**Usage:**
```bash
npm run ingest -- --source /path/to/pf2e-srd-markdown
```

**Implementation:** Phase 1 of the roadmap

### test-retrieval.ts
Test script for evaluating the quality of vector search retrieval.

**Usage:**
```bash
npm run test-retrieval -- --query "How does flanking work?"
```

**Implementation:** Phase 2 of the roadmap

## Development

Install dependencies:
```bash
npm install
```

Run a script:
```bash
npm run <script-name>
```
