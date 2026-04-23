import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmbeddingService } from '../src/common/services/embedding.service';
import { HomeRuleEmbeddingService } from '../src/home-rules/home-rule-embedding.service';
import { CampaignRole, HomeRuleStatus, UserRole } from '../generated/prisma';

// ── Test users ──────────────────────────────────────────────────────────────

const GM_ID = 'gm-hr-id';
const PLAYER_ID = 'player-hr-id';
const OUTSIDER_ID = 'outsider-hr-id';
const ADMIN_ID = 'admin-hr-id';

const testUsers: Record<string, object> = {
  [GM_ID]: { id: GM_ID, email: 'gm@hr.test', displayName: 'GM', role: UserRole.PLAYER, createdAt: new Date(), updatedAt: new Date() },
  [PLAYER_ID]: { id: PLAYER_ID, email: 'player@hr.test', displayName: 'Player', role: UserRole.PLAYER, createdAt: new Date(), updatedAt: new Date() },
  [OUTSIDER_ID]: { id: OUTSIDER_ID, email: 'outsider@hr.test', displayName: 'Outsider', role: UserRole.PLAYER, createdAt: new Date(), updatedAt: new Date() },
  [ADMIN_ID]: { id: ADMIN_ID, email: 'admin@hr.test', displayName: 'Admin', role: UserRole.ADMIN, createdAt: new Date(), updatedAt: new Date() },
};

// ── Fixtures ─────────────────────────────────────────────────────────────

const CAMPAIGN_ID = 'campaign-hr-1';

const gmMember = {
  id: 'member-gm-hr',
  userId: GM_ID,
  campaignId: CAMPAIGN_ID,
  role: CampaignRole.GAMEMASTER,
  joinedAt: new Date(),
  deletedAt: null,
};

const playerMember = {
  id: 'member-player-hr',
  userId: PLAYER_ID,
  campaignId: CAMPAIGN_ID,
  role: CampaignRole.PLAYER,
  joinedAt: new Date(),
  deletedAt: null,
};

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    campaignId: CAMPAIGN_ID,
    title: 'No Flanking for Ranged',
    content: 'Ranged attacks do not benefit from flanking.',
    category: 'combat',
    overridesRuleId: null,
    status: HomeRuleStatus.PROPOSED,
    proposedBy: PLAYER_ID,
    approvedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

// ── Prisma mock fns ─────────────────────────────────────────────────────────

const mockHomeRuleCreate = jest.fn();
const mockHomeRuleFindFirst = jest.fn();
const mockHomeRuleFindMany = jest.fn();
const mockHomeRuleUpdate = jest.fn();
const mockMemberFindFirst = jest.fn();
const mockHomeRuleChunkDeleteMany = jest.fn();

const prismaMock = {
  user: {
    findUnique: jest.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve(testUsers[id] ?? null),
    ),
  },
  campaign: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  campaignMember: {
    findFirst: mockMemberFindFirst,
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  homeRule: {
    create: mockHomeRuleCreate,
    findFirst: mockHomeRuleFindFirst,
    findMany: mockHomeRuleFindMany,
    update: mockHomeRuleUpdate,
  },
  homeRuleChunk: { deleteMany: mockHomeRuleChunkDeleteMany },
  $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
};

// ── Embedding service mock (tracks chunks in memory) ───────────────────────

const embeddedChunks: Array<{ homeRuleId: string }> = [];

const homeRuleEmbeddingMock = {
  embedAndStore: jest.fn().mockImplementation(async (rule: { id: string }) => {
    embeddedChunks.push({ homeRuleId: rule.id });
  }),
  removeChunksForRule: jest.fn().mockImplementation(async (homeRuleId: string) => {
    const idx = embeddedChunks.findIndex((c) => c.homeRuleId === homeRuleId);
    if (idx !== -1) embeddedChunks.splice(idx, 1);
  }),
};

// ── Suite ───────────────────────────────────────────────────────────────────

