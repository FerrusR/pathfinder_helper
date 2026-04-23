import { Test, TestingModule } from '@nestjs/testing';
import { HomeRule, HomeRuleStatus } from '../../generated/prisma';
import { EmbeddingService } from '../common/services/embedding.service';
import { PrismaService } from '../prisma/prisma.service';
import { HomeRuleEmbeddingService } from './home-rule-embedding.service';

const MOCK_VECTOR = Array.from({ length: 1536 }, (_, i) => i / 1536);

const mockRule: HomeRule = {
  id: 'rule-uuid-1',
  campaignId: 'campaign-uuid-1',
  title: 'No Flanking for Ranged Attacks',
  content: 'Ranged attacks cannot benefit from flanking.',
  category: 'combat',
  overridesRuleId: 'flanking',
  status: HomeRuleStatus.APPROVED,
  proposedBy: 'user-uuid-1',
  approvedBy: 'user-uuid-2',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
const mockExecuteRawUnsafe = jest.fn().mockResolvedValue(1);
const mockTransaction = jest.fn().mockImplementation(async (fn) => {
  return fn({
    homeRuleChunk: { deleteMany: mockDeleteMany },
    $executeRawUnsafe: mockExecuteRawUnsafe,
  });
});

describe('HomeRuleEmbeddingService', () => {
  let service: HomeRuleEmbeddingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeRuleEmbeddingService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: mockTransaction,
            homeRuleChunk: { deleteMany: mockDeleteMany },
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            embed: jest.fn().mockResolvedValue(MOCK_VECTOR),
          },
        },
      ],
    }).compile();

    service = module.get<HomeRuleEmbeddingService>(HomeRuleEmbeddingService);
  });

  describe('embedAndStore', () => {
    it('deletes existing chunks and inserts a new home_rule_chunks row', async () => {
      await service.embedAndStore(mockRule);

      // Existing chunks cleared first
      expect(mockDeleteMany).toHaveBeenCalledWith({ where: { homeRuleId: mockRule.id } });

      // INSERT called with correct positional args
      expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
      const [sql, id, homeRuleId, campaignId, title, category, content, vectorArg, metadata] =
        mockExecuteRawUnsafe.mock.calls[0];

      expect(sql).toContain('INSERT INTO home_rule_chunks');
      expect(typeof id).toBe('string'); // generated UUID
      expect(homeRuleId).toBe(mockRule.id);
      expect(campaignId).toBe(mockRule.campaignId);
      expect(title).toBe(mockRule.title);
      expect(category).toBe(mockRule.category);
      expect(content).toBe(mockRule.content);
      expect(vectorArg).toMatch(/^\[[\d.,\-]+\]$/); // pgvector literal format
      expect(vectorArg.split(',')).toHaveLength(1536);
      expect(JSON.parse(metadata)).toEqual({ overridesRuleId: mockRule.overridesRuleId });
    });

    it('passes null campaignId for generic rules', async () => {
      const genericRule: HomeRule = { ...mockRule, campaignId: null };
      await service.embedAndStore(genericRule);

      const [, , , campaignId] = mockExecuteRawUnsafe.mock.calls[0];
      expect(campaignId).toBeNull();
    });
  });

  describe('removeChunksForRule', () => {
    it('deletes all chunks for the given rule id', async () => {
      await service.removeChunksForRule('rule-uuid-1');
      expect(mockDeleteMany).toHaveBeenCalledWith({ where: { homeRuleId: 'rule-uuid-1' } });
    });
  });
});
