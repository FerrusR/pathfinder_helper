import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ChatStore } from './chat.store';
import { ChatApiService } from '../services/chat-api.service';
import { ChatEvent } from '../chat.types';

describe('ChatStore', () => {
  let store: InstanceType<typeof ChatStore>;
  let chatEventSubject: Subject<ChatEvent>;
  let mockChatApi: jasmine.SpyObj<ChatApiService>;

  beforeEach(() => {
    chatEventSubject = new Subject<ChatEvent>();
    mockChatApi = jasmine.createSpyObj('ChatApiService', ['sendMessage']);
    mockChatApi.sendMessage.and.returnValue(chatEventSubject.asObservable());

    TestBed.configureTestingModule({
      providers: [
        ChatStore,
        { provide: ChatApiService, useValue: mockChatApi },
      ],
    });

    store = TestBed.inject(ChatStore);
  });

  it('should initialize with empty state', () => {
    expect(store.messages()).toEqual([]);
    expect(store.currentResponse()).toBe('');
    expect(store.sources()).toEqual([]);
    expect(store.isLoading()).toBeFalse();
    expect(store.error()).toBeNull();
  });

  describe('allMessages', () => {
    it('should return messages when no currentResponse', () => {
      expect(store.allMessages()).toEqual([]);
    });

    it('should append streaming assistant message when currentResponse exists', () => {
      store.sendMessage('test');
      chatEventSubject.next({ type: 'token', data: 'Hello' });

      const all = store.allMessages();
      expect(all.length).toBe(2); // user + streaming assistant
      expect(all[1]).toEqual({ role: 'assistant', content: 'Hello' });
    });
  });

  describe('sendMessage', () => {
    it('should add user message to messages', () => {
      store.sendMessage('How does flanking work?');

      expect(store.messages().length).toBe(1);
      expect(store.messages()[0]).toEqual({
        role: 'user',
        content: 'How does flanking work?',
      });
    });

    it('should set isLoading to true', () => {
      store.sendMessage('test');
      expect(store.isLoading()).toBeTrue();
    });

    it('should clear error on send', () => {
      // First trigger an error
      store.sendMessage('first');
      chatEventSubject.next({ type: 'error', data: 'some error' });

      // Send a new message - error should be cleared
      chatEventSubject = new Subject<ChatEvent>();
      mockChatApi.sendMessage.and.returnValue(chatEventSubject.asObservable());

      store.sendMessage('second');
      expect(store.error()).toBeNull();
    });

    it('should accumulate tokens in currentResponse', () => {
      store.sendMessage('test');

      chatEventSubject.next({ type: 'token', data: 'Hello' });
      expect(store.currentResponse()).toBe('Hello');

      chatEventSubject.next({ type: 'token', data: ' world' });
      expect(store.currentResponse()).toBe('Hello world');
    });

    it('should store sources from sources event', () => {
      const sources = [
        { title: 'Flanking', category: 'condition', source: 'CRB', similarity: 0.9 },
      ];
      store.sendMessage('test');
      chatEventSubject.next({ type: 'sources', data: sources });

      expect(store.sources()).toEqual(sources);
    });

    it('should finalize assistant message on done event', () => {
      store.sendMessage('test');
      const sources = [
        { title: 'Flanking', category: 'condition', source: 'CRB', similarity: 0.9 },
      ];

      chatEventSubject.next({ type: 'token', data: 'Answer text' });
      chatEventSubject.next({ type: 'sources', data: sources });
      chatEventSubject.next({ type: 'done' });

      expect(store.messages().length).toBe(2); // user + assistant
      expect(store.messages()[1]).toEqual({
        role: 'assistant',
        content: 'Answer text',
        sources,
      });
      expect(store.currentResponse()).toBe('');
      expect(store.isLoading()).toBeFalse();
    });

    it('should set error and clear loading on error event', () => {
      store.sendMessage('test');
      chatEventSubject.next({ type: 'error', data: 'Server error' });

      expect(store.error()).toBe('Server error');
      expect(store.isLoading()).toBeFalse();
      expect(store.currentResponse()).toBe('');
    });

    it('should set error on observable error', () => {
      store.sendMessage('test');
      chatEventSubject.error(new Error('Unexpected'));

      expect(store.error()).toBe('An unexpected error occurred.');
      expect(store.isLoading()).toBeFalse();
      expect(store.currentResponse()).toBe('');
    });

    it('should call chatApi with correct message and conversation history', () => {
      store.sendMessage('first question');
      chatEventSubject.next({ type: 'token', data: 'response' });
      chatEventSubject.next({ type: 'done' });

      // New subject for second call
      chatEventSubject = new Subject<ChatEvent>();
      mockChatApi.sendMessage.and.returnValue(chatEventSubject.asObservable());

      store.sendMessage('follow up');

      expect(mockChatApi.sendMessage).toHaveBeenCalledWith('follow up', [
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'response' },
        { role: 'user', content: 'follow up' },
      ]);
    });

    it('should unsubscribe previous subscription on new message', () => {
      store.sendMessage('first');

      // Send another message before the first completes
      const secondSubject = new Subject<ChatEvent>();
      mockChatApi.sendMessage.and.returnValue(secondSubject.asObservable());

      store.sendMessage('second');

      // Sending events on the first subject should have no effect
      chatEventSubject.next({ type: 'token', data: 'from first' });

      // Only the user messages should be in state, no tokens from first
      expect(store.currentResponse()).toBe('');
    });
  });

  describe('clearMessages', () => {
    it('should reset state to initial values', () => {
      store.sendMessage('test');
      chatEventSubject.next({ type: 'token', data: 'partial' });

      store.clearMessages();

      expect(store.messages()).toEqual([]);
      expect(store.currentResponse()).toBe('');
      expect(store.sources()).toEqual([]);
      expect(store.isLoading()).toBeFalse();
      expect(store.error()).toBeNull();
    });

    it('should unsubscribe active subscription', () => {
      store.sendMessage('test');
      store.clearMessages();

      // Events after clear should have no effect
      chatEventSubject.next({ type: 'token', data: 'late token' });
      expect(store.currentResponse()).toBe('');
    });
  });
});
