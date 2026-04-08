import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CampaignRole, UserRole } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../types/request-user.type';
import { CAMPAIGN_ROLE_KEY } from '../decorators/campaign-role.decorator';

interface GuardRequest {
  user: RequestUser;
  params: Record<string, string>;
  campaignMember?: unknown;
}

@Injectable()
export class CampaignMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardRequest>();
    const user = request.user;

    // Admin bypass — global admins can access any campaign
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const campaignId = request.params['campaignId'] ?? request.params['id'];

    if (!campaignId) {
      throw new NotFoundException('Campaign not found');
    }

    const member = await this.prisma.campaignMember.findFirst({
      where: {
        userId: user.id,
        campaignId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this campaign');
    }

    const requiredRoles = this.reflector.getAllAndOverride<CampaignRole[]>(
      CAMPAIGN_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(member.role)) {
        throw new ForbiddenException('Insufficient campaign role');
      }
    }

    request.campaignMember = member;

    return true;
  }
}
