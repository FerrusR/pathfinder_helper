import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Invite, User } from '../../../core/models/user.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users`);
  }

  updateUserRole(userId: string, role: string): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/users/${userId}/role`, { role });
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/users/${userId}`);
  }

  getInvites(): Observable<Invite[]> {
    return this.http.get<Invite[]>(`${environment.apiUrl}/users/invites`);
  }

  createInvite(email: string): Observable<Invite> {
    return this.http.post<Invite>(`${environment.apiUrl}/users/invites`, { email });
  }

  revokeInvite(inviteId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/users/invites/${inviteId}`);
  }
}
