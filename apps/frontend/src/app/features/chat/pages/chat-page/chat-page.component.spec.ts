import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideMarkdown } from 'ngx-markdown';
import { signal, WritableSignal } from '@angular/core';
import { ChatPageComponent } from './chat-page.component';
import { ChatStore } from '../../store/chat.store';
import { ChatMessage } from '../../chat.types';

describe('ChatPageComponent', () => {
  let component: ChatPageComponent;
  let fixture: ComponentFixture<ChatPageComponent>;

  let mockIsLoading: WritableSignal<boolean>;
  let mockError: WritableSignal<string | null>;
  let mockAllMessages: WritableSignal<ChatMessage[]>;
  let mockClearMessages: jasmine.Spy;
  let mockSendMessage: jasmine.Spy;

  beforeEach(async () => {
    mockIsLoading = signal(false);
    mockError = signal<string | null>(null);
    mockAllMessages = signal<ChatMessage[]>([]);
    mockClearMessages = jasmine.createSpy('clearMessages');
    mockSendMessage = jasmine.createSpy('sendMessage');

    const mockStore = {
      isLoading: mockIsLoading,
      error: mockError,
      allMessages: mockAllMessages,
      clearMessages: mockClearMessages,
      sendMessage: mockSendMessage,
    };

    await TestBed.configureTestingModule({
      imports: [ChatPageComponent],
      providers: [
        provideAnimationsAsync(),
        provideMarkdown(),
        { provide: ChatStore, useValue: mockStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the header title', () => {
    const title = fixture.nativeElement.querySelector('.header-title');
    expect(title.textContent).toBe('Pathfinder 2e Rules Chat');
  });

  describe('progress bar', () => {
    it('should show progress bar when loading', () => {
      mockIsLoading.set(true);
      fixture.detectChanges();

      const progressBar = fixture.nativeElement.querySelector('mat-progress-bar');
      expect(progressBar).toBeTruthy();
    });

    it('should hide progress bar when not loading', () => {
      mockIsLoading.set(false);
      fixture.detectChanges();

      const progressBar = fixture.nativeElement.querySelector('mat-progress-bar');
      expect(progressBar).toBeNull();
    });
  });

  describe('error banner', () => {
    it('should display error banner when error exists', () => {
      mockError.set('Something went wrong');
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector('.error-banner');
      expect(banner).toBeTruthy();
      expect(banner.textContent).toBe('Something went wrong');
    });

    it('should hide error banner when no error', () => {
      mockError.set(null);
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector('.error-banner');
      expect(banner).toBeNull();
    });
  });

  describe('clear button', () => {
    it('should call store.clearMessages when clicked', () => {
      const clearBtn = fixture.nativeElement.querySelector('.clear-btn');
      clearBtn.click();

      expect(mockClearMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('child components', () => {
    it('should pass allMessages to message-list', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'test' },
      ];
      mockAllMessages.set(messages);
      fixture.detectChanges();

      const messageList = fixture.nativeElement.querySelector('app-message-list');
      expect(messageList).toBeTruthy();
    });

    it('should pass isLoading to chat-input disabled', () => {
      const chatInput = fixture.nativeElement.querySelector('app-chat-input');
      expect(chatInput).toBeTruthy();
    });
  });
});
