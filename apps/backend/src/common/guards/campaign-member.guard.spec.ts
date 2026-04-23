import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CampaignRole, UserRole } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CampaignMemberGuard } from './campaign-member.guard';
import { CAMPAIGN_ROLE_KEY } from '../decorators/campaign-role.decorator';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContext(
  userId: string,
  userRole: UserRole,
  params: Record<string, string> = { id: 'campaign-1' },
): ExecutionContext {
  return {
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        user: { id: userId, role: userRole },
        params,
        campaignMember: undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

const gmMember = {
  id: 'member-1',
  userId: 'user-1',
  campaignId: 'campaign-1',
  role: CampaignRole.GAMEMASTER,
  joinedAt: new Date(),
  deletedAt: null,
};

const playerMember = { ...gmMember, id: 'member-2', role: CampaignRole.PLAYER };

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CampaignMemberGuard', () => {
  let guard: CampaignMemberGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let campaignMemberFindFirst: jest.Mock;

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    campaignMemberFindFirst = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignMemberGuard,
        { provide: Reflector, useValue: reflector },
        {
          provide: PrismaService,
          useValue: { campaignMember: { findFirst: campaignMemberFindFirst } },
        },
      ],
    }).compile();

    guard = module.get<CampaignMemberGuard>(CampaignMemberGuard);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Admin bypass ─────────────────────────────────────────────────────────

  it('allows admin without querying the database', async () => {
    const ctx = makeContext('admin-1', UserRole.ADMIN);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(campaignMemberFindFirst).not.toHaveBeenCalled();
  });

  // ── Non-member ───────────────────────────────────────────────────────────

  it('throws ForbiddenException when user is not a member', async () => {
    campaignMemberFindFirst.mockResolvedValue(null);
    const ctx = makeContext('user-1', UserRole.PLAYER);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ── campaignId from params ───────────────────────────────────────────────

  it('reads campaignId param when :id is not present', async () => {
    campaignMemberFindFirst.mockResolvedValue(playerMember);
    const ctx = makeContext('user-1', UserRole.PLAYER, { campaignId: 'campaign-1' });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(campaignMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ campaignId: 'campaign-1' }) }),
    );
  });

  // ── RequireCampaignRole ──────────────────────────────────────────────────

  it('throws ForbiddenException when member role does not satisfy @RequireCampaignRole', async () => {
    campaignMemberFindFirst.mockResolvedValue(playerMember);
    reflector.getAllAndOverride.mockReturnValue([CampaignRole.GAMEMASTER]);
    const ctx = makeContext('user-1', UserRole.PLAYER);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(CAMPAIGN_ROLE_KEY, expect.any(Array));
  });

  it('allows access when member role satisfies @RequireCampaignRole', async () => {
    campaignMemberFindFirst.mockResolvedValue(gmMember);
    reflector.getAllAndOverride.mockReturnValue([CampaignRole.GAMEMASTER]);
    const ctx = makeContext('user-1', UserRole.PLAYER);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('allows access when no @RequireCampaignRole metadata is set (membership is sufficient)', async () => {
    campaignMemberFindFirst.mockResolvedValue(playerMember);
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeContext('user-1', UserRole.PLAYER);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ── Missing campaignId ───────────────────────────────────────────────────

  it('throws NotFoundException when no campaignId can be found in params', async () => {
    const ctx = makeContext('user-1', UserRole.PLAYER, {});

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
});
