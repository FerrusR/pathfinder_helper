import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ChatStore } from '../../store/chat.store';
import { MessageListComponent } from '../../components/message-list/message-list.component';
import { ChatInputComponent } from '../../components/chat-input/chat-input.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    MessageListComponent,
    ChatInputComponent,
  ],
  template: `
    <div class="chat-container">
      <mat-card class="chat-card">
        <div class="chat-header">
          <span class="header-title">Pathfinder 2e Rules Chat</span>
          <span class="spacer"></span>
          <button mat-icon-button class="clear-btn" (click)="store.clearMessages()" matTooltip="Clear chat">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>

        @if (store.isLoading()) {
          <mat-progress-bar mode="indeterminate" />
        }

        @if (store.error(); as error) {
          <div class="error-banner">{{ error }}</div>
        }

        <app-message-list [messages]="store.allMessages()" />

        <app-chat-input
          [disabled]="store.isLoading()"
          (messageSubmitted)="store.sendMessage($event)"
        />
      </mat-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .chat-container {
      display: flex;
      justify-content: center;
      align-items: stretch;
      height: 100%;
      padding: 16px;
      box-sizing: border-box;
      background: radial-gradient(ellipse at center top, #2a1a14 0%, #1a1410 70%);
    }

    .chat-card {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 840px;
      overflow: hidden;
      background-color: #2a2118;
      border: 1px solid #4a3828;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(201, 168, 76, 0.08);
    }

    .chat-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(135deg, #8b1a1a, #6b1414);
      border-bottom: 2px solid #c9a84c;
      flex-shrink: 0;
    }

    .header-title {
      font-size: 18px;
      font-weight: 600;
      color: #f4e8c1;
      letter-spacing: 0.5px;
    }

    .spacer {
      flex: 1;
    }

    .clear-btn {
      color: #e8dcc8;
      opacity: 0.7;

      &:hover {
        opacity: 1;
      }
    }

    .error-banner {
      padding: 8px 16px;
      background-color: rgba(139, 26, 26, 0.3);
      color: #f0a0a0;
      font-size: 13px;
      flex-shrink: 0;
      border-bottom: 1px solid rgba(139, 26, 26, 0.4);
    }

    app-message-list {
      flex: 1;
      overflow: hidden;
    }
  `],
})
export class ChatPageComponent {
  readonly store = inject(ChatStore);
}
