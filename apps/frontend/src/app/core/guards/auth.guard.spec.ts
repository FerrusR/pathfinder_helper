import { TestBed } from '@angular/core/testing';
import { GuardResult, MaybeAsync, Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);
    mockRouter = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  function runGuard(): MaybeAsync<GuardResult> {
    return TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
  }

  it('should return true when the user is authenticated', () => {
    mockAuthService.isAuthenticated.and.returnValue(true);

    expect(runGuard()).toBeTrue();
  });

  it('should redirect to /login when not authenticated', () => {
    mockAuthService.isAuthenticated.and.returnValue(false);
    const loginTree = {} as UrlTree;
    mockRouter.createUrlTree.and.returnValue(loginTree);

    const result = runGuard();

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(loginTree);
  });
});
