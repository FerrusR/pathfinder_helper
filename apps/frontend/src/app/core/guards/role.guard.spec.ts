import { TestBed } from '@angular/core/testing';
import { GuardResult, MaybeAsync, Router, UrlTree } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';

describe('roleGuard', () => {
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    mockRouter = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  function runGuard(...roles: string[]): MaybeAsync<GuardResult> {
    return TestBed.runInInjectionContext(() => roleGuard(...roles)({} as any, {} as any));
  }

  it('should return true when the user has a matching role', () => {
    const user: User = { id: '1', email: 'a@b.com', role: 'ADMIN' };
    mockAuthService.getCurrentUser.and.returnValue(user);

    expect(runGuard('ADMIN', 'GAMEMASTER')).toBeTrue();
  });

  it('should redirect to /chat when the user does not have the required role', () => {
    const user: User = { id: '1', email: 'a@b.com', role: 'PLAYER' };
    mockAuthService.getCurrentUser.and.returnValue(user);
    const chatTree = {} as UrlTree;
    mockRouter.createUrlTree.and.returnValue(chatTree);

    const result = runGuard('ADMIN');

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/chat']);
    expect(result).toBe(chatTree);
  });

  it('should redirect to /chat when no user is logged in', () => {
    mockAuthService.getCurrentUser.and.returnValue(null);
    const chatTree = {} as UrlTree;
    mockRouter.createUrlTree.and.returnValue(chatTree);

    const result = runGuard('ADMIN');

    expect(result).toBe(chatTree);
  });
});
