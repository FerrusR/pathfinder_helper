import { Component, effect, ElementRef, input, viewChild } from '@angular/core';
import { ChatMessage } from '../../chat.types';
import { MessageBubbleComponent } from '../message-bubble/message-bubble.component';

@Component({
  selector: 'app-message-list',
  standalone: true,
  imports: [MessageBubbleComponent],
  template: `
    <div class="message-list" #scrollContainer>
      @for (message of messages(); track $index) {
        <app-message-bubble [message]="message" />
      }
      @empty {
        <div class="empty-state">
          Ask a question about Pathfinder 2e rules to get started.
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      flex: 1;
      overflow: hidden;
    }

    .message-list {
      height: 100%;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }

    .empty-state {
      margin: auto;
      text-align: center;
      color: rgba(0, 0, 0, 0.45);
      font-size: 14px;
    }
  `],
})
export class MessageListComponent {
  messages = input.required<ChatMessage[]>();

  private scrollContainer = viewChild.required<ElementRef<HTMLElement>>('scrollContainer');

  constructor() {
    effect(() => {
      this.messages();
      const el = this.scrollContainer().nativeElement;
      setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
    });
  }
}
