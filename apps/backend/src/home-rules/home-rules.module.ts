import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HomeRuleEmbeddingService } from './home-rule-embedding.service';
import { CampaignHomeRulesController, HomeRulesController } from './home-rules.controller';
import { HomeRulesService } from './home-rules.service';

@Module({
  imports: [PrismaModule],
  controllers: [CampaignHomeRulesController, HomeRulesController],
  providers: [HomeRulesService, HomeRuleEmbeddingService],
  exports: [HomeRulesService, HomeRuleEmbeddingService],
})
export class HomeRulesModule {}
