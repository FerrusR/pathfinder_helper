import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthResponse, InviteDetails, LoginRequest, RegisterRequest, User } from '../models/user.model';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'auth_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(this.getCurrentUser());
  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap((response) => {
        this.setToken(response.accessToken);
        this.currentUserSubject.next(response.user ?? this.getCurrentUser());
      })
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, data).pipe(
      tap((response) => {
        this.setToken(response.accessToken);
        this.currentUserSubject.next(response.user ?? this.getCurrentUser());
      })
    );
  }

  getInviteDetails(token: string): Observable<InviteDetails> {
    return this.http.get<InviteDetails>(`${environment.apiUrl}/auth/invite/${token}`);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  getCurrentUser(): User | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return {
        id: decoded.sub,
        email: decoded.email,
        displayName: decoded.displayName,
        role: decoded.role,
      };
    } catch {
      return null;
    }
  }
}
