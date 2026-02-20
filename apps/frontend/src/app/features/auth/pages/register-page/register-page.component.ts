import { Component, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/services/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register-page',
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
    <div class="register-container">
      <mat-card class="register-card">
        <mat-card-header>
          <mat-card-title class="app-title">Pathfinder Rule Explorer</mat-card-title>
          <mat-card-subtitle class="app-subtitle">Create your account</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          @if (inviteLoadError) {
            <div class="no-invite-message">
              <p>{{ inviteLoadError }}</p>
              <p>Contact your administrator to receive a valid invite link.</p>
            </div>
          } @else if (inviteLoading) {
            <div class="invite-loading">
              <mat-spinner diameter="32" />
            </div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" autocomplete="email" [readonly]="true" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Display Name (optional)</mat-label>
                <input matInput type="text" formControlName="displayName" autocomplete="nickname" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Password</mat-label>
                <input matInput type="password" formControlName="password" autocomplete="new-password" />
                @if (form.controls.password.invalid && form.controls.password.touched) {
                  <mat-error>Password must be at least 8 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Confirm Password</mat-label>
                <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
                @if (form.controls.confirmPassword.touched && form.hasError('passwordMismatch')) {
                  <mat-error>Passwords do not match</mat-error>
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
                  Create Account
                }
              </button>
            </form>
          }
        </mat-card-content>

        <mat-card-footer class="card-footer">
          <a routerLink="/login" class="login-link">Already have an account? Sign in</a>
        </mat-card-footer>
      </mat-card>
    </div>
  `,
  styles: [`
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
      box-sizing: border-box;
      background: radial-gradient(ellipse at center top, #2a1a14 0%, #1a1410 70%);
    }

    .register-card {
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

    .invite-loading {
      display: flex;
      justify-content: center;
      padding: 24px 0;
    }

    .no-invite-message {
      text-align: center;
      color: #a89070;
      padding: 16px 0;

      p {
        margin: 4px 0;
        font-size: 14px;
      }
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

    .login-link {
      font-size: 13px;
      color: #c9a84c;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  `],
})
export class RegisterPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private inviteToken: string | null = null;

  form = this.fb.nonNullable.group(
    {
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      displayName: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  inviteLoading = false;
  inviteLoadError = '';
  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/chat']);
      return;
    }

    this.inviteToken = this.route.snapshot.queryParamMap.get('token');

    if (!this.inviteToken) {
      this.inviteLoadError = 'Registration requires an invite link.';
      return;
    }

    this.inviteLoading = true;
    this.authService.getInviteDetails(this.inviteToken).subscribe({
      next: ({ email }) => {
        this.form.controls.email.setValue(email);
        this.inviteLoading = false;
      },
      error: (err) => {
        this.inviteLoadError =
          err?.error?.message ?? 'This invite link is invalid or has expired.';
        this.inviteLoading = false;
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { email, password, displayName } = this.form.getRawValue();

    this.authService
      .register({
        email,
        password,
        displayName: displayName || undefined,
        inviteToken: this.inviteToken!,
      })
      .subscribe({
        next: () => this.router.navigate(['/chat']),
        error: (err) => {
          this.errorMessage =
            err?.error?.message ?? 'Registration failed. Please try again.';
          this.loading = false;
        },
      });
  }
}
