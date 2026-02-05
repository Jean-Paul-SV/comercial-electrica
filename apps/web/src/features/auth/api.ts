import { apiClient } from '@infrastructure/api/client';
import type { LoginResponse, MeResponse, UserListItem } from './types';

export type LoginPayload = {
  email: string;
  password: string;
};

export function login(payload: LoginPayload) {
  return apiClient.post<LoginResponse>('/auth/login', payload);
}

export function getMe(authToken: string): Promise<MeResponse> {
  return apiClient.get('/auth/me', { authToken });
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
  name?: string;
  password?: string;
  role?: 'ADMIN' | 'USER';
  /** Si true, se genera contraseña temporal y el usuario debe cambiarla en el primer login. */
  generateTempPassword?: boolean;
};

export function registerUser(
  payload: RegisterUserPayload,
  authToken: string,
): Promise<{ id: string; email: string; role: string }> {
  return apiClient.post('/auth/users', payload, { authToken });
}

export function listUsers(authToken: string): Promise<UserListItem[]> {
  return apiClient.get('/auth/users', { authToken });
}

export type UpdateUserPayload = {
  name?: string;
  role?: 'ADMIN' | 'USER';
  password?: string;
};

export function updateUser(
  id: string,
  payload: UpdateUserPayload,
  authToken: string,
): Promise<UserListItem> {
  return apiClient.patch(`/auth/users/${id}`, payload, { authToken });
}

export function deleteUser(id: string, authToken: string): Promise<{ success: boolean }> {
  return apiClient.delete(`/auth/users/${id}`, { authToken });
}

export type ChangeMyPasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export function changeMyPassword(
  payload: ChangeMyPasswordPayload,
  authToken: string,
): Promise<{ success: boolean }> {
  return apiClient.patch('/auth/me/password', payload, { authToken });
}

export type ForgotPasswordPayload = { email: string };

export type ForgotPasswordResponse = {
  message: string;
  resetToken?: string;
};

export function forgotPassword(
  payload: ForgotPasswordPayload,
): Promise<ForgotPasswordResponse> {
  return apiClient.post('/auth/forgot-password', payload);
}

export type ResetPasswordPayload = { token: string; newPassword: string };

export function resetPassword(
  payload: ResetPasswordPayload,
): Promise<{ success: boolean }> {
  return apiClient.post('/auth/reset-password', payload);
}

export type InviteUserPayload = { email: string; role?: 'ADMIN' | 'USER' };

export type InviteUserResponse = {
  user: { id: string; email: string; role: string; createdAt: string };
  inviteToken: string;
  tempPassword?: string;
};

export function inviteUser(
  payload: InviteUserPayload,
  authToken: string,
): Promise<InviteUserResponse> {
  return apiClient.post('/auth/invite', payload, { authToken });
}

export type AcceptInvitePayload = { token: string; password: string };

export function acceptInvite(
  payload: AcceptInvitePayload,
): Promise<{ success: boolean }> {
  return apiClient.post('/auth/accept-invite', payload);
}

export type UploadProfilePictureResponse = {
  profilePictureUrl: string;
};

export function uploadProfilePicture(
  file: File,
  authToken: string,
): Promise<UploadProfilePictureResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.put<UploadProfilePictureResponse>(
    '/auth/profile/picture',
    formData,
    {
      authToken,
    },
  );
}

export function uploadEmployeePicture(
  userId: string,
  file: File,
  authToken: string,
): Promise<UploadProfilePictureResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.put<UploadProfilePictureResponse>(
    `/auth/users/${userId}/picture`,
    formData,
    {
      authToken,
    },
  );
}

