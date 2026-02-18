import { Component, input } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { ChatMessage } from '../../chat.types';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [MarkdownComponent],
  template: `
    <div class="bubble" [class.user]="message().role === 'user'" [class.assistant]="message().role === 'assistant'">
      <div class="content">
        @if (message().role === 'assistant') {
          <markdown [data]="message().content"></markdown>
        } @else {
          {{ message().content }}
        }
      </div>
      @if (message().sources?.length) {
        <div class="sources">
          <span class="sources-label">Sources:</span>
          @for (source of message().sources; track source.title) {
            <span class="source-chip">{{ source.title }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .bubble {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 8px;
      word-wrap: break-word;
    }

    .user {
      margin-left: auto;
      background-color: #1976d2;
      color: white;
      border-bottom-right-radius: 4px;
      white-space: pre-wrap;
    }

    .assistant {
      margin-right: auto;
      background-color: #f5f5f5;
      color: rgba(0, 0, 0, 0.87);
      border-bottom-left-radius: 4px;
    }

    /* Markdown content styling */
    .assistant .content ::ng-deep {
      h1, h2, h3, h4, h5, h6 {
        margin: 8px 0 4px;
        line-height: 1.3;
      }

      h1 { font-size: 1.3em; }
      h2 { font-size: 1.2em; }
      h3 { font-size: 1.1em; }

      p {
        margin: 4px 0;
      }

      ul, ol {
        margin: 4px 0;
        padding-left: 20px;
      }

      li {
        margin: 2px 0;
      }

      code {
        background-color: rgba(0, 0, 0, 0.06);
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 0.9em;
      }

      pre {
        background-color: rgba(0, 0, 0, 0.06);
        padding: 8px 12px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 6px 0;

        code {
          background: none;
          padding: 0;
        }
      }

      table {
        border-collapse: collapse;
        width: 100%;
        margin: 6px 0;
        font-size: 0.9em;
      }

      th, td {
        border: 1px solid rgba(0, 0, 0, 0.15);
        padding: 4px 8px;
        text-align: left;
      }

      th {
        background-color: rgba(0, 0, 0, 0.04);
        font-weight: 600;
      }

      blockquote {
        margin: 6px 0;
        padding: 4px 12px;
        border-left: 3px solid rgba(0, 0, 0, 0.2);
        color: rgba(0, 0, 0, 0.6);
      }

      hr {
        border: none;
        border-top: 1px solid rgba(0, 0, 0, 0.12);
        margin: 8px 0;
      }

      /* Remove top margin from first element and bottom margin from last */
      > *:first-child {
        margin-top: 0;
      }

      > *:last-child {
        margin-bottom: 0;
      }
    }

    .sources {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
    }

    .sources-label {
      font-size: 12px;
      font-weight: 500;
      opacity: 0.7;
    }

    .source-chip {
      font-size: 11px;
      background-color: rgba(0, 0, 0, 0.08);
      padding: 2px 8px;
      border-radius: 12px;
    }
  `],
})
export class MessageBubbleComponent {
  message = input.required<ChatMessage>();
}
