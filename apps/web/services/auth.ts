import type { AuthTokens, UserView } from '@vp/shared';
import { get, post } from './http';

export interface LoginResponse {
  user: UserView;
  tokens: AuthTokens;
}

export interface RegisterInput {
  organizationType: 'SUPPLIER' | 'BUYER';
  organizationName: string;
  registrationNo?: string;
  name: string;
  email: string;
  password: string;
}

export const authService = {
  login: (email: string, password: string) => post<LoginResponse>('/auth/login', { email, password }),
  register: (input: RegisterInput) => post<LoginResponse | { user: UserView; verificationRequired: true }>('/auth/register', input),
  logout: (refreshToken: string | undefined) => post<null>('/auth/logout', { refreshToken }),
  me: () => get<UserView>('/auth/me'),
  verifyEmail: (token: string) => post<LoginResponse | { verified: true }>('/auth/verify-email', { token }),
  invite: (input: { email: string; role: string; name?: string }) => post<{ inviteUrl?: string }>('/auth/invite', input),
  acceptInvite: (input: { token: string; name: string; password: string }) => post<LoginResponse>('/auth/accept-invite', input),
};
