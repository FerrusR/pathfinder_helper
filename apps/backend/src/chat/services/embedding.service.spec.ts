import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

jest.mock('@langchain/openai', () => ({
  AzureOpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue(Array(1536).fill(0.1)),
  })),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          AZURE_OPENAI_API_KEY: 'test-key',
          AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
          AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME: 'test-embedding',
          AZURE_OPENAI_API_INSTANCE_NAME: 'test-instance',
        };
        return config[key] ?? key;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  describe('onModuleInit', () => {
    it('should initialize without throwing', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('should read required config values', () => {
      service.onModuleInit();
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('AZURE_OPENAI_API_KEY');
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('AZURE_OPENAI_ENDPOINT');
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME');
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('AZURE_OPENAI_API_INSTANCE_NAME');
    });
  });

  describe('embedQuery', () => {
    it('should return an embedding vector', async () => {
      service.onModuleInit();
      const result = await service.embedQuery('test query');
      expect(result).toHaveLength(1536);
      expect(result[0]).toBe(0.1);
    });
  });
});
