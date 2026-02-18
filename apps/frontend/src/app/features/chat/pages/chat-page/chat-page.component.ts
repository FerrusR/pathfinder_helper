import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
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
    MatToolbarModule,
    MessageListComponent,
    ChatInputComponent,
  ],
  template: `
    <div class="chat-container">
      <mat-card class="chat-card">
        <mat-toolbar color="primary" class="chat-header">
          <span>Pathfinder 2e Rules Chat</span>
          <span class="spacer"></span>
          <button mat-icon-button (click)="store.clearMessages()" matTooltip="Clear chat">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </mat-toolbar>

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
    .chat-container {
      display: flex;
      justify-content: center;
      padding: 24px 16px;
      height: calc(100vh - 48px);
      box-sizing: border-box;
    }

    .chat-card {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 800px;
      height: 100%;
      overflow: hidden;
    }

    .chat-header {
      flex-shrink: 0;
    }

    .spacer {
      flex: 1;
    }

    .error-banner {
      padding: 8px 16px;
      background-color: #fdecea;
      color: #611a15;
      font-size: 13px;
      flex-shrink: 0;
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
