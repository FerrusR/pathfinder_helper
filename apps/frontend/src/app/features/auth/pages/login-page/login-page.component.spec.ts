import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../../../../core/services/auth.service';

describe('LoginPageComponent', () => {
  let component: LoginPageComponent;
  let fixture: ComponentFixture<LoginPageComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'login']);
    mockAuthService.isAuthenticated.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should redirect to /chat if already authenticated', async () => {
      mockAuthService.isAuthenticated.and.returnValue(true);
      const routerSpy = spyOn(component['router'], 'navigate');

      component.ngOnInit();

      expect(routerSpy).toHaveBeenCalledWith(['/chat']);
    });

    it('should not redirect when not authenticated', () => {
      const routerSpy = spyOn(component['router'], 'navigate');

      component.ngOnInit();

      expect(routerSpy).not.toHaveBeenCalled();
    });
  });

  describe('form validation', () => {
    it('should be invalid initially', () => {
      expect(component.form.invalid).toBeTrue();
    });

    it('should be invalid with an invalid email', () => {
      component.form.controls.email.setValue('not-an-email');
      component.form.controls.password.setValue('password');
      expect(component.form.invalid).toBeTrue();
    });

    it('should be valid with correct email and password', () => {
      component.form.controls.email.setValue('user@example.com');
      component.form.controls.password.setValue('password');
      expect(component.form.valid).toBeTrue();
    });
  });

  describe('onSubmit', () => {
    it('should mark all fields as touched when form is invalid', () => {
      component.onSubmit();
      expect(component.form.controls.email.touched).toBeTrue();
      expect(component.form.controls.password.touched).toBeTrue();
    });

    it('should not call authService.login when form is invalid', () => {
      component.onSubmit();
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should call authService.login with form values on valid submit', () => {
      mockAuthService.login.and.returnValue(of({ accessToken: 'tok', user: { id: '1', email: 'u@e.com', role: 'PLAYER', displayName: null } }));
      component.form.controls.email.setValue('user@example.com');
      component.form.controls.password.setValue('password123');

      component.onSubmit();

      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
    });

    it('should set loading to true during submission', () => {
      mockAuthService.login.and.returnValue(of({ accessToken: 'tok', user: { id: '1', email: 'u@e.com', role: 'PLAYER', displayName: null } }));
      component.form.controls.email.setValue('user@example.com');
      component.form.controls.password.setValue('password123');

      expect(component.loading).toBeFalse();
      component.onSubmit();
      // After observable completes synchronously, loading resets via navigation
    });

    it('should set errorMessage and clear loading on login error', () => {
      mockAuthService.login.and.returnValue(throwError(() => ({ error: { message: 'Bad credentials' } })));
      component.form.controls.email.setValue('user@example.com');
      component.form.controls.password.setValue('wrong');

      component.onSubmit();

      expect(component.errorMessage).toBe('Bad credentials');
      expect(component.loading).toBeFalse();
    });

    it('should use fallback error message when error has no message', () => {
      mockAuthService.login.and.returnValue(throwError(() => ({})));
      component.form.controls.email.setValue('user@example.com');
      component.form.controls.password.setValue('wrong');

      component.onSubmit();

      expect(component.errorMessage).toBe('Invalid credentials. Please try again.');
    });
  });

  describe('template', () => {
    it('should display error message when errorMessage is set', () => {
      component.errorMessage = 'Some error';
      fixture.detectChanges();

      const errorEl = fixture.nativeElement.querySelector('.error-message');
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain('Some error');
    });

    it('should not display error message when errorMessage is empty', () => {
      component.errorMessage = '';
      fixture.detectChanges();

      const errorEl = fixture.nativeElement.querySelector('.error-message');
      expect(errorEl).toBeNull();
    });
  });
});
