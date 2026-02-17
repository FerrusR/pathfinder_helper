-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to rule_chunks
ALTER TABLE "rule_chunks" ADD COLUMN "embedding" vector(1536);

-- Add source tracking columns to rule_chunks
ALTER TABLE "rule_chunks" ADD COLUMN "source_id" TEXT;
ALTER TABLE "rule_chunks" ADD COLUMN "source_file" TEXT;

-- Add embedding column to home_rule_chunks
ALTER TABLE "home_rule_chunks" ADD COLUMN "embedding" vector(1536);

-- Create HNSW index for vector similarity search on rule_chunks
CREATE INDEX "rule_chunks_embedding_idx" ON "rule_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- Create HNSW index for vector similarity search on home_rule_chunks
CREATE INDEX "home_rule_chunks_embedding_idx" ON "home_rule_chunks" USING hnsw ("embedding" vector_cosine_ops);
