import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard = (...roles: string[]): CanActivateFn => () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();

  if (user && roles.includes(user.role)) {
    return true;
  }

  return router.createUrlTree(['/chat']);
};
