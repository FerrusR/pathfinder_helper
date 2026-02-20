import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  function makeToken(payload: object): string {
    const encoded = btoa(JSON.stringify(payload));
    return `header.${encoded}.signature`;
  }

  beforeEach(() => {
    localStorage.clear();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: Router, useValue: routerSpy }],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('getToken / setToken', () => {
    it('should return null when no token is stored', () => {
      expect(service.getToken()).toBeNull();
    });

    it('should store and retrieve a token', () => {
      service.setToken('my-token');
      expect(service.getToken()).toBe('my-token');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token exists', () => {
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should return true when a token exists', () => {
      service.setToken('some-token');
      expect(service.isAuthenticated()).toBeTrue();
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when no token', () => {
      expect(service.getCurrentUser()).toBeNull();
    });

    it('should decode a valid JWT and return the user', () => {
      const payload = { sub: 'user-1', email: 'test@example.com', displayName: 'Tester', role: 'PLAYER' };
      service.setToken(makeToken(payload));

      expect(service.getCurrentUser()).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Tester',
        role: 'PLAYER',
      });
    });

    it('should return null for a malformed token', () => {
      service.setToken('not-a-jwt');
      expect(service.getCurrentUser()).toBeNull();
    });
  });

  describe('login', () => {
    it('should POST credentials and store the token', () => {
      const credentials = { email: 'a@b.com', password: 'pass' };
      const mockUser = { id: '1', email: 'a@b.com', role: 'PLAYER', displayName: null };
      const response = { accessToken: 'jwt-token', user: mockUser };

      let result: any;
      service.login(credentials).subscribe((r) => (result = r));

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush(response);

      expect(localStorage.getItem('auth_token')).toBe('jwt-token');
      expect(result).toEqual(response);
    });

    it('should emit the user on currentUser$ after login', () => {
      const payload = { sub: '1', email: 'a@b.com', displayName: 'Alice', role: 'PLAYER' };
      const mockUser = { id: '1', email: 'a@b.com', role: 'PLAYER', displayName: 'Alice' };
      const response = { accessToken: makeToken(payload), user: mockUser };

      let emittedUser: any = 'initial';
      service.currentUser$.subscribe((u) => (emittedUser = u));

      service.login({ email: 'a@b.com', password: 'pass' }).subscribe();
      httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush(response);

      expect(emittedUser).toEqual(mockUser);
    });
  });

  describe('register', () => {
    it('should POST registration data and store the token', () => {
      const data = { email: 'a@b.com', password: 'pass123', inviteToken: 'invite-tok' };
      const mockUser = { id: '2', email: 'a@b.com', role: 'PLAYER', displayName: null };
      const response = { accessToken: 'new-jwt', user: mockUser };

      service.register(data).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
      expect(req.request.method).toBe('POST');
      req.flush(response);

      expect(localStorage.getItem('auth_token')).toBe('new-jwt');
    });

    it('should emit the user on currentUser$ after register', () => {
      const payload = { sub: '2', email: 'a@b.com', displayName: null, role: 'PLAYER' };
      const mockUser = { id: '2', email: 'a@b.com', role: 'PLAYER', displayName: null };
      const response = { accessToken: makeToken(payload), user: mockUser };

      let emittedUser: any = 'initial';
      service.currentUser$.subscribe((u) => (emittedUser = u));

      service.register({ email: 'a@b.com', password: 'pass123', inviteToken: 'tok' }).subscribe();
      httpMock.expectOne(`${environment.apiUrl}/auth/register`).flush(response);

      expect(emittedUser).toEqual(mockUser);
    });
  });

  describe('getInviteDetails', () => {
    it('should GET invite details by token', () => {
      let result: any;
      service.getInviteDetails('invite-tok').subscribe((r) => (result = r));

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/invite/invite-tok`);
      expect(req.request.method).toBe('GET');
      req.flush({ email: 'invited@example.com' });

      expect(result).toEqual({ email: 'invited@example.com' });
    });
  });

  describe('logout', () => {
    it('should clear the token from localStorage', () => {
      service.setToken('some-token');
      service.logout();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should emit null on currentUser$', () => {
      let emittedUser: any = 'initial';
      service.currentUser$.subscribe((u) => (emittedUser = u));

      service.logout();

      expect(emittedUser).toBeNull();
    });

    it('should navigate to /login', () => {
      service.logout();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
