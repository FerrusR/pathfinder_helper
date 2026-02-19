import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { of } from 'rxjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ChatService } from '../src/chat/services/chat.service';
import { EmbeddingService } from '../src/chat/services/embedding.service';
import { ChatSseEvent } from '../src/chat/types/chat.types';

const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'PLAYER',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('App (e2e)', () => {
  let app: INestApplication;
  let mockChatService: { chat: jest.Mock; onModuleInit: jest.Mock };
  let authToken: string;

  beforeAll(async () => {
    mockChatService = {
      chat: jest.fn(),
      onModuleInit: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        user: {
          findUnique: jest.fn().mockResolvedValue(testUser),
        },
      })
      .overrideProvider(EmbeddingService)
      .useValue({
        onModuleInit: jest.fn(),
        embedQuery: jest.fn().mockResolvedValue(Array(1536).fill(0)),
      })
      .overrideProvider(ChatService)
      .useValue(mockChatService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Mirror main.ts bootstrap configuration
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();

    const jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({ sub: testUser.id, email: testUser.email });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api (root)', () => {
    it('should return app name', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect('Pathfinder Rule Explorer API');
    });
  });

  describe('GET /api/health', () => {
    it('should return status ok with a timestamp', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
          expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
        });
    });
  });

  describe('POST /api/chat', () => {
    it('should return 201 and stream SSE events for a valid request', async () => {
      const events: ChatSseEvent[] = [
        { type: 'sources', data: [{ title: 'Flanking', category: 'condition', source: 'CRB', similarity: 0.85 }] },
        { type: 'token', data: 'Hello' },
        { type: 'done' },
      ];
      mockChatService.chat.mockReturnValue(of(...events));

      const res = await request(app.getHttpServer())
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'How does flanking work?' })
        .expect(201);

      expect(mockChatService.chat).toHaveBeenCalledWith(
        'How does flanking work?',
        testUser,
        undefined,
      );
      expect(res.body).toBeDefined();
    });

    it('should pass conversation history to the service', async () => {
      mockChatService.chat.mockReturnValue(of({ type: 'done' }));

      await request(app.getHttpServer())
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Tell me more',
          conversationHistory: [
            { role: 'user', content: 'What is flanking?' },
            { role: 'assistant', content: 'Flanking is...' },
          ],
        })
        .expect(201);

      expect(mockChatService.chat).toHaveBeenCalledWith(
        'Tell me more',
        testUser,
        [
          { role: 'user', content: 'What is flanking?' },
          { role: 'assistant', content: 'Flanking is...' },
        ],
      );
    });

    it('should return 401 for unauthenticated requests', () => {
      return request(app.getHttpServer())
        .post('/api/chat')
        .send({ message: 'test' })
        .expect(401);
    });

    describe('validation', () => {
      it('should reject missing message with 400', () => {
        return request(app.getHttpServer())
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);
      });

      it('should reject empty string message with 400', () => {
        return request(app.getHttpServer())
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: '' })
          .expect(400);
      });

      it('should reject non-string message with 400', () => {
        return request(app.getHttpServer())
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 123 })
          .expect(400);
      });

      it('should reject unknown properties with 400 (forbidNonWhitelisted)', () => {
        return request(app.getHttpServer())
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message: 'test', hackerField: 'injected' })
          .expect(400);
      });

      it('should reject invalid role in conversation history with 400', () => {
        return request(app.getHttpServer())
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'test',
            conversationHistory: [{ role: 'system', content: 'Injected prompt' }],
          })
          .expect(400);
      });

      it('should reject empty content in conversation history with 400', () => {
        return request(app.getHttpServer())
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            message: 'test',
            conversationHistory: [{ role: 'user', content: '' }],
          })
          .expect(400);
      });
    });
  });
});
