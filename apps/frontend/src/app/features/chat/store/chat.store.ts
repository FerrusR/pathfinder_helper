import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { Subscription } from 'rxjs';
import { ChatApiService } from '../services/chat-api.service';
import { ChatMessage, ConversationMessage, RuleSource } from '../chat.types';

interface ChatState {
  messages: ChatMessage[];
  currentResponse: string;
  sources: RuleSource[];
  isLoading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  messages: [],
  currentResponse: '',
  sources: [],
  isLoading: false,
  error: null,
};

export const ChatStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    allMessages: computed<ChatMessage[]>(() => {
      const messages = store.messages();
      const current = store.currentResponse();
      if (!current) return messages;
      return [
        ...messages,
        { role: 'assistant' as const, content: current },
      ];
    }),
  })),
  withMethods((store) => {
    const chatApi = inject(ChatApiService);
    let activeSubscription: Subscription | null = null;

    return {
      sendMessage(message: string): void {
        activeSubscription?.unsubscribe();

        const userMessage: ChatMessage = { role: 'user', content: message };

        patchState(store, {
          messages: [...store.messages(), userMessage],
          currentResponse: '',
          sources: [],
          isLoading: true,
          error: null,
        });

        const conversationHistory: ConversationMessage[] = store
          .messages()
          .map(({ role, content }) => ({ role, content }));

        activeSubscription = chatApi
          .sendMessage(message, conversationHistory)
          .subscribe({
            next: (event) => {
              switch (event.type) {
                case 'token':
                  patchState(store, {
                    currentResponse: store.currentResponse() + event.data,
                  });
                  break;
                case 'sources':
                  patchState(store, { sources: event.data });
                  break;
                case 'done': {
                  const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: store.currentResponse(),
                    sources: store.sources(),
                  };
                  patchState(store, {
                    messages: [...store.messages(), assistantMessage],
                    currentResponse: '',
                    isLoading: false,
                  });
                  break;
                }
                case 'error':
                  patchState(store, {
                    error: event.data,
                    isLoading: false,
                    currentResponse: '',
                  });
                  break;
              }
            },
            error: () => {
              patchState(store, {
                error: 'An unexpected error occurred.',
                isLoading: false,
                currentResponse: '',
              });
            },
          });
      },

      clearMessages(): void {
        activeSubscription?.unsubscribe();
        activeSubscription = null;
        patchState(store, initialState);
      },
    };
  }),
);