describe('Home Rules (e2e)', () => {
  let app: INestApplication;
  let gmToken: string;
  let playerToken: string;
  let outsiderToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(EmbeddingService)
      .useValue({ onModuleInit: jest.fn(), embed: jest.fn(), embedBatch: jest.fn() })
      .overrideProvider(HomeRuleEmbeddingService)
      .useValue(homeRuleEmbeddingMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    const jwt = moduleFixture.get<JwtService>(JwtService);
    gmToken = jwt.sign({ sub: GM_ID });
    playerToken = jwt.sign({ sub: PLAYER_ID });
    outsiderToken = jwt.sign({ sub: OUTSIDER_ID });
    adminToken = jwt.sign({ sub: ADMIN_ID });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    embeddedChunks.length = 0;
  });

  // ── Player creates → PROPOSED ────────────────────────────────────────────

  describe('POST /api/campaigns/:campaignId/home-rules (player)', () => {
    it('player creates a rule with PROPOSED status', async () => {
      mockMemberFindFirst.mockResolvedValue(playerMember);
      const created = makeRule({ status: HomeRuleStatus.PROPOSED, proposedBy: PLAYER_ID });
      mockHomeRuleCreate.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post(`/api/campaigns/${CAMPAIGN_ID}/home-rules`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ title: 'No Flanking for Ranged', content: 'Ranged attacks do not benefit from flanking.' })
        .expect(201);

      expect(res.body.status).toBe(HomeRuleStatus.PROPOSED);
      expect(mockHomeRuleCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: HomeRuleStatus.PROPOSED }) }),
      );
    });
  });

  // ── GM approves → APPROVED + chunk written ───────────────────────────────

  describe('POST /api/home-rules/:id/approve (GM)', () => {
    it('GM approves a rule → status APPROVED and embedAndStore called', async () => {
      const proposedRule = makeRule({ status: HomeRuleStatus.PROPOSED });
      mockHomeRuleFindFirst.mockResolvedValue(proposedRule);
      // assertCanApproveOrReject: GM membership check
      mockMemberFindFirst.mockResolvedValue(gmMember);
      const approvedRule = makeRule({ status: HomeRuleStatus.APPROVED, approvedBy: GM_ID });
      mockHomeRuleUpdate.mockResolvedValue(approvedRule);

      const res = await request(app.getHttpServer())
        .post('/api/home-rules/rule-1/approve')
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(res.body.status).toBe(HomeRuleStatus.APPROVED);
      expect(homeRuleEmbeddingMock.embedAndStore).toHaveBeenCalledWith(approvedRule);
      expect(embeddedChunks).toHaveLength(1);
    });
  });

  // ── GM edits approved rule → PROPOSED + chunk gone ──────────────────────

  describe('PATCH /api/home-rules/:id (GM edits approved rule)', () => {
    it('reverts status to PROPOSED and removes the chunk', async () => {
      // Pre-populate a chunk
      embeddedChunks.push({ homeRuleId: 'rule-1' });

      const approvedRule = makeRule({ status: HomeRuleStatus.APPROVED, proposedBy: GM_ID });
      mockHomeRuleFindFirst.mockResolvedValue(approvedRule);
      // assertCanEdit: GM membership check
      mockMemberFindFirst.mockResolvedValue(gmMember);
      const revertedRule = makeRule({ status: HomeRuleStatus.PROPOSED, approvedBy: null });
      mockHomeRuleUpdate.mockResolvedValue(revertedRule);

      const res = await request(app.getHttpServer())
        .patch('/api/home-rules/rule-1')
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ content: 'Updated content' })
        .expect(200);

      expect(res.body.status).toBe(HomeRuleStatus.PROPOSED);
      expect(homeRuleEmbeddingMock.removeChunksForRule).toHaveBeenCalledWith('rule-1');
      expect(embeddedChunks).toHaveLength(0);
    });
  });

  // ── GM re-approves → new chunk written ──────────────────────────────────

  describe('POST /api/home-rules/:id/approve (re-approve)', () => {
    it('re-approving writes a new chunk', async () => {
      const proposedRule = makeRule({ status: HomeRuleStatus.PROPOSED });
      mockHomeRuleFindFirst.mockResolvedValue(proposedRule);
      mockMemberFindFirst.mockResolvedValue(gmMember);
      const approvedRule = makeRule({ status: HomeRuleStatus.APPROVED, approvedBy: GM_ID });
      mockHomeRuleUpdate.mockResolvedValue(approvedRule);

      await request(app.getHttpServer())
        .post('/api/home-rules/rule-1/approve')
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(homeRuleEmbeddingMock.embedAndStore).toHaveBeenCalledTimes(1);
      expect(embeddedChunks).toHaveLength(1);
    });
  });

  // ── Admin creates generic rule; GM cannot ───────────────────────────────

  describe('POST /api/home-rules/generic', () => {
    it('admin can create a generic rule', async () => {
      const genericRule = makeRule({ campaignId: null, status: HomeRuleStatus.APPROVED });
      mockHomeRuleCreate.mockResolvedValue(genericRule);

      const res = await request(app.getHttpServer())
        .post('/api/home-rules/generic')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Generic Rule', content: 'Applies globally.' })
        .expect(201);

      expect(res.body.status).toBe(HomeRuleStatus.APPROVED);
    });

    it('GM (non-admin player) cannot create a generic rule', async () => {
      await request(app.getHttpServer())
        .post('/api/home-rules/generic')
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ title: 'Generic Rule', content: 'Content.' })
        .expect(403);
    });
  });

  // ── Non-member cannot access campaign rules ──────────────────────────────

  describe('campaign home rules access by non-member', () => {
    it('GET returns 403 for a user not in the campaign', async () => {
      // Guard: outsider is not a member
      mockMemberFindFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/campaigns/${CAMPAIGN_ID}/home-rules`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('POST returns 403 for a user not in the campaign', async () => {
      mockMemberFindFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post(`/api/campaigns/${CAMPAIGN_ID}/home-rules`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'Sneaky Rule', content: 'Content.' })
        .expect(403);
    });
  });

  // ── Soft delete removes rule and chunks ──────────────────────────────────

  describe('DELETE /api/home-rules/:id', () => {
    it('soft-deletes the rule, removes its chunks, and excludes it from listing', async () => {
      embeddedChunks.push({ homeRuleId: 'rule-1' });

      const rule = makeRule({ status: HomeRuleStatus.APPROVED, proposedBy: GM_ID });
      mockHomeRuleFindFirst
        .mockResolvedValueOnce(rule)    // findById in softDelete
        .mockResolvedValueOnce(null);   // findById after deletion (returns null)
      // assertCanEdit: GM membership check
      mockMemberFindFirst.mockResolvedValue(gmMember);
      mockHomeRuleUpdate.mockResolvedValue({ ...rule, deletedAt: new Date() });
      mockHomeRuleFindMany.mockResolvedValue([]); // soft-deleted excluded

      await request(app.getHttpServer())
        .delete('/api/home-rules/rule-1')
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(homeRuleEmbeddingMock.removeChunksForRule).toHaveBeenCalledWith('rule-1');
      expect(embeddedChunks).toHaveLength(0);

      // Verify listing excludes it
      const listRes = await request(app.getHttpServer())
        .get(`/api/campaigns/${CAMPAIGN_ID}/home-rules`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      // Guard also calls findFirst for the GM — needs member returned
      // (already set via mockResolvedValue above)
      expect(listRes.body).toHaveLength(0);
    });
  });
});
