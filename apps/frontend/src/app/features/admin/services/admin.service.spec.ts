import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AdminService } from './admin.service';
import { environment } from '../../../../environments/environment';
import { User, Invite } from '../../../core/models/user.model';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  const mockUser: User = {
    id: '1',
    email: 'alice@example.com',
    role: 'PLAYER',
    displayName: 'Alice',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockInvite: Invite = {
    id: 'inv-1',
    email: 'bob@example.com',
    token: 'invite-token',
    createdBy: '1',
    creator: { id: '1', email: 'admin@example.com', displayName: 'Admin' },
    expiresAt: '2099-01-01T00:00:00Z',
    usedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('getUsers', () => {
    it('should GET all users', () => {
      let result: User[] = [];
      service.getUsers().subscribe((u) => (result = u));

      const req = httpMock.expectOne(`${environment.apiUrl}/users`);
      expect(req.request.method).toBe('GET');
      req.flush([mockUser]);

      expect(result).toEqual([mockUser]);
    });
  });

  describe('updateUserRole', () => {
    it('should PATCH user role', () => {
      let result: User | undefined;
      service.updateUserRole('1', 'ADMIN').subscribe((u) => (result = u));

      const req = httpMock.expectOne(`${environment.apiUrl}/users/1/role`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ role: 'ADMIN' });
      req.flush({ ...mockUser, role: 'ADMIN' });

      expect(result?.role).toBe('ADMIN');
    });
  });

  describe('deleteUser', () => {
    it('should DELETE a user', () => {
      let called = false;
      service.deleteUser('1').subscribe(() => (called = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/users/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(called).toBeTrue();
    });
  });

  describe('getInvites', () => {
    it('should GET all invites', () => {
      let result: Invite[] = [];
      service.getInvites().subscribe((i) => (result = i));

      const req = httpMock.expectOne(`${environment.apiUrl}/users/invites`);
      expect(req.request.method).toBe('GET');
      req.flush([mockInvite]);

      expect(result).toEqual([mockInvite]);
    });
  });

  describe('createInvite', () => {
    it('should POST to create an invite', () => {
      let result: Invite | undefined;
      service.createInvite('new@example.com').subscribe((i) => (result = i));

      const req = httpMock.expectOne(`${environment.apiUrl}/users/invites`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'new@example.com' });
      req.flush(mockInvite);

      expect(result).toEqual(mockInvite);
    });
  });

  describe('revokeInvite', () => {
    it('should DELETE an invite', () => {
      let called = false;
      service.revokeInvite('inv-1').subscribe(() => (called = true));

      const req = httpMock.expectOne(`${environment.apiUrl}/users/invites/inv-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(called).toBeTrue();
    });
  });
});
