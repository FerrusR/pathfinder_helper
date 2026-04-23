import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CampaignRole, UserRole } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/types/request-user.type';
import { CampaignsService } from './campaigns.service';

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
const playerUser = makeUser({ id: 'player-1', role: UserRole.PLAYER });
const gmUser = makeUser({ id: 'gm-1', role: UserRole.PLAYER });

const mockCampaign = {
  id: 'campaign-1',
  name: 'Test Campaign',
  description: null,
  createdBy: gmUser.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockGmMember = {
  id: 'member-1',
  userId: gmUser.id,
  campaignId: mockCampaign.id,
  role: CampaignRole.GAMEMASTER,
  joinedAt: new Date(),
  deletedAt: null,
};

// ── Prisma mock ────────────────────────────────────────────────────────────

const mockCampaignCreate = jest.fn();
const mockCampaignMemberCreate = jest.fn();
const mockCampaignFindMany = jest.fn();
const mockCampaignFindFirst = jest.fn();
const mockCampaignUpdate = jest.fn();
const mockCampaignMemberFindFirst = jest.fn();

const mockTransaction = jest.fn().mockImplementation(async (fn) =>
  fn({
    campaign: { create: mockCampaignCreate },
    campaignMember: { create: mockCampaignMemberCreate },
  }),
);

const prismaMock = {
  $transaction: mockTransaction,
  campaign: {
    create: mockCampaignCreate,
    findMany: mockCampaignFindMany,
    findFirst: mockCampaignFindFirst,
    update: mockCampaignUpdate,
  },
  campaignMember: {
    create: mockCampaignMemberCreate,
    findFirst: mockCampaignMemberFindFirst,
  },
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates campaign and GAMEMASTER member in a single transaction', async () => {
      mockCampaignCreate.mockResolvedValue(mockCampaign);
      mockCampaignMemberCreate.mockResolvedValue(mockGmMember);

      const result = await service.create({ name: 'Test Campaign' }, gmUser);

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockCampaignCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ createdBy: gmUser.id }) }),
      );
      expect(mockCampaignMemberCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: gmUser.id,
            role: CampaignRole.GAMEMASTER,
          }),
        }),
      );
      expect(result).toEqual(mockCampaign);
    });
  });

  // ── findAllForUser ───────────────────────────────────────────────────────

  describe('findAllForUser', () => {
    it('returns all non-deleted campaigns for admin', async () => {
      mockCampaignFindMany.mockResolvedValue([mockCampaign]);

      await service.findAllForUser(adminUser);

      expect(mockCampaignFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });

    it('returns only campaigns the player belongs to', async () => {
      mockCampaignFindMany.mockResolvedValue([mockCampaign]);

      await service.findAllForUser(playerUser);

      expect(mockCampaignFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            members: { some: { userId: playerUser.id, deletedAt: null } },
          }),
        }),
      );
    });
  });

  // ── softDelete ───────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('allows admin to soft-delete any campaign', async () => {
      mockCampaignUpdate.mockResolvedValue({ ...mockCampaign, deletedAt: new Date() });

      await service.softDelete(mockCampaign.id, adminUser);

      expect(mockCampaignUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });

    it('allows the campaign GM to soft-delete', async () => {
      mockCampaignFindFirst.mockResolvedValue(mockCampaign);
      mockCampaignMemberFindFirst.mockResolvedValue(mockGmMember);
      mockCampaignUpdate.mockResolvedValue({ ...mockCampaign, deletedAt: new Date() });

      await service.softDelete(mockCampaign.id, gmUser);

      expect(mockCampaignUpdate).toHaveBeenCalled();
    });

    it('rejects a non-GM player', async () => {
      mockCampaignFindFirst.mockResolvedValue(mockCampaign);
      mockCampaignMemberFindFirst.mockResolvedValue({
        ...mockGmMember,
        userId: playerUser.id,
        role: CampaignRole.PLAYER,
      });

      await expect(service.softDelete(mockCampaign.id, playerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for a soft-deleted campaign', async () => {
      mockCampaignFindFirst.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent', playerUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── soft-delete exclusion ────────────────────────────────────────────────

  describe('soft-deleted campaigns are excluded', () => {
    it('findAllForUser filters by deletedAt: null', async () => {
      mockCampaignFindMany.mockResolvedValue([]);
      await service.findAllForUser(adminUser);
      expect(mockCampaignFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });

    it('findById treats soft-deleted campaign as not found', async () => {
      mockCampaignFindFirst.mockResolvedValue(null); // deleted → not returned by findFirst with deletedAt: null filter
      await expect(service.findById('deleted-id', adminUser)).rejects.toThrow(NotFoundException);
    });
  });
});
