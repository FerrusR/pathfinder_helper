import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title class="app-title">Pathfinder Rule Explorer</mat-card-title>
          <mat-card-subtitle class="app-subtitle">Sign in to continue</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
              @if (form.controls.email.invalid && form.controls.email.touched) {
                <mat-error>Enter a valid email address</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password" />
              @if (form.controls.password.invalid && form.controls.password.touched) {
                <mat-error>Password is required</mat-error>
              }
            </mat-form-field>

            @if (errorMessage) {
              <p class="error-message">{{ errorMessage }}</p>
            }

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="full-width submit-btn"
              [disabled]="loading"
            >
              @if (loading) {
                <mat-spinner diameter="20" />
              } @else {
                Sign In
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-footer class="card-footer">
          <p class="invite-note">Registration requires an invite link from an administrator.</p>
          <a routerLink="/register" class="register-link">Have an invite? Register here</a>
        </mat-card-footer>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
      box-sizing: border-box;
      background: radial-gradient(ellipse at center top, #2a1a14 0%, #1a1410 70%);
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background-color: #2a2118;
      border: 1px solid #4a3828;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(201, 168, 76, 0.08);
      padding: 8px;
    }

    .app-title {
      font-size: 20px !important;
      font-weight: 600 !important;
      color: #f4e8c1 !important;
      letter-spacing: 0.5px;
    }

    .app-subtitle {
      color: #a89070 !important;
      margin-top: 4px;
    }

    mat-card-content {
      margin-top: 24px;
    }

    .full-width {
      width: 100%;
    }

    mat-form-field {
      display: block;
      margin-bottom: 8px;
    }

    .error-message {
      color: #f0a0a0;
      font-size: 13px;
      margin: 0 0 12px;
      padding: 8px 12px;
      background-color: rgba(139, 26, 26, 0.3);
      border-radius: 4px;
      border: 1px solid rgba(139, 26, 26, 0.4);
    }

    .submit-btn {
      margin-top: 8px;
      height: 42px;
      background-color: #8b1a1a !important;
      color: #f4e8c1 !important;

      &:hover:not([disabled]) {
        background-color: #a52020 !important;
      }

      mat-spinner {
        display: inline-block;
      }
    }

    .card-footer {
      padding: 16px 16px 8px;
      text-align: center;
    }

    .invite-note {
      font-size: 12px;
      color: #6b5a45;
      margin: 0 0 8px;
    }

    .register-link {
      font-size: 13px;
      color: #c9a84c;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  `],
})
export class LoginPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/chat']);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/chat']),
      error: (err) => {
        this.errorMessage = err?.error?.message ?? 'Invalid credentials. Please try again.';
        this.loading = false;
      },
    });
  }
}
