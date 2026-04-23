import { Injectable } from '@nestjs/common';
import { HomeRule } from '../../generated/prisma';

@Injectable()
export class HomeRuleEmbeddingService {
  // Implemented in step 7 — embed-on-approval pipeline
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async embedAndStore(_rule: HomeRule): Promise<void> {}

  async removeChunksForRule(_homeRuleId: string): Promise<void> {}
}
