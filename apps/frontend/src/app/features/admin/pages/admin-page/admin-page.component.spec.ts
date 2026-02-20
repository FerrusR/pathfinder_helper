import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { AdminPageComponent } from './admin-page.component';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Invite, User } from '../../../../core/models/user.model';

describe('AdminPageComponent', () => {
  let component: AdminPageComponent;
  let fixture: ComponentFixture<AdminPageComponent>;
  let mockAdminService: jasmine.SpyObj<AdminService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;

  const mockUser: User = {
    id: 'user-1',
    email: 'alice@example.com',
    role: 'PLAYER',
    displayName: 'Alice',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();
  const mockInvite: Invite = {
    id: 'inv-1',
    email: 'bob@example.com',
    token: 'invite-token',
    createdBy: 'user-1',
    creator: { id: 'user-1', email: 'admin@example.com', displayName: 'Admin' },
    expiresAt: futureDate,
    usedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    mockAdminService = jasmine.createSpyObj<AdminService>('AdminService', [
      'getUsers',
      'updateUserRole',
      'deleteUser',
      'getInvites',
      'createInvite',
      'revokeInvite',
    ]);
    mockAdminService.getUsers.and.returnValue(of([mockUser]));
    mockAdminService.getInvites.and.returnValue(of([mockInvite]));

    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    mockAuthService.getCurrentUser.and.returnValue({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });

    mockSnackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: AdminService, useValue: mockAdminService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load users on init', () => {
      expect(mockAdminService.getUsers).toHaveBeenCalled();
      expect(component.users).toEqual([mockUser]);
    });

    it('should load invites on init', () => {
      expect(mockAdminService.getInvites).toHaveBeenCalled();
      expect(component.invites).toEqual([mockInvite]);
    });

    it('should clear usersLoading after load', () => {
      expect(component.usersLoading).toBeFalse();
    });

    it('should set usersError on failed user load', () => {
      mockAdminService.getUsers.and.returnValue(throwError(() => ({ error: { message: 'Forbidden' } })));
      component.loadUsers();
      expect(component.usersError).toBe('Forbidden');
      expect(component.usersLoading).toBeFalse();
    });

    it('should use fallback message on user load error without message', () => {
      mockAdminService.getUsers.and.returnValue(throwError(() => ({})));
      component.loadUsers();
      expect(component.usersError).toBe('Failed to load users.');
    });
  });

  describe('onRoleChange', () => {
    it('should call adminService.updateUserRole', () => {
      mockAdminService.updateUserRole.and.returnValue(of({ ...mockUser, role: 'ADMIN' }));
      component.onRoleChange(mockUser, 'ADMIN');
      expect(mockAdminService.updateUserRole).toHaveBeenCalledWith('user-1', 'ADMIN');
    });

    it('should update user role on success', () => {
      const user = { ...mockUser };
      mockAdminService.updateUserRole.and.returnValue(of({ ...user, role: 'ADMIN' }));
      component.onRoleChange(user, 'ADMIN');
      expect(user.role).toBe('ADMIN');
    });

    it('should revert role and set error on failure', () => {
      const user = { ...mockUser, role: 'PLAYER' };
      mockAdminService.updateUserRole.and.returnValue(throwError(() => ({ error: { message: 'Update failed' } })));
      component.onRoleChange(user, 'ADMIN');
      expect(user.role).toBe('PLAYER');
      expect(component.usersError).toBe('Update failed');
    });
  });

  describe('onDeleteUser', () => {
    it('should call adminService.deleteUser after confirmation', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      mockAdminService.deleteUser.and.returnValue(of(undefined));

      component.users = [mockUser];
      component.onDeleteUser(mockUser);

      expect(mockAdminService.deleteUser).toHaveBeenCalledWith('user-1');
    });

    it('should remove the user from the list on success', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      mockAdminService.deleteUser.and.returnValue(of(undefined));

      component.users = [mockUser];
      component.onDeleteUser(mockUser);

      expect(component.users.length).toBe(0);
    });

    it('should not call deleteUser when confirm is cancelled', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      component.onDeleteUser(mockUser);
      expect(mockAdminService.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('onCreateInvite', () => {
    it('should mark form touched and not submit when form is invalid', () => {
      component.onCreateInvite();
      expect(mockAdminService.createInvite).not.toHaveBeenCalled();
      expect(component.inviteForm.controls.email.touched).toBeTrue();
    });

    it('should call adminService.createInvite with the email', () => {
      mockAdminService.createInvite.and.returnValue(of(mockInvite));
      component.inviteForm.controls.email.setValue('new@example.com');

      component.onCreateInvite();

      expect(mockAdminService.createInvite).toHaveBeenCalledWith('new@example.com');
    });

    it('should reset the form and reload invites on success', () => {
      mockAdminService.createInvite.and.returnValue(of(mockInvite));
      component.inviteForm.controls.email.setValue('new@example.com');

      component.onCreateInvite();

      expect(component.inviteForm.controls.email.value).toBe('');
      expect(component.inviteSubmitting).toBeFalse();
      expect(mockAdminService.getInvites).toHaveBeenCalledTimes(2); // once on init, once after create
    });

    it('should set inviteFormError on failure', () => {
      mockAdminService.createInvite.and.returnValue(throwError(() => ({ error: { message: 'Already invited' } })));
      component.inviteForm.controls.email.setValue('new@example.com');

      component.onCreateInvite();

      expect(component.inviteFormError).toBe('Already invited');
      expect(component.inviteSubmitting).toBeFalse();
    });
  });

  describe('onRevokeInvite', () => {
    it('should call adminService.revokeInvite after confirmation', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      mockAdminService.revokeInvite.and.returnValue(of(undefined));

      component.invites = [mockInvite];
      component.onRevokeInvite(mockInvite);

      expect(mockAdminService.revokeInvite).toHaveBeenCalledWith('inv-1');
    });

    it('should remove the invite from the list on success', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      mockAdminService.revokeInvite.and.returnValue(of(undefined));

      component.invites = [mockInvite];
      component.onRevokeInvite(mockInvite);

      expect(component.invites.length).toBe(0);
    });

    it('should not call revokeInvite when confirm is cancelled', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      component.onRevokeInvite(mockInvite);
      expect(mockAdminService.revokeInvite).not.toHaveBeenCalled();
    });
  });

  describe('getInviteStatus', () => {
    it('should return "used" when usedAt is set', () => {
      const used: Invite = { ...mockInvite, usedAt: '2024-06-01T00:00:00Z' };
      expect(component.getInviteStatus(used)).toBe('used');
    });

    it('should return "expired" when expiresAt is in the past', () => {
      const expired: Invite = { ...mockInvite, expiresAt: '2000-01-01T00:00:00Z', usedAt: null };
      expect(component.getInviteStatus(expired)).toBe('expired');
    });

    it('should return "pending" when not used and not expired', () => {
      expect(component.getInviteStatus(mockInvite)).toBe('pending');
    });
  });
});
