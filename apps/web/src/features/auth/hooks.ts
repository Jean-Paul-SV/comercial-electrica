'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  login,
  bootstrapAdmin,
  registerUser,
  listUsers,
  updateUser,
  changeMyPassword,
  forgotPassword,
  resetPassword,
  inviteUser,
  acceptInvite,
  type LoginPayload,
  type BootstrapAdminPayload,
  type RegisterUserPayload,
  type UpdateUserPayload,
  type ChangeMyPasswordPayload,
  type ForgotPasswordPayload,
  type ResetPasswordPayload,
  type InviteUserPayload,
  type AcceptInvitePayload,
} from './api';
import { useAuth } from '@shared/providers/AuthProvider';

const USERS_QUERY_KEY = ['auth', 'users'] as const;

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
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useUsersList() {
  const { token } = useAuth();
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: () => listUsers(token!),
    enabled: Boolean(token),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      updateUser(id, payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useChangeMyPassword() {
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: ChangeMyPasswordPayload) =>
      changeMyPassword(payload, token!),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => forgotPassword(payload),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload),
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUser(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (payload: AcceptInvitePayload) => acceptInvite(payload),
  });
}

