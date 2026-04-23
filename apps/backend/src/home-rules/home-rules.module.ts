import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HomeRuleEmbeddingService } from './home-rule-embedding.service';
import { CampaignHomeRulesController, HomeRulesController } from './home-rules.controller';
import { HomeRulesService } from './home-rules.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [CampaignHomeRulesController, HomeRulesController],
  providers: [HomeRulesService, HomeRuleEmbeddingService],
  exports: [HomeRulesService, HomeRuleEmbeddingService],
})
export class HomeRulesModule {}
