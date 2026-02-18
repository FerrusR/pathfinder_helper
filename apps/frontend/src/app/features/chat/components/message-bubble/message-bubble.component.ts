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
      border-radius: 8px;
      margin-bottom: 8px;
      word-wrap: break-word;
    }

    .user {
      margin-left: auto;
      background: linear-gradient(135deg, #8b1a1a, #a02020);
      color: #f4e8c1;
      border: 1px solid #b22222;
      border-bottom-right-radius: 2px;
      white-space: pre-wrap;
    }

    .assistant {
      margin-right: auto;
      background-color: #352a1e;
      color: #e8dcc8;
      border: 1px solid #4a3828;
      border-bottom-left-radius: 2px;
    }

    /* Markdown content styling */
    .assistant .content ::ng-deep {
      h1, h2, h3, h4, h5, h6 {
        margin: 8px 0 4px;
        line-height: 1.3;
        color: #c9a84c;
      }

      h1 { font-size: 1.3em; }
      h2 { font-size: 1.2em; }
      h3 { font-size: 1.1em; }

      p {
        margin: 4px 0;
      }

      strong, b {
        color: #f4e8c1;
      }

      ul, ol {
        margin: 4px 0;
        padding-left: 20px;
      }

      li {
        margin: 2px 0;
      }

      code {
        background-color: rgba(0, 0, 0, 0.3);
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 0.9em;
        color: #c9a84c;
      }

      pre {
        background-color: rgba(0, 0, 0, 0.3);
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #4a3828;
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
        border: 1px solid #4a3828;
        padding: 4px 8px;
        text-align: left;
      }

      th {
        background-color: rgba(139, 26, 26, 0.25);
        color: #c9a84c;
        font-weight: 600;
      }

      blockquote {
        margin: 6px 0;
        padding: 4px 12px;
        border-left: 3px solid #8b1a1a;
        color: #a89880;
      }

      hr {
        border: none;
        border-top: 1px solid #4a3828;
        margin: 8px 0;
      }

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
      border-top: 1px solid rgba(201, 168, 76, 0.2);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
    }

    .sources-label {
      font-size: 12px;
      font-weight: 500;
      color: #a89880;
    }

    .source-chip {
      font-size: 11px;
      background-color: rgba(139, 26, 26, 0.3);
      color: #c9a84c;
      padding: 2px 8px;
      border-radius: 12px;
      border: 1px solid rgba(139, 26, 26, 0.4);
    }
  `],
})
export class MessageBubbleComponent {
  message = input.required<ChatMessage>();
}
