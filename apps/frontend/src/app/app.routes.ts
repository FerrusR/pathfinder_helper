import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page.component').then(
        (m) => m.LoginPageComponent,
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/pages/register-page/register-page.component').then(
        (m) => m.RegisterPageComponent,
      ),
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/chat/pages/chat-page/chat-page.component').then(
        (m) => m.ChatPageComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('ADMIN')],
    loadComponent: () =>
      import('./features/admin/pages/admin-page/admin-page.component').then(
        (m) => m.AdminPageComponent,
      ),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
