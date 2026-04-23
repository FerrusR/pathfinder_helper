import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmbeddingService } from '../src/common/services/embedding.service';
import { HomeRuleEmbeddingService } from '../src/home-rules/home-rule-embedding.service';
import { CampaignRole, UserRole } from '../generated/prisma';

// ── Test users ──────────────────────────────────────────────────────────────

const GM_ID = 'gm-user-id';
const PLAYER_ID = 'player-user-id';
const ADMIN_ID = 'admin-user-id';

const testUsers: Record<string, object> = {
  [GM_ID]: { id: GM_ID, email: 'gm@test.com', displayName: 'GM User', role: UserRole.PLAYER, createdAt: new Date(), updatedAt: new Date() },
  [PLAYER_ID]: { id: PLAYER_ID, email: 'player@test.com', displayName: 'Player', role: UserRole.PLAYER, createdAt: new Date(), updatedAt: new Date() },
  [ADMIN_ID]: { id: ADMIN_ID, email: 'admin@test.com', displayName: 'Admin', role: UserRole.ADMIN, createdAt: new Date(), updatedAt: new Date() },
};

// ── Prisma mock functions ───────────────────────────────────────────────────

const mockCampaignCreate = jest.fn();
const mockCampaignFindMany = jest.fn();
const mockCampaignFindFirst = jest.fn();
const mockCampaignUpdate = jest.fn();
const mockMemberCreate = jest.fn();
const mockMemberFindFirst = jest.fn();
const mockMemberUpdate = jest.fn();
const mockMemberCount = jest.fn();

const mockTransaction = jest.fn().mockImplementation(
  async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      campaign: { create: mockCampaignCreate },
      campaignMember: { create: mockMemberCreate },
    }),
);

const prismaMock = {
  $transaction: mockTransaction,
  user: {
    findUnique: jest.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve(testUsers[id] ?? null),
    ),
  },
  campaign: {
    create: mockCampaignCreate,
    findMany: mockCampaignFindMany,
    findFirst: mockCampaignFindFirst,
    update: mockCampaignUpdate,
  },
  campaignMember: {
    create: mockMemberCreate,
    findFirst: mockMemberFindFirst,
    findMany: jest.fn(),
    update: mockMemberUpdate,
    count: mockMemberCount,
  },
  homeRule: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  homeRuleChunk: { deleteMany: jest.fn() },
};

// ── Fixtures ─────────────────────────────────────────────────────────────

const campaign = {
  id: 'campaign-1',
  name: 'Test Campaign',
  description: null,
  createdBy: GM_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const gmMember = {
  id: 'member-gm',
  userId: GM_ID,
  campaignId: campaign.id,
  role: CampaignRole.GAMEMASTER,
  joinedAt: new Date(),
  deletedAt: null,
};

const playerMember = {
  id: 'member-player',
  userId: PLAYER_ID,
  campaignId: campaign.id,
  role: CampaignRole.PLAYER,
  joinedAt: new Date(),
  deletedAt: null,
};

// ── Suite ───────────────────────────────────────────────────────────────────

describe('Campaigns (e2e)', () => {
  let app: INestApplication;
  let gmToken: string;
  let playerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(EmbeddingService)
      .useValue({ onModuleInit: jest.fn(), embed: jest.fn(), embedBatch: jest.fn() })
      .overrideProvider(HomeRuleEmbeddingService)
      .useValue({ embedAndStore: jest.fn(), removeChunksForRule: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    const jwt = moduleFixture.get<JwtService>(JwtService);
    gmToken = jwt.sign({ sub: GM_ID, email: 'gm@test.com' });
    playerToken = jwt.sign({ sub: PLAYER_ID, email: 'player@test.com' });
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // ── Create campaign ─────────────────────────────────────────────────────

  describe('POST /api/campaigns', () => {
    it('creates a campaign and the creator becomes GAMEMASTER', async () => {
      mockCampaignCreate.mockResolvedValue(campaign);
      mockMemberCreate.mockResolvedValue(gmMember);

      const res = await request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ name: 'Test Campaign' })
        .expect(201);

      expect(res.body.id).toBe(campaign.id);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockMemberCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: GM_ID, role: CampaignRole.GAMEMASTER }),
        }),
      );
    });

    it('returns 401 for unauthenticated requests', () => {
      return request(app.getHttpServer()).post('/api/campaigns').send({ name: 'X' }).expect(401);
    });

    it('returns 400 for missing name', () => {
      return request(app.getHttpServer())
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${gmToken}`)
        .send({})
        .expect(400);
    });
  });

  // ── Player member cannot mutate ──────────────────────────────────────────

  describe('player member cannot update or delete the campaign', () => {
    it('PATCH returns 403 for PLAYER role', async () => {
      mockMemberFindFirst.mockResolvedValue(playerMember);

      await request(app.getHttpServer())
        .patch(`/api/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ name: 'Hijacked' })
        .expect(403);
    });

    it('DELETE returns 403 for PLAYER role', async () => {
      mockMemberFindFirst.mockResolvedValue(playerMember);

      await request(app.getHttpServer())
        .delete(`/api/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);
    });
  });

  // ── GM can update and soft-delete ───────────────────────────────────────

  describe('GM can update and soft-delete', () => {
    it('PATCH allows GM to rename the campaign', async () => {
      mockMemberFindFirst.mockResolvedValue(gmMember);
      mockCampaignFindFirst.mockResolvedValue(campaign);
      mockCampaignUpdate.mockResolvedValue({ ...campaign, name: 'Renamed' });

      const res = await request(app.getHttpServer())
        .patch(`/api/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ name: 'Renamed' })
        .expect(200);

      expect(res.body.name).toBe('Renamed');
    });

    it('DELETE soft-deletes the campaign; subsequent GET excludes it', async () => {
      // Guard + assertGmOrAdmin
      mockMemberFindFirst.mockResolvedValue(gmMember);
      mockCampaignFindFirst.mockResolvedValue(campaign);
      mockCampaignUpdate.mockResolvedValue({ ...campaign, deletedAt: new Date() });

      await request(app.getHttpServer())
        .delete(`/api/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      // Subsequent list returns nothing (soft-deleted)
      mockCampaignFindMany.mockResolvedValue([]);
      const listRes = await request(app.getHttpServer())
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(listRes.body).toHaveLength(0);
      expect(mockCampaignFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });
  });

  // ── Cannot remove last GM ────────────────────────────────────────────────

  describe('DELETE /api/campaigns/:id/members/:userId', () => {
    it('returns 400 when attempting to remove the last Gamemaster', async () => {
      // Guard: caller is GM
      mockMemberFindFirst
        .mockResolvedValueOnce(gmMember)  // guard lookup
        .mockResolvedValueOnce(gmMember); // service lookup of member-to-remove
      mockMemberCount.mockResolvedValue(0); // no other GMs remain

      await request(app.getHttpServer())
        .delete(`/api/campaigns/${campaign.id}/members/${GM_ID}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(400);
    });

    it('allows GM to remove a PLAYER member', async () => {
      mockMemberFindFirst
        .mockResolvedValueOnce(gmMember)    // guard
        .mockResolvedValueOnce(playerMember); // service lookup for player being removed
      mockMemberUpdate.mockResolvedValue({ ...playerMember, deletedAt: new Date() });

      await request(app.getHttpServer())
        .delete(`/api/campaigns/${campaign.id}/members/${PLAYER_ID}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);
    });
  });
});
