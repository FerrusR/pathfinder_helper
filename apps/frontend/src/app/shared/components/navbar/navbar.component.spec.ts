import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { NavbarComponent } from './navbar.component';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let currentUser$: BehaviorSubject<User | null>;

  const adminUser: User = { id: '1', email: 'admin@example.com', role: 'ADMIN', displayName: 'Admin User' };
  const playerUser: User = { id: '2', email: 'player@example.com', role: 'PLAYER', displayName: null };

  beforeEach(async () => {
    currentUser$ = new BehaviorSubject<User | null>(adminUser);

    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', ['logout'], {
      currentUser$: currentUser$.asObservable(),
    });

    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('when user is logged in', () => {
    it('should render the toolbar', () => {
      const toolbar = fixture.nativeElement.querySelector('mat-toolbar');
      expect(toolbar).toBeTruthy();
    });

    it('should display the displayName when available', () => {
      const username = fixture.nativeElement.querySelector('.username');
      expect(username.textContent.trim()).toBe('Admin User');
    });

    it('should display email when displayName is null', () => {
      currentUser$.next(playerUser);
      fixture.detectChanges();

      const username = fixture.nativeElement.querySelector('.username');
      expect(username.textContent.trim()).toBe('player@example.com');
    });
  });

  describe('admin link', () => {
    it('should show Admin link for ADMIN role', () => {
      const adminLink = fixture.nativeElement.querySelector('a[routerLink="/admin"]');
      expect(adminLink).toBeTruthy();
    });

    it('should hide Admin link for non-ADMIN role', () => {
      currentUser$.next(playerUser);
      fixture.detectChanges();

      const adminLink = fixture.nativeElement.querySelector('a[routerLink="/admin"]');
      expect(adminLink).toBeNull();
    });
  });

  describe('logout', () => {
    it('should call authService.logout when logout button is clicked', () => {
      const logoutBtn = fixture.nativeElement.querySelector('.logout-btn');
      logoutBtn.click();

      expect(mockAuthService.logout).toHaveBeenCalled();
    });
  });

  describe('when no user is logged in', () => {
    it('should not render the toolbar', () => {
      currentUser$.next(null);
      fixture.detectChanges();

      const toolbar = fixture.nativeElement.querySelector('mat-toolbar');
      expect(toolbar).toBeNull();
    });
  });
});
