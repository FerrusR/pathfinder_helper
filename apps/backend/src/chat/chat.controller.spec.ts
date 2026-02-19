import { Test, TestingModule } from '@nestjs/testing';
import { of, lastValueFrom, toArray } from 'rxjs';
import { ChatController } from './chat.controller';
import { ChatService } from './services/chat.service';
import { ChatSseEvent } from './types/chat.types';
import { RequestUser } from '@/common/types/request-user.type';
import { UserRole } from '../../generated/prisma';

const mockUser: RequestUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  role: UserRole.PLAYER,
};

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: { chat: jest.Mock };

  const mockEvents: ChatSseEvent[] = [
    { type: 'sources', data: [{ title: 'Flanking', category: 'condition', source: 'CRB', similarity: 0.85 }] },
    { type: 'token', data: 'Hello' },
    { type: 'done' },
  ];

  beforeEach(async () => {
    chatService = {
      chat: jest.fn().mockReturnValue(of(...mockEvents)),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: chatService }],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  describe('chat', () => {
    it('should call ChatService.chat with message, user, and history', () => {
      const dto = {
        message: 'How does flanking work?',
        conversationHistory: [{ role: 'user' as const, content: 'Hi' }],
      };
      controller.chat(dto as any, mockUser);
      expect(chatService.chat).toHaveBeenCalledWith(
        'How does flanking work?',
        mockUser,
        [{ role: 'user', content: 'Hi' }],
      );
    });

    it('should call ChatService.chat with undefined history when not provided', () => {
      const dto = { message: 'test' };
      controller.chat(dto as any, mockUser);
      expect(chatService.chat).toHaveBeenCalledWith('test', mockUser, undefined);
    });

    it('should return Observable of MessageEvent objects', async () => {
      const dto = { message: 'test', conversationHistory: [] };
      const result = controller.chat(dto, mockUser);
      const events = await lastValueFrom(result.pipe(toArray()));

      expect(events).toHaveLength(3);
      events.forEach((event) => {
        expect(event).toHaveProperty('data');
      });
    });

    it('should wrap each ChatSseEvent in a data property', async () => {
      const dto = { message: 'test', conversationHistory: [] };
      const result = controller.chat(dto, mockUser);
      const events = await lastValueFrom(result.pipe(toArray()));

      expect(events[0].data).toEqual(mockEvents[0]);
      expect(events[1].data).toEqual(mockEvents[1]);
      expect(events[2].data).toEqual(mockEvents[2]);
    });
  });
});
