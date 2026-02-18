import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, toArray } from 'rxjs';
import { ChatService, ConversationMessage } from './chat.service';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService, RuleChunkResult } from './vector-search.service';
import { ChatSseEvent } from '../types/chat.types';

// Mock @langchain/openai
const mockStream = jest.fn();
jest.mock('@langchain/openai', () => ({
  AzureChatOpenAI: jest.fn().mockImplementation(() => ({
    stream: mockStream,
  })),
}));

// Mock fs to avoid reading actual files
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('You are a Pathfinder 2e rules expert.'),
}));

describe('ChatService', () => {
  let service: ChatService;
  let embeddingService: { embedQuery: jest.Mock };
  let vectorSearchService: { searchRuleChunks: jest.Mock };

  const mockChunks: RuleChunkResult[] = [
    {
      id: 'chunk-1',
      title: 'Flanking',
      category: 'condition',
      source: 'Core Rulebook',
      content: 'Flanking rules content here.',
      similarity: 0.85,
    },
  ];

  // Helper: create an async iterable from string tokens
  function createMockStream(tokens: string[]) {
    return {
      async *[Symbol.asyncIterator]() {
        for (const token of tokens) {
          yield { content: token };
        }
      },
    };
  }

  beforeEach(async () => {
    embeddingService = {
      embedQuery: jest.fn().mockResolvedValue(Array(1536).fill(0.1)),
    };

    vectorSearchService = {
      searchRuleChunks: jest.fn().mockResolvedValue(mockChunks),
    };

    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-value'),
    };

    mockStream.mockReset();
    mockStream.mockResolvedValue(createMockStream(['Hello', ' world']));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmbeddingService, useValue: embeddingService },
        { provide: VectorSearchService, useValue: vectorSearchService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    service.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should initialize without throwing', () => {
      // Already called in beforeEach — verify the service is usable
      expect(service).toBeDefined();
    });
  });

  describe('chat', () => {
    it('should return an Observable', () => {
      const result = service.chat('How does flanking work?');
      expect(result).toBeDefined();
      expect(typeof result.subscribe).toBe('function');
    });

    it('should emit sources event first', async () => {
      const events = await collectEvents(service.chat('test'));
      const sourcesEvent = events.find((e) => e.type === 'sources');
      expect(sourcesEvent).toBeDefined();
      expect(sourcesEvent!.type).toBe('sources');
      if (sourcesEvent!.type === 'sources') {
        expect(sourcesEvent!.data).toHaveLength(1);
        expect(sourcesEvent!.data[0].title).toBe('Flanking');
      }
    });

    it('should emit token events from LLM stream', async () => {
      const events = await collectEvents(service.chat('test'));
      const tokenEvents = events.filter((e) => e.type === 'token');
      expect(tokenEvents).toHaveLength(2);
      expect(tokenEvents[0]).toEqual({ type: 'token', data: 'Hello' });
      expect(tokenEvents[1]).toEqual({ type: 'token', data: ' world' });
    });

    it('should emit done event at the end', async () => {
      const events = await collectEvents(service.chat('test'));
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: 'done' });
    });

    it('should emit events in correct order: sources → tokens → done', async () => {
      const events = await collectEvents(service.chat('test'));
      const types = events.map((e) => e.type);
      expect(types).toEqual(['sources', 'token', 'token', 'done']);
    });

    it('should pass message to embedding service', async () => {
      await collectEvents(service.chat('How does flanking work?'));
      expect(embeddingService.embedQuery).toHaveBeenCalledWith('How does flanking work?');
    });

    it('should pass embedding to vector search', async () => {
      await collectEvents(service.chat('test'));
      expect(vectorSearchService.searchRuleChunks).toHaveBeenCalledWith(
        Array(1536).fill(0.1),
      );
    });

    it('should handle conversation history', async () => {
      const history: ConversationMessage[] = [
        { role: 'user', content: 'What is flanking?' },
        { role: 'assistant', content: 'Flanking is a condition...' },
      ];
      await collectEvents(service.chat('Tell me more', history));
      expect(embeddingService.embedQuery).toHaveBeenCalledWith('Tell me more');
    });

    it('should skip empty tokens from LLM stream', async () => {
      mockStream.mockResolvedValue(createMockStream(['Hello', '', ' world']));
      const events = await collectEvents(service.chat('test'));
      const tokenEvents = events.filter((e) => e.type === 'token');
      expect(tokenEvents).toHaveLength(2);
    });

    it('should handle chunks with no results', async () => {
      vectorSearchService.searchRuleChunks.mockResolvedValue([]);
      const events = await collectEvents(service.chat('obscure question'));
      const sourcesEvent = events.find((e) => e.type === 'sources');
      expect(sourcesEvent).toBeDefined();
      if (sourcesEvent!.type === 'sources') {
        expect(sourcesEvent!.data).toEqual([]);
      }
    });
  });

  describe('error handling', () => {
    it('should emit error event when embedding fails', async () => {
      embeddingService.embedQuery.mockRejectedValue(new Error('Embedding API error'));
      const events = await collectEvents(service.chat('test'));
      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent).toEqual({ type: 'error', data: 'Embedding API error' });
    });

    it('should emit error event when vector search fails', async () => {
      vectorSearchService.searchRuleChunks.mockRejectedValue(new Error('DB connection failed'));
      const events = await collectEvents(service.chat('test'));
      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent).toEqual({ type: 'error', data: 'DB connection failed' });
    });

    it('should emit error event when LLM stream fails', async () => {
      mockStream.mockRejectedValue(new Error('LLM unavailable'));
      const events = await collectEvents(service.chat('test'));
      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent).toEqual({ type: 'error', data: 'LLM unavailable' });
    });

    it('should handle non-Error thrown objects', async () => {
      embeddingService.embedQuery.mockRejectedValue('string error');
      const events = await collectEvents(service.chat('test'));
      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toEqual({ type: 'error', data: 'An unexpected error occurred' });
    });
  });
});

/** Collect all events from a ChatService Observable */
function collectEvents(obs: ReturnType<ChatService['chat']>): Promise<ChatSseEvent[]> {
  return lastValueFrom(obs.pipe(toArray()));
}
