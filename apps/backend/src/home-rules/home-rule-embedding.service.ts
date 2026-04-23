import { Injectable } from '@nestjs/common';
import { HomeRule } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../common/services/embedding.service';

@Injectable()
export class HomeRuleEmbeddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async embedAndStore(rule: HomeRule): Promise<void> {
    const vector = await this.embedding.embed(rule.content);
    const vectorLiteral = `[${vector.join(',')}]`;
    const metadata = JSON.stringify({ overridesRuleId: rule.overridesRuleId ?? null });
    const id = crypto.randomUUID();

    await this.prisma.$transaction(async (tx) => {
      // Remove any existing chunk for this rule before inserting
      await tx.homeRuleChunk.deleteMany({ where: { homeRuleId: rule.id } });

      await tx.$executeRawUnsafe(
        `INSERT INTO home_rule_chunks
           (id, home_rule_id, campaign_id, title, category, content, embedding, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb, NOW())`,
        id,
        rule.id,
        rule.campaignId ?? null,
        rule.title,
        rule.category ?? null,
        rule.content,
        vectorLiteral,
        metadata,
      );
    });
  }

  async removeChunksForRule(homeRuleId: string): Promise<void> {
    await this.prisma.homeRuleChunk.deleteMany({ where: { homeRuleId } });
  }
}
