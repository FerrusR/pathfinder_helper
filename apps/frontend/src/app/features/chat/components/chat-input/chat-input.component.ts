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
        color="primary"
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
    }

    .input-field {
      flex: 1;
    }

    .send-button {
      margin-bottom: 20px;
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
