import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ChatEvent, ConversationMessage } from '../chat.types';

@Injectable({
  providedIn: 'root',
})
export class ChatApiService {
  private readonly chatUrl = `${environment.apiUrl}/chat`;

  sendMessage(
    message: string,
    conversationHistory: ConversationMessage[],
  ): Observable<ChatEvent> {
    return new Observable<ChatEvent>((subscriber) => {
      const abortController = new AbortController();

      this.streamChat(message, conversationHistory, abortController.signal, subscriber);

      return () => {
        abortController.abort();
      };
    });
  }

  private async streamChat(
    message: string,
    conversationHistory: ConversationMessage[],
    signal: AbortSignal,
    subscriber: {
      next: (value: ChatEvent) => void;
      complete: () => void;
      error: (err: unknown) => void;
    },
  ): Promise<void> {
    let response: Response;

    try {
      response = await fetch(this.chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationHistory }),
        signal,
      });
    } catch (err) {
      if (!signal.aborted) {
        subscriber.next({ type: 'error', data: 'Network error: unable to reach the server.' });
        subscriber.complete();
      }
      return;
    }

    if (!response.ok) {
      subscriber.next({
        type: 'error',
        data: `Server error: ${response.status} ${response.statusText}`,
      });
      subscriber.complete();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      subscriber.next({ type: 'error', data: 'Streaming not supported by the browser.' });
      subscriber.complete();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;

          const json = line.slice(5).trim();
          if (!json) continue;

          try {
            const event = JSON.parse(json) as ChatEvent;
            subscriber.next(event);
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (err) {
      if (!signal.aborted) {
        subscriber.next({ type: 'error', data: 'Connection lost while streaming response.' });
      }
    }

    subscriber.complete();
  }
}
