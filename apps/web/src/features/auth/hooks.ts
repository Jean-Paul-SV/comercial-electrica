'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  login,
  bootstrapAdmin,
  registerUser,
  type LoginPayload,
  type BootstrapAdminPayload,
  type RegisterUserPayload,
} from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
  });
}

export function useBootstrapAdmin() {
  return useMutation({
    mutationFn: (payload: BootstrapAdminPayload) => bootstrapAdmin(payload),
  });
}

export function useRegisterUser() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: RegisterUserPayload) =>
      registerUser(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

