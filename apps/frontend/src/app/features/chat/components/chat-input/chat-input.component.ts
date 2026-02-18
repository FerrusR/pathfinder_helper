import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule],
  template: `
    <div class="input-row">
      <mat-form-field appearance="outline" class="input-field">
        <mat-label>Ask about Pathfinder 2e rules...</mat-label>
        <input
          matInput
          [(ngModel)]="value"
          (keydown.enter)="submit()"
          [disabled]="disabled()"
        />
      </mat-form-field>
      <button
        mat-icon-button
        class="send-button"
        (click)="submit()"
        [disabled]="disabled() || !value.trim()"
      >
        <mat-icon>send</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px 16px;
      border-top: 1px solid #4a3828;
      background-color: rgba(0, 0, 0, 0.15);
    }

    .input-field {
      flex: 1;
    }

    .send-button {
      color: #c9a84c;
      margin-bottom: 20px;

      &:hover:not(:disabled) {
        color: #f4e8c1;
        background-color: rgba(139, 26, 26, 0.3);
      }

      &:disabled {
        color: #4a3828;
      }
    }
  `],
})
export class ChatInputComponent {
  disabled = input(false);
  messageSubmitted = output<string>();

  value = '';

  submit(): void {
    const trimmed = this.value.trim();
    if (!trimmed || this.disabled()) return;
    this.messageSubmitted.emit(trimmed);
    this.value = '';
  }
}
