import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [AsyncPipe, RouterLink, MatToolbarModule, MatButtonModule],
  template: `
    @if (authService.currentUser$ | async; as user) {
      <mat-toolbar class="navbar">
        <span class="app-title">Pathfinder Rule Explorer</span>
        <span class="spacer"></span>
        @if (user.role === 'ADMIN') {
          <a mat-button routerLink="/admin" class="nav-link">Admin</a>
        }
        <span class="username">{{ user.displayName ?? user.email }}</span>
        <button mat-button (click)="authService.logout()" class="logout-btn">Logout</button>
      </mat-toolbar>
    }
  `,
  styles: [`
    .navbar {
      background: linear-gradient(135deg, #8b1a1a, #6b1414);
      border-bottom: 2px solid #c9a84c;
      color: #f4e8c1;
      height: 56px;
    }

    .app-title {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .spacer {
      flex: 1;
    }

    .username {
      font-size: 13px;
      color: #e8dcc8;
      opacity: 0.8;
      margin-right: 8px;
    }

    .nav-link {
      color: #f4e8c1 !important;
      font-size: 13px;
      margin-right: 4px;
    }

    .logout-btn {
      color: #e8dcc8 !important;
      font-size: 13px;
      opacity: 0.8;

      &:hover {
        opacity: 1;
      }
    }
  `],
})
export class NavbarComponent {
  readonly authService = inject(AuthService);
}
