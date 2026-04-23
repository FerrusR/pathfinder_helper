import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignRole,
  HomeRule,
  HomeRuleStatus,
  UserRole,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user.type';
import { HomeRuleEmbeddingService } from './home-rule-embedding.service';
import { CreateHomeRuleDto } from './dto/create-home-rule.dto';
import { UpdateHomeRuleDto } from './dto/update-home-rule.dto';

@Injectable()
export class HomeRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: HomeRuleEmbeddingService,
  ) {}

  async listForCampaign(campaignId: string, status?: HomeRuleStatus) {
    return this.prisma.homeRule.findMany({
      where: {
        campaignId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listGeneric(status?: HomeRuleStatus) {
    return this.prisma.homeRule.findMany({
      where: {
        campaignId: null,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<HomeRule> {
    const rule = await this.prisma.homeRule.findFirst({
      where: { id, deletedAt: null },
    });
    if (!rule) {
      throw new NotFoundException('Home rule not found');
    }
    return rule;
  }

  async createForCampaign(
    campaignId: string,
    dto: CreateHomeRuleDto,
    user: RequestUser,
    defaultStatus: HomeRuleStatus,
  ) {
    return this.prisma.homeRule.create({
      data: {
        campaignId,
        title: dto.title,
        content: dto.content,
        category: dto.category,
        overridesRuleId: dto.overridesRuleId,
        status: defaultStatus,
        proposedBy: user.id,
      },
    });
  }

  async createGeneric(dto: CreateHomeRuleDto, user: RequestUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can create generic home rules');
    }
    return this.prisma.homeRule.create({
      data: {
        campaignId: null,
        title: dto.title,
        content: dto.content,
        category: dto.category,
        overridesRuleId: dto.overridesRuleId,
        status: HomeRuleStatus.APPROVED,
        proposedBy: user.id,
      },
    });
  }

  async update(id: string, dto: UpdateHomeRuleDto, user: RequestUser) {
    const rule = await this.findById(id);
    await this.assertCanEdit(rule, user);

    const wasApproved = rule.status === HomeRuleStatus.APPROVED;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (wasApproved) {
        await tx.homeRuleChunk.deleteMany({ where: { homeRuleId: id } });
      }

      return tx.homeRule.update({
        where: { id },
        data: {
          title: dto.title ?? rule.title,
          content: dto.content ?? rule.content,
          category: dto.category !== undefined ? dto.category : rule.category,
          overridesRuleId:
            dto.overridesRuleId !== undefined ? dto.overridesRuleId : rule.overridesRuleId,
          ...(wasApproved ? { status: HomeRuleStatus.PROPOSED, approvedBy: null } : {}),
        },
      });
    });

    return updated;
  }

  async approve(id: string, user: RequestUser) {
    const rule = await this.findById(id);
    await this.assertCanApproveOrReject(rule, user);

    const approved = await this.prisma.homeRule.update({
      where: { id },
      data: {
        status: HomeRuleStatus.APPROVED,
        approvedBy: user.id,
      },
    });

    await this.embeddingService.embedAndStore(approved);

    return approved;
  }

  async reject(id: string, user: RequestUser) {
    const rule = await this.findById(id);
    await this.assertCanApproveOrReject(rule, user);

    return this.prisma.homeRule.update({
      where: { id },
      data: { status: HomeRuleStatus.REJECTED },
    });
  }

  async softDelete(id: string, user: RequestUser) {
    const rule = await this.findById(id);
    await this.assertCanEdit(rule, user);

    await this.prisma.$transaction(async (tx) => {
      await tx.homeRuleChunk.deleteMany({ where: { homeRuleId: id } });
      await tx.homeRule.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  // ── Permission helpers ───────────────────────────────────────────────────

  private async assertCanEdit(rule: HomeRule, user: RequestUser) {
    if (user.role === UserRole.ADMIN) return;

    // Campaign rule: GM of the campaign can always edit
    if (rule.campaignId) {
      const member = await this.prisma.campaignMember.findFirst({
        where: { campaignId: rule.campaignId, userId: user.id, deletedAt: null },
      });
      if (member?.role === CampaignRole.GAMEMASTER) return;
    }

    // Author can edit their own DRAFT or PROPOSED rules
    if (
      rule.proposedBy === user.id &&
      (rule.status === HomeRuleStatus.DRAFT || rule.status === HomeRuleStatus.PROPOSED)
    ) {
      return;
    }

    throw new ForbiddenException('You do not have permission to edit this home rule');
  }

  private async assertCanApproveOrReject(rule: HomeRule, user: RequestUser) {
    if (user.role === UserRole.ADMIN) return;

    if (rule.campaignId) {
      const member = await this.prisma.campaignMember.findFirst({
        where: { campaignId: rule.campaignId, userId: user.id, deletedAt: null },
      });
      if (member?.role === CampaignRole.GAMEMASTER) return;
    }

    throw new ForbiddenException('You do not have permission to approve or reject this home rule');
  }
}
