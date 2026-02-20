import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegisterPageComponent } from './register-page.component';
import { AuthService } from '../../../../core/services/auth.service';

describe('RegisterPageComponent', () => {
  let component: RegisterPageComponent;
  let fixture: ComponentFixture<RegisterPageComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;

  function createFixture(queryParams: Record<string, string> = {}): void {
    const mockRoute = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => queryParams[key] ?? null,
        },
      },
    };

    TestBed.configureTestingModule({
      imports: [RegisterPageComponent],
      providers: [
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    });

    fixture = TestBed.createComponent(RegisterPageComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAuthenticated',
      'getInviteDetails',
      'register',
    ]);
    mockAuthService.isAuthenticated.and.returnValue(false);
  });

  afterEach(() => TestBed.resetTestingModule());

  describe('ngOnInit — already authenticated', () => {
    it('should redirect to /chat if already authenticated', async () => {
      mockAuthService.isAuthenticated.and.returnValue(true);
      createFixture({ token: 'tok' });
      await TestBed.compileComponents();
      fixture.detectChanges();

      const routerSpy = spyOn(component['router'], 'navigate');
      component.ngOnInit();

      expect(routerSpy).toHaveBeenCalledWith(['/chat']);
    });
  });

  describe('ngOnInit — no token in URL', () => {
    beforeEach(async () => {
      createFixture();
      await TestBed.compileComponents();
      fixture.detectChanges();
    });

    it('should set inviteLoadError when no token in URL', () => {
      expect(component.inviteLoadError).toBe('Registration requires an invite link.');
    });

    it('should not call getInviteDetails', () => {
      expect(mockAuthService.getInviteDetails).not.toHaveBeenCalled();
    });
  });

  describe('ngOnInit — valid token', () => {
    beforeEach(async () => {
      mockAuthService.getInviteDetails.and.returnValue(of({ email: 'invited@example.com' }));
      createFixture({ token: 'valid-token' });
      await TestBed.compileComponents();
      fixture.detectChanges();
    });

    it('should call getInviteDetails with the token', () => {
      expect(mockAuthService.getInviteDetails).toHaveBeenCalledWith('valid-token');
    });

    it('should pre-fill the email field from invite details', () => {
      expect(component.form.controls.email.value).toBe('invited@example.com');
    });

    it('should clear inviteLoading after success', () => {
      expect(component.inviteLoading).toBeFalse();
    });
  });

  describe('ngOnInit — invalid/expired token', () => {
    beforeEach(async () => {
      mockAuthService.getInviteDetails.and.returnValue(
        throwError(() => ({ error: { message: 'Invite expired.' } }))
      );
      createFixture({ token: 'bad-token' });
      await TestBed.compileComponents();
      fixture.detectChanges();
    });

    it('should set inviteLoadError on failed invite load', () => {
      expect(component.inviteLoadError).toBe('Invite expired.');
    });

    it('should use fallback error message when none provided', async () => {
      TestBed.resetTestingModule();
      mockAuthService.getInviteDetails.and.returnValue(throwError(() => ({})));
      createFixture({ token: 'bad-token' });
      await TestBed.compileComponents();
      fixture.detectChanges();

      expect(component.inviteLoadError).toBe('This invite link is invalid or has expired.');
    });
  });

  describe('form validation', () => {
    beforeEach(async () => {
      mockAuthService.getInviteDetails.and.returnValue(of({ email: 'invited@example.com' }));
      createFixture({ token: 'tok' });
      await TestBed.compileComponents();
      fixture.detectChanges();
    });

    it('should be invalid initially (password and confirmPassword empty)', () => {
      expect(component.form.invalid).toBeTrue();
    });

    it('should be invalid when password is less than 8 characters', () => {
      component.form.controls.password.setValue('short');
      component.form.controls.confirmPassword.setValue('short');
      expect(component.form.invalid).toBeTrue();
    });

    it('should have passwordMismatch error when passwords differ', () => {
      component.form.controls.password.setValue('password123');
      component.form.controls.confirmPassword.setValue('different');
      expect(component.form.hasError('passwordMismatch')).toBeTrue();
    });

    it('should be valid with matching passwords of sufficient length', () => {
      component.form.controls.password.setValue('password123');
      component.form.controls.confirmPassword.setValue('password123');
      expect(component.form.valid).toBeTrue();
    });
  });

  describe('onSubmit', () => {
    beforeEach(async () => {
      mockAuthService.getInviteDetails.and.returnValue(of({ email: 'invited@example.com' }));
      createFixture({ token: 'invite-tok' });
      await TestBed.compileComponents();
      fixture.detectChanges();
    });

    it('should mark all fields as touched when form is invalid', () => {
      component.onSubmit();
      expect(component.form.controls.password.touched).toBeTrue();
    });

    it('should not call authService.register when form is invalid', () => {
      component.onSubmit();
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should call authService.register with correct data', () => {
      mockAuthService.register.and.returnValue(of({ accessToken: 'tok', user: { id: '1', email: 'invited@example.com', role: 'PLAYER', displayName: null } }));
      component.form.controls.password.setValue('password123');
      component.form.controls.confirmPassword.setValue('password123');

      component.onSubmit();

      expect(mockAuthService.register).toHaveBeenCalledWith({
        email: 'invited@example.com',
        password: 'password123',
        displayName: undefined,
        inviteToken: 'invite-tok',
      });
    });

    it('should include displayName when provided', () => {
      mockAuthService.register.and.returnValue(of({ accessToken: 'tok', user: { id: '1', email: 'invited@example.com', role: 'PLAYER', displayName: 'Alice' } }));
      component.form.controls.displayName.setValue('Alice');
      component.form.controls.password.setValue('password123');
      component.form.controls.confirmPassword.setValue('password123');

      component.onSubmit();

      expect(mockAuthService.register).toHaveBeenCalledWith(
        jasmine.objectContaining({ displayName: 'Alice' })
      );
    });

    it('should set errorMessage and clear loading on register error', () => {
      mockAuthService.register.and.returnValue(throwError(() => ({ error: { message: 'Email already used.' } })));
      component.form.controls.password.setValue('password123');
      component.form.controls.confirmPassword.setValue('password123');

      component.onSubmit();

      expect(component.errorMessage).toBe('Email already used.');
      expect(component.loading).toBeFalse();
    });
  });
});
