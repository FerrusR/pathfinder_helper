import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RuleChunkResult {
  id: string;
  title: string;
  category: string;
  source: string;
  content: string;
  similarity: number;
}

@Injectable()
export class VectorSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchRuleChunks(
    embedding: number[],
    topK = 8,
    similarityThreshold = 0.3,
  ): Promise<RuleChunkResult[]> {
    const vectorLiteral = `[${embedding.join(',')}]`;

    const results = await this.prisma.$queryRawUnsafe<RuleChunkResult[]>(
      `
      SELECT id, title, category, source, content,
             1 - (embedding <=> $1::vector) AS similarity
      FROM rule_chunks
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
      `,
      vectorLiteral,
      similarityThreshold,
      topK,
    );

    return results;
  }
}
