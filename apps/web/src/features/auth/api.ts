import { apiClient } from '@infrastructure/api/client';
import type { LoginResponse } from './types';

export type LoginPayload = {
  email: string;
  password: string;
};

export function login(payload: LoginPayload) {
  return apiClient.post<LoginResponse>('/auth/login', payload);
}

export type BootstrapAdminPayload = {
  email: string;
  password: string;
};

export function bootstrapAdmin(payload: BootstrapAdminPayload) {
  return apiClient.post<LoginResponse>('/auth/bootstrap-admin', payload);
}

export type RegisterUserPayload = {
  email: string;
  password: string;
  role?: 'ADMIN' | 'USER';
};

export function registerUser(
  payload: RegisterUserPayload,
  authToken: string,
): Promise<{ id: string; email: string; role: string }> {
  return apiClient.post('/auth/users', payload, { authToken });
}

