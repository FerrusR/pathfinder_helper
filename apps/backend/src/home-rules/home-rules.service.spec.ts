import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CampaignRole, HomeRule, HomeRuleStatus, UserRole } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user.type';
import { HomeRuleEmbeddingService } from './home-rule-embedding.service';
import { HomeRulesService } from './home-rules.service';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    displayName: null,
    role: UserRole.PLAYER,
    ...overrides,
  };
}

const adminUser = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
const gmUser = makeUser({ id: 'gm-1' });
const playerUser = makeUser({ id: 'player-1' });

function makeRule(overrides: Partial<HomeRule> = {}): HomeRule {
  return {
    id: 'rule-1',
    campaignId: 'campaign-1',
    title: 'Test Rule',
    content: 'Rule content',
    category: 'combat',
    overridesRuleId: null,
    status: HomeRuleStatus.PROPOSED,
    proposedBy: playerUser.id,
    approvedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

// ── Prisma mock ────────────────────────────────────────────────────────────

const mockHomeRuleFindFirst = jest.fn();
const mockHomeRuleFindMany = jest.fn();
const mockHomeRuleCreate = jest.fn();
const mockHomeRuleUpdate = jest.fn();
const mockCampaignMemberFindFirst = jest.fn();

const prismaMock = {
  homeRule: {
    findFirst: mockHomeRuleFindFirst,
    findMany: mockHomeRuleFindMany,
    create: mockHomeRuleCreate,
    update: mockHomeRuleUpdate,
  },
  campaignMember: {
    findFirst: mockCampaignMemberFindFirst,
  },
};

// ── Embedding service mock ─────────────────────────────────────────────────

const mockEmbedAndStore = jest.fn().mockResolvedValue(undefined);
const mockRemoveChunksForRule = jest.fn().mockResolvedValue(undefined);

const embeddingMock = {
  embedAndStore: mockEmbedAndStore,
  removeChunksForRule: mockRemoveChunksForRule,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('HomeRulesService', () => {
  let service: HomeRulesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeRulesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HomeRuleEmbeddingService, useValue: embeddingMock },
      ],
    }).compile();

    service = module.get<HomeRulesService>(HomeRulesService);
  });

  // ── createForCampaign ────────────────────────────────────────────────────

  describe('createForCampaign', () => {
    it('creates with PROPOSED status when called with PROPOSED defaultStatus', async () => {
      const created = makeRule({ status: HomeRuleStatus.PROPOSED });
      mockHomeRuleCreate.mockResolvedValue(created);

      const result = await service.createForCampaign(
        'campaign-1',
        { title: 'Test Rule', content: 'Content' },
        playerUser,
        HomeRuleStatus.PROPOSED,
      );

      expect(mockHomeRuleCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: HomeRuleStatus.PROPOSED }) }),
      );
      expect(result.status).toBe(HomeRuleStatus.PROPOSED);
    });

    it('creates with APPROVED status when called with APPROVED defaultStatus', async () => {
      const created = makeRule({ status: HomeRuleStatus.APPROVED, proposedBy: gmUser.id });
      mockHomeRuleCreate.mockResolvedValue(created);

      const result = await service.createForCampaign(
        'campaign-1',
        { title: 'GM Rule', content: 'Content' },
        gmUser,
        HomeRuleStatus.APPROVED,
      );

      expect(mockHomeRuleCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: HomeRuleStatus.APPROVED }) }),
      );
      expect(result.status).toBe(HomeRuleStatus.APPROVED);
    });
  });

  // ── createGeneric ────────────────────────────────────────────────────────

  describe('createGeneric', () => {
    it('allows admin to create a generic rule with APPROVED status', async () => {
      const created = makeRule({ campaignId: null, status: HomeRuleStatus.APPROVED });
      mockHomeRuleCreate.mockResolvedValue(created);

      await service.createGeneric({ title: 'Generic', content: 'Content' }, adminUser);

      expect(mockHomeRuleCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            campaignId: null,
            status: HomeRuleStatus.APPROVED,
          }),
        }),
      );
    });

    it('rejects non-admin callers', async () => {
      await expect(
        service.createGeneric({ title: 'Generic', content: 'Content' }, playerUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockHomeRuleCreate).not.toHaveBeenCalled();
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('editing an APPROVED rule reverts to PROPOSED and calls removeChunksForRule', async () => {
      const approvedRule = makeRule({
        status: HomeRuleStatus.APPROVED,
        proposedBy: gmUser.id,
        campaignId: 'campaign-1',
      });
      mockHomeRuleFindFirst.mockResolvedValue(approvedRule);
      // GM member check inside assertCanEdit
      mockCampaignMemberFindFirst.mockResolvedValue({
        id: 'member-1',
        userId: gmUser.id,
        campaignId: 'campaign-1',
        role: CampaignRole.GAMEMASTER,
        deletedAt: null,
      });
      const updated = makeRule({ status: HomeRuleStatus.PROPOSED, approvedBy: null });
      mockHomeRuleUpdate.mockResolvedValue(updated);

      const result = await service.update('rule-1', { content: 'New content' }, gmUser);

      expect(mockRemoveChunksForRule).toHaveBeenCalledWith('rule-1');
      expect(mockHomeRuleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: HomeRuleStatus.PROPOSED,
            approvedBy: null,
          }),
        }),
      );
      expect(result.status).toBe(HomeRuleStatus.PROPOSED);
    });

    it('does NOT call removeChunksForRule when rule is not APPROVED', async () => {
      const proposedRule = makeRule({ status: HomeRuleStatus.PROPOSED, proposedBy: playerUser.id });
      mockHomeRuleFindFirst.mockResolvedValue(proposedRule);
      mockHomeRuleUpdate.mockResolvedValue(proposedRule);

      await service.update('rule-1', { title: 'New title' }, playerUser);

      expect(mockRemoveChunksForRule).not.toHaveBeenCalled();
    });
  });

  // ── approve ──────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('sets status to APPROVED, sets approvedBy, and calls embedAndStore', async () => {
      const proposedRule = makeRule({ status: HomeRuleStatus.PROPOSED });
      mockHomeRuleFindFirst.mockResolvedValue(proposedRule);
      mockCampaignMemberFindFirst.mockResolvedValue({
        id: 'member-1',
        userId: gmUser.id,
        campaignId: 'campaign-1',
        role: CampaignRole.GAMEMASTER,
        deletedAt: null,
      });
      const approvedRule = makeRule({ status: HomeRuleStatus.APPROVED, approvedBy: gmUser.id });
      mockHomeRuleUpdate.mockResolvedValue(approvedRule);

      await service.approve('rule-1', gmUser);

      expect(mockHomeRuleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: HomeRuleStatus.APPROVED,
            approvedBy: gmUser.id,
          }),
        }),
      );
      expect(mockEmbedAndStore).toHaveBeenCalledWith(approvedRule);
    });
  });

  // ── reject ───────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('sets status to REJECTED and does NOT call embedAndStore', async () => {
      const proposedRule = makeRule({ status: HomeRuleStatus.PROPOSED });
      mockHomeRuleFindFirst.mockResolvedValue(proposedRule);
      mockCampaignMemberFindFirst.mockResolvedValue({
        id: 'member-1',
        userId: gmUser.id,
        campaignId: 'campaign-1',
        role: CampaignRole.GAMEMASTER,
        deletedAt: null,
      });
      mockHomeRuleUpdate.mockResolvedValue(makeRule({ status: HomeRuleStatus.REJECTED }));

      await service.reject('rule-1', gmUser);

      expect(mockHomeRuleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: HomeRuleStatus.REJECTED } }),
      );
      expect(mockEmbedAndStore).not.toHaveBeenCalled();
    });
  });

  // ── soft-deleted rules are not returned ──────────────────────────────────

  describe('soft-deleted rules are not returned', () => {
    it('listForCampaign filters by deletedAt: null', async () => {
      mockHomeRuleFindMany.mockResolvedValue([]);
      await service.listForCampaign('campaign-1');
      expect(mockHomeRuleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });

    it('findById throws NotFoundException for a soft-deleted rule', async () => {
      mockHomeRuleFindFirst.mockResolvedValue(null);
      await expect(service.findById('deleted-rule')).rejects.toThrow(NotFoundException);
    });
  });
});
