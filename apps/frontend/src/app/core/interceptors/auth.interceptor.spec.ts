import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let mockAuthService: jasmine.SpyObj<AuthService>;

  function setup(token: string | null): void {
    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', ['getToken', 'logout']);
    mockAuthService.getToken.and.returnValue(token);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('should add Authorization header when a token exists', () => {
    setup('my-jwt-token');

    http.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
    req.flush({});
  });

  it('should not add Authorization header when no token', () => {
    setup(null);

    http.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should call logout on a 401 response', () => {
    setup('my-jwt-token');

    http.get('/api/test').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/test');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should propagate the error after a 401', () => {
    setup('my-jwt-token');

    let caughtError: any;
    http.get('/api/test').subscribe({ error: (e) => (caughtError = e) });

    const req = httpMock.expectOne('/api/test');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(caughtError).toBeTruthy();
    expect(caughtError.status).toBe(401);
  });

  it('should not call logout on non-401 errors', () => {
    setup('my-jwt-token');

    http.get('/api/test').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/test');
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    expect(mockAuthService.logout).not.toHaveBeenCalled();
  });
});
