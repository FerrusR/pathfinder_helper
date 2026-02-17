import { Pool } from 'pg';
import { RuleChunkWithEmbedding } from './types';
import { DB_BATCH_SIZE } from './config';

let pool: Pool | null = null;

/** Get or create the PostgreSQL connection pool */
function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL environment variable.');
  }

  pool = new Pool({ connectionString });
  return pool;
}

/**
 * Format a number array as a pgvector literal string.
 * e.g. [0.1, 0.2, 0.3] → '[0.1,0.2,0.3]'
 */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Insert a batch of chunks with embeddings into the rule_chunks table.
 * Uses parameterized queries to avoid SQL injection.
 */
async function insertBatch(chunks: RuleChunkWithEmbedding[]): Promise<void> {
  const db = getPool();

  // Build a multi-row INSERT with parameterized values
  const values: unknown[] = [];
  const rows: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const offset = i * 8;
    rows.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::vector, $${offset + 7}, $${offset + 8}::jsonb)`,
    );
    values.push(
      crypto.randomUUID(),
      chunk.title,
      chunk.category,
      chunk.source,
      chunk.content,
      toVectorLiteral(chunk.embedding),
      chunk.sourceId,
      JSON.stringify(chunk.metadata),
    );
  }

  const sql = `
    INSERT INTO rule_chunks (id, title, category, source, content, embedding, source_id, metadata)
    VALUES ${rows.join(', ')}
  `;

  await db.query(sql, values);
}

/**
 * Insert a batch of chunks WITHOUT embeddings (for --skip-embedding mode).
 */
async function insertBatchNoEmbedding(chunks: RuleChunkWithEmbedding[]): Promise<void> {
  const db = getPool();

  const values: unknown[] = [];
  const rows: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const offset = i * 7;
    rows.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}::jsonb)`,
    );
    values.push(
      crypto.randomUUID(),
      chunk.title,
      chunk.category,
      chunk.source,
      chunk.content,
      chunk.sourceId,
      JSON.stringify(chunk.metadata),
    );
  }

  const sql = `
    INSERT INTO rule_chunks (id, title, category, source, content, source_id, metadata)
    VALUES ${rows.join(', ')}
  `;

  await db.query(sql, values);
}

/**
 * Write all chunks to the database in batches.
 */
export async function writeChunks(
  chunks: RuleChunkWithEmbedding[],
  batchSize: number = DB_BATCH_SIZE,
  hasEmbeddings: boolean = true,
): Promise<void> {
  const totalBatches = Math.ceil(chunks.length / batchSize);
  console.log(`Writing ${chunks.length} chunks to database in ${totalBatches} batches...`);

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = chunks.slice(i, i + batchSize);

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`);

    if (hasEmbeddings) {
      await insertBatch(batch);
    } else {
      await insertBatchNoEmbedding(batch);
    }

    console.log(' done');
  }

  console.log(`Database write complete. ${chunks.length} chunks stored.\n`);
}

/**
 * Delete all existing rule chunks from the database.
 */
export async function clearChunks(): Promise<void> {
  const db = getPool();
  const result = await db.query('DELETE FROM rule_chunks');
  console.log(`Cleared ${result.rowCount} existing chunks from rule_chunks table.\n`);
}

/**
 * Get the current number of chunks in the database.
 */
export async function getChunkCount(): Promise<number> {
  const db = getPool();
  const result = await db.query('SELECT COUNT(*) as count FROM rule_chunks');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Execute a vector similarity search against the rule_chunks table.
 */
export async function searchChunks(
  queryEmbedding: number[],
  topK: number = 5,
  categoryFilter?: string,
): Promise<
  Array<{
    id: string;
    title: string;
    category: string;
    source: string;
    content: string;
    similarity: number;
  }>
> {
  const db = getPool();
  const vectorLiteral = toVectorLiteral(queryEmbedding);

  let sql: string;
  let params: unknown[];

  if (categoryFilter) {
    sql = `
      SELECT id, title, category, source, content,
             1 - (embedding <=> $1::vector) as similarity
      FROM rule_chunks
      WHERE category = $2
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;
    params = [vectorLiteral, categoryFilter, topK];
  } else {
    sql = `
      SELECT id, title, category, source, content,
             1 - (embedding <=> $1::vector) as similarity
      FROM rule_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;
    params = [vectorLiteral, topK];
  }

  const result = await db.query(sql, params);
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    source: row.source || '',
    content: row.content,
    similarity: parseFloat(row.similarity),
  }));
}

/**
 * Close the database connection pool.
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
