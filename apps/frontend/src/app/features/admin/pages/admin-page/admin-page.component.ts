import { Component, inject, OnInit } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { Invite, User } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminService } from '../../services/admin.service';

type InviteStatus = 'used' | 'expired' | 'pending';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    TitleCasePipe,
    MatTabsModule,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  template: `
    <div class="admin-container">
      <div class="admin-card">
        <div class="admin-header">
          <span class="header-title">Admin Panel</span>
        </div>

        <mat-tab-group class="admin-tabs">

          <!-- ─── Users Tab ─── -->
          <mat-tab label="Users">
            <div class="tab-content">
              @if (usersLoading) {
                <div class="loading-state"><mat-spinner diameter="36" /></div>
              } @else {
                @if (usersError) {
                  <p class="error-banner">{{ usersError }}</p>
                }
                <table mat-table [dataSource]="users" class="data-table">

                  <ng-container matColumnDef="email">
                    <th mat-header-cell *matHeaderCellDef>Email</th>
                    <td mat-cell *matCellDef="let user">{{ user.email }}</td>
                  </ng-container>

                  <ng-container matColumnDef="displayName">
                    <th mat-header-cell *matHeaderCellDef>Display Name</th>
                    <td mat-cell *matCellDef="let user">{{ user.displayName ?? '—' }}</td>
                  </ng-container>

                  <ng-container matColumnDef="role">
                    <th mat-header-cell *matHeaderCellDef>Role</th>
                    <td mat-cell *matCellDef="let user">
                      <mat-select
                        [value]="user.role"
                        [disabled]="user.id === currentUserId"
                        (selectionChange)="onRoleChange(user, $event.value)"
                        class="role-select"
                      >
                        @for (role of roles; track role) {
                          <mat-option [value]="role">{{ role }}</mat-option>
                        }
                      </mat-select>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="createdAt">
                    <th mat-header-cell *matHeaderCellDef>Joined</th>
                    <td mat-cell *matCellDef="let user">{{ user.createdAt | date:'mediumDate' }}</td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let user" class="actions-cell">
                      <button
                        mat-icon-button
                        color="warn"
                        title="Delete user"
                        [disabled]="user.id === currentUserId"
                        (click)="onDeleteUser(user)"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="userColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: userColumns;"></tr>
                </table>

                @if (!usersLoading && users.length === 0) {
                  <p class="empty-state">No users found.</p>
                }
              }
            </div>
          </mat-tab>

          <!-- ─── Invites Tab ─── -->
          <mat-tab label="Invites">
            <div class="tab-content">

              <form [formGroup]="inviteForm" (ngSubmit)="onCreateInvite()" class="invite-form">
                <mat-form-field appearance="outline" class="invite-email-field">
                  <mat-label>Email address</mat-label>
                  <input matInput type="email" formControlName="email" placeholder="player@example.com" />
                  @if (inviteForm.controls.email.invalid && inviteForm.controls.email.touched) {
                    <mat-error>Enter a valid email address</mat-error>
                  }
                </mat-form-field>
                <button
                  mat-raised-button
                  color="primary"
                  type="submit"
                  class="create-invite-btn"
                  [disabled]="inviteSubmitting"
                >
                  @if (inviteSubmitting) {
                    <mat-spinner diameter="18" />
                  } @else {
                    Create Invite
                  }
                </button>
              </form>

              @if (inviteFormError) {
                <p class="error-banner">{{ inviteFormError }}</p>
              }

              <mat-divider class="section-divider" />

              @if (invitesLoading) {
                <div class="loading-state"><mat-spinner diameter="36" /></div>
              } @else {
                @if (invitesError) {
                  <p class="error-banner">{{ invitesError }}</p>
                }
                <table mat-table [dataSource]="invites" class="data-table">

                  <ng-container matColumnDef="email">
                    <th mat-header-cell *matHeaderCellDef>Email</th>
                    <td mat-cell *matCellDef="let invite">{{ invite.email }}</td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let invite">
                      <span class="status-badge status-{{ getInviteStatus(invite) }}">
                        {{ getInviteStatus(invite) | titlecase }}
                      </span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="expiresAt">
                    <th mat-header-cell *matHeaderCellDef>Expires</th>
                    <td mat-cell *matCellDef="let invite">{{ invite.expiresAt | date:'mediumDate' }}</td>
                  </ng-container>

                  <ng-container matColumnDef="createdBy">
                    <th mat-header-cell *matHeaderCellDef>Created By</th>
                    <td mat-cell *matCellDef="let invite">
                      {{ invite.creator?.displayName ?? invite.creator?.email }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let invite" class="actions-cell">
                      <button mat-icon-button title="Copy invite link" (click)="copyInviteLink(invite)">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      @if (getInviteStatus(invite) === 'pending') {
                        <button
                          mat-icon-button
                          color="warn"
                          title="Revoke invite"
                          (click)="onRevokeInvite(invite)"
                        >
                          <mat-icon>block</mat-icon>
                        </button>
                      }
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="inviteColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: inviteColumns;"></tr>
                </table>

                @if (!invitesLoading && invites.length === 0) {
                  <p class="empty-state">No invites found.</p>
                }
              }
            </div>
          </mat-tab>

        </mat-tab-group>
      </div>
    </div>
  `,
  styles: [`
    .admin-container {
      display: flex;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 16px;
      box-sizing: border-box;
      background: radial-gradient(ellipse at center top, #2a1a14 0%, #1a1410 70%);
    }

    .admin-card {
      width: 100%;
      max-width: 1000px;
      background-color: #2a2118;
      border: 1px solid #4a3828;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(201, 168, 76, 0.08);
      overflow: hidden;
      align-self: flex-start;
    }

    .admin-header {
      display: flex;
      align-items: center;
      padding: 12px 20px;
      background: linear-gradient(135deg, #8b1a1a, #6b1414);
      border-bottom: 2px solid #c9a84c;
    }

    .header-title {
      font-size: 18px;
      font-weight: 600;
      color: #f4e8c1;
      letter-spacing: 0.5px;
    }

    .tab-content {
      padding: 20px;
    }

    .loading-state {
      display: flex;
      justify-content: center;
      padding: 40px 0;
    }

    .error-banner {
      color: #f0a0a0;
      font-size: 13px;
      margin: 0 0 16px;
      padding: 8px 12px;
      background-color: rgba(139, 26, 26, 0.3);
      border-radius: 4px;
      border: 1px solid rgba(139, 26, 26, 0.4);
    }

    .empty-state {
      text-align: center;
      color: #6b5a45;
      padding: 32px 0;
      font-size: 14px;
    }

    /* ─── Table ─── */
    .data-table {
      width: 100%;
      background: transparent !important;
    }

    .actions-cell {
      white-space: nowrap;
      text-align: right;
    }

    .role-select {
      font-size: 13px;
    }

    /* ─── Status badges ─── */
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-pending {
      background-color: rgba(76, 175, 80, 0.2);
      color: #81c784;
      border: 1px solid rgba(76, 175, 80, 0.4);
    }

    .status-used {
      background-color: rgba(158, 158, 158, 0.15);
      color: #9e9e9e;
      border: 1px solid rgba(158, 158, 158, 0.3);
    }

    .status-expired {
      background-color: rgba(255, 152, 0, 0.15);
      color: #ffb74d;
      border: 1px solid rgba(255, 152, 0, 0.3);
    }

    /* ─── Invite form ─── */
    .invite-form {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }

    .invite-email-field {
      flex: 1;
      min-width: 240px;
    }

    .create-invite-btn {
      height: 56px;
      background-color: #8b1a1a !important;
      color: #f4e8c1 !important;
      min-width: 140px;

      &:hover:not([disabled]) {
        background-color: #a52020 !important;
      }

      mat-spinner {
        display: inline-block;
      }
    }

    .section-divider {
      margin: 20px 0;
      border-color: #4a3828 !important;
    }

    /* ─── Material overrides (scoped) ─── */
    ::ng-deep .admin-tabs .mat-mdc-tab-header {
      background-color: #221910;
      border-bottom: 1px solid #4a3828;
    }

    ::ng-deep .admin-tabs .mat-mdc-tab .mdc-tab__text-label {
      color: #a89070;
    }

    ::ng-deep .admin-tabs .mat-mdc-tab.mdc-tab--active .mdc-tab__text-label {
      color: #f4e8c1;
    }

    ::ng-deep .admin-tabs .mdc-tab-indicator__content--underline {
      border-color: #c9a84c;
    }

    ::ng-deep .data-table .mat-mdc-header-cell {
      background-color: #221910;
      color: #a89070;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom-color: #4a3828;
    }

    ::ng-deep .data-table .mat-mdc-cell {
      background-color: transparent;
      color: #e8dcc8;
      border-bottom-color: #3a2a1c;
      font-size: 13px;
    }

    ::ng-deep .data-table .mat-mdc-row:hover .mat-mdc-cell {
      background-color: rgba(201, 168, 76, 0.05);
    }

    ::ng-deep .data-table .mat-mdc-no-data-row {
      color: #6b5a45;
    }
  `],
})
export class AdminPageComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly currentUserId = this.authService.getCurrentUser()?.id;
  readonly roles = ['ADMIN', 'PLAYER'];
  readonly userColumns = ['email', 'displayName', 'role', 'createdAt', 'actions'];
  readonly inviteColumns = ['email', 'status', 'expiresAt', 'createdBy', 'actions'];

  users: User[] = [];
  usersLoading = false;
  usersError = '';

  invites: Invite[] = [];
  invitesLoading = false;
  invitesError = '';

  inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  inviteSubmitting = false;
  inviteFormError = '';

  ngOnInit(): void {
    this.loadUsers();
    this.loadInvites();
  }

  loadUsers(): void {
    this.usersLoading = true;
    this.usersError = '';
    this.adminService.getUsers().subscribe({
      next: (users) => { this.users = users; this.usersLoading = false; },
      error: (err) => { this.usersError = err?.error?.message ?? 'Failed to load users.'; this.usersLoading = false; },
    });
  }

  onRoleChange(user: User, newRole: string): void {
    const originalRole = user.role;
    user.role = newRole;
    this.adminService.updateUserRole(user.id, newRole).subscribe({
      next: (updated) => { user.role = updated.role; },
      error: (err) => {
        user.role = originalRole;
        this.usersError = err?.error?.message ?? 'Failed to update role.';
      },
    });
  }

  onDeleteUser(user: User): void {
    if (!window.confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    this.adminService.deleteUser(user.id).subscribe({
      next: () => { this.users = this.users.filter((u) => u.id !== user.id); },
      error: (err) => { this.usersError = err?.error?.message ?? 'Failed to delete user.'; },
    });
  }

  loadInvites(): void {
    this.invitesLoading = true;
    this.invitesError = '';
    this.adminService.getInvites().subscribe({
      next: (invites) => { this.invites = invites; this.invitesLoading = false; },
      error: (err) => { this.invitesError = err?.error?.message ?? 'Failed to load invites.'; this.invitesLoading = false; },
    });
  }

  onCreateInvite(): void {
    if (this.inviteForm.invalid) { this.inviteForm.markAllAsTouched(); return; }
    this.inviteSubmitting = true;
    this.inviteFormError = '';
    const { email } = this.inviteForm.getRawValue();
    this.adminService.createInvite(email).subscribe({
      next: () => { this.inviteForm.reset(); this.inviteSubmitting = false; this.loadInvites(); },
      error: (err) => {
        this.inviteFormError = err?.error?.message ?? 'Failed to create invite.';
        this.inviteSubmitting = false;
      },
    });
  }

  copyInviteLink(invite: Invite): void {
    const link = `${window.location.origin}/register?token=${invite.token}`;
    navigator.clipboard.writeText(link).then(() => {
      this.snackBar.open('Invite link copied', undefined, { duration: 2000 });
    });
  }

  onRevokeInvite(invite: Invite): void {
    if (!window.confirm(`Revoke invite for "${invite.email}"?`)) return;
    this.adminService.revokeInvite(invite.id).subscribe({
      next: () => { this.invites = this.invites.filter((i) => i.id !== invite.id); },
      error: (err) => { this.invitesError = err?.error?.message ?? 'Failed to revoke invite.'; },
    });
  }

  getInviteStatus(invite: Invite): InviteStatus {
    if (invite.usedAt) return 'used';
    if (new Date(invite.expiresAt) < new Date()) return 'expired';
    return 'pending';
  }
}
