export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  role: string;
  createdAt?: string;
}

export interface Invite {
  id: string;
  email: string;
  token: string;
  createdBy: string;
  creator: { id: string; email: string; displayName: string | null };
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface InviteDetails {
  email: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
  inviteToken: string;
}
