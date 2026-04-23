import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

const MOCK_VECTOR = Array.from({ length: 1536 }, (_, i) => i / 1536);

const mockEmbeddings = {
  embedQuery: jest.fn().mockResolvedValue(MOCK_VECTOR),
  embedDocuments: jest.fn().mockResolvedValue([MOCK_VECTOR, MOCK_VECTOR]),
};

jest.mock('@langchain/openai', () => ({
  AzureOpenAIEmbeddings: jest.fn().mockImplementation(() => mockEmbeddings),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('mock-value'),
          },
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    service.onModuleInit();
  });

  afterEach(() => jest.clearAllMocks());

  describe('embed', () => {
    it('returns a 1536-dimension vector', async () => {
      const result = await service.embed('How does flanking work?');

      expect(result).toHaveLength(1536);
      expect(mockEmbeddings.embedQuery).toHaveBeenCalledWith('How does flanking work?');
    });
  });

  describe('embedBatch', () => {
    it('returns one vector per input text', async () => {
      const texts = ['text one', 'text two'];
      const result = await service.embedBatch(texts);

      expect(result).toHaveLength(2);
      result.forEach((vec) => expect(vec).toHaveLength(1536));
      expect(mockEmbeddings.embedDocuments).toHaveBeenCalledWith(texts);
    });
  });
});
