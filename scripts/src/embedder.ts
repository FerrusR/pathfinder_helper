import { AzureOpenAI } from 'openai';
import { RuleChunkInput, RuleChunkWithEmbedding } from './types';
import { EMBEDDING_BATCH_SIZE, EMBEDDING_DELAY_MS, EMBEDDING_DIMENSIONS } from './config';

let client: AzureOpenAI | null = null;
let deploymentName: string = '';

/** Initialize the Azure OpenAI client from environment variables */
function getClient(): AzureOpenAI {
  if (client) return client;

  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  deploymentName = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME || 'text-embedding-3-small';

  if (!apiKey || !endpoint) {
    throw new Error(
      'Missing Azure OpenAI configuration. Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables.',
    );
  }

  client = new AzureOpenAI({
    apiKey,
    endpoint,
    apiVersion: '2024-06-01',
  });

  return client;
}

/** Sleep for a given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate embeddings for a single batch of texts.
 * Includes retry logic with exponential backoff.
 */
async function embedBatch(texts: string[], maxRetries = 3): Promise<number[][]> {
  const openai = getClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: deploymentName,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      // Sort by index to ensure correct ordering
      const sorted = response.data.sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check for rate limit (429) or server errors (5xx)
      const status = (err as { status?: number }).status;
      const isRetryable = status === 429 || (status !== undefined && status >= 500);

      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
      console.warn(
        `  Embedding request failed (${status}), retrying in ${backoffMs}ms... (attempt ${attempt + 1}/${maxRetries})`,
      );
      await sleep(backoffMs);
    }
  }

  throw lastError || new Error('Embedding failed after retries');
}

/**
 * Generate embeddings for all chunks in batches.
 * Returns the chunks with their embedding vectors attached.
 */
export async function generateEmbeddings(
  chunks: RuleChunkInput[],
  batchSize: number = EMBEDDING_BATCH_SIZE,
  delayMs: number = EMBEDDING_DELAY_MS,
): Promise<RuleChunkWithEmbedding[]> {
  const totalBatches = Math.ceil(chunks.length / batchSize);
  const results: RuleChunkWithEmbedding[] = [];

  console.log(
    `Generating embeddings for ${chunks.length} chunks in ${totalBatches} batches (batch size: ${batchSize})...`,
  );

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((chunk) => chunk.content);

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`);

    const embeddings = await embedBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      results.push({
        ...batch[j],
        embedding: embeddings[j],
      });
    }

    console.log(' done');

    // Rate limiting delay between batches (skip after last batch)
    if (i + batchSize < chunks.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log(`Embedding generation complete. ${results.length} chunks embedded.\n`);
  return results;
}

/**
 * Generate embedding for a single text query.
 * Used by the test-retrieval script.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0];
}
