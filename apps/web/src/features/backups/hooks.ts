'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBackups,
  createBackup,
  deleteBackup,
  verifyBackup,
  downloadBackup,
} from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useBackupsList() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['backups', 'list'],
    enabled: Boolean(token),
    queryFn: () => listBackups(token!),
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: () => createBackup(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (id: string) => deleteBackup(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useVerifyBackup() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (id: string) => verifyBackup(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useDownloadBackup() {
  const { token } = useAuth();

  return useMutation({
    mutationFn: (id: string) => downloadBackup(id, token!),
  });
}
