import { Test, TestingModule } from '@nestjs/testing';
import { VectorSearchService, RuleChunkResult } from './vector-search.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('VectorSearchService', () => {
  let service: VectorSearchService;
  let mockPrisma: { $queryRawUnsafe: jest.Mock };

  const mockResults: RuleChunkResult[] = [
    {
      id: 'chunk-1',
      title: 'Flanking',
      category: 'condition',
      source: 'Core Rulebook',
      content: 'Flanking rules content...',
      similarity: 0.85,
    },
    {
      id: 'chunk-2',
      title: 'Flat-Footed',
      category: 'condition',
      source: 'Core Rulebook',
      content: 'Flat-footed condition...',
      similarity: 0.72,
    },
  ];

  beforeEach(async () => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue(mockResults),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorSearchService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<VectorSearchService>(VectorSearchService);
  });

  describe('searchRuleChunks', () => {
    const testEmbedding = [0.1, 0.2, 0.3];

    it('should return matching rule chunks', async () => {
      const results = await service.searchRuleChunks(testEmbedding);
      expect(results).toEqual(mockResults);
    });

    it('should call Prisma with correct vector literal', async () => {
      await service.searchRuleChunks(testEmbedding);

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      const args = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(args[1]).toBe('[0.1,0.2,0.3]');
    });

    it('should use default topK=8 and similarityThreshold=0.3', async () => {
      await service.searchRuleChunks(testEmbedding);

      const args = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(args[2]).toBe(0.3); // similarityThreshold
      expect(args[3]).toBe(8);   // topK
    });

    it('should accept custom topK and similarityThreshold', async () => {
      await service.searchRuleChunks(testEmbedding, 5, 0.5);

      const args = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(args[2]).toBe(0.5);
      expect(args[3]).toBe(5);
    });

    it('should return empty array when no chunks match', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      const results = await service.searchRuleChunks(testEmbedding);
      expect(results).toEqual([]);
    });

    it('should include SQL with pgvector distance operator', async () => {
      await service.searchRuleChunks(testEmbedding);

      const sql = mockPrisma.$queryRawUnsafe.mock.calls[0][0] as string;
      expect(sql).toContain('embedding <=> $1::vector');
      expect(sql).toContain('rule_chunks');
      expect(sql).toContain('LIMIT $3');
    });
  });
});
