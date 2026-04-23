import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignRole, UserRole } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user.type';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(user: RequestUser) {
    if (user.role === UserRole.ADMIN) {
      return this.prisma.campaign.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.campaign.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            userId: user.id,
            deletedAt: null,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, user: RequestUser) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, deletedAt: null },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (user.role !== UserRole.ADMIN) {
      const member = await this.prisma.campaignMember.findFirst({
        where: { campaignId: id, userId: user.id, deletedAt: null },
      });
      if (!member) {
        throw new ForbiddenException('You are not a member of this campaign');
      }
    }

    return campaign;
  }

  async create(dto: CreateCampaignDto, user: RequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          name: dto.name,
          description: dto.description,
          createdBy: user.id,
        },
      });

      await tx.campaignMember.create({
        data: {
          campaignId: campaign.id,
          userId: user.id,
          role: CampaignRole.GAMEMASTER,
        },
      });

      return campaign;
    });
  }

  async update(id: string, dto: UpdateCampaignDto, user: RequestUser) {
    await this.assertGmOrAdmin(id, user);

    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async softDelete(id: string, user: RequestUser) {
    await this.assertGmOrAdmin(id, user);

    return this.prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async listMembers(campaignId: string) {
    return this.prisma.campaignMember.findMany({
      where: { campaignId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async addMember(campaignId: string, dto: AddMemberDto) {
    const existing = await this.prisma.campaignMember.findFirst({
      where: { campaignId, userId: dto.userId },
    });

    if (existing) {
      if (existing.deletedAt === null) {
        throw new ConflictException('User is already an active member of this campaign');
      }
      // Restore soft-deleted membership
      return this.prisma.campaignMember.update({
        where: { id: existing.id },
        data: { role: dto.role, deletedAt: null },
        include: { user: { select: { id: true, email: true, displayName: true } } },
      });
    }

    return this.prisma.campaignMember.create({
      data: { campaignId, userId: dto.userId, role: dto.role },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });
  }

  async updateMemberRole(campaignId: string, userId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.campaignMember.findFirst({
      where: { campaignId, userId, deletedAt: null },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === CampaignRole.GAMEMASTER && dto.role !== CampaignRole.GAMEMASTER) {
      await this.assertNotLastGamemaster(campaignId, member.id);
    }

    return this.prisma.campaignMember.update({
      where: { id: member.id },
      data: { role: dto.role },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    });
  }

  async removeMember(campaignId: string, userId: string) {
    const member = await this.prisma.campaignMember.findFirst({
      where: { campaignId, userId, deletedAt: null },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === CampaignRole.GAMEMASTER) {
      await this.assertNotLastGamemaster(campaignId, member.id);
    }

    return this.prisma.campaignMember.update({
      where: { id: member.id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertNotLastGamemaster(campaignId: string, excludeMemberId: string) {
    const gmCount = await this.prisma.campaignMember.count({
      where: {
        campaignId,
        role: CampaignRole.GAMEMASTER,
        deletedAt: null,
        id: { not: excludeMemberId },
      },
    });
    if (gmCount === 0) {
      throw new BadRequestException('Cannot remove the last Gamemaster from a campaign');
    }
  }

  private async assertGmOrAdmin(campaignId: string, user: RequestUser) {
    if (user.role === UserRole.ADMIN) return;

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, deletedAt: null },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const member = await this.prisma.campaignMember.findFirst({
      where: { campaignId, userId: user.id, deletedAt: null },
    });
    if (!member || member.role !== CampaignRole.GAMEMASTER) {
      throw new ForbiddenException('Only the campaign Gamemaster can perform this action');
    }
  }
}
