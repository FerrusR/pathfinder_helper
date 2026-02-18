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
          <div class="empty-icon">&#9876;</div>
          <div class="empty-text">Ask a question about Pathfinder 2e rules to begin your quest.</div>
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

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background-color: #4a3828;
        border-radius: 3px;

        &:hover {
          background-color: #5a4838;
        }
      }
    }

    .empty-state {
      margin: auto;
      text-align: center;
    }

    .empty-icon {
      font-size: 48px;
      opacity: 0.3;
      margin-bottom: 12px;
    }

    .empty-text {
      color: #a89880;
      font-size: 14px;
      font-style: italic;
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
