import { apiClient } from '@infrastructure/api/client';
import type { LoginResponse } from './types';

export type LoginPayload = {
  email: string;
  password: string;
};

export function login(payload: LoginPayload) {
  return apiClient.post<LoginResponse>('/auth/login', payload);
}

