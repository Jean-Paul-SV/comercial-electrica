'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDocumentStatus,
  getDianConfig,
  getDianConfigStatus,
  updateDianConfig,
  uploadCertificate,
} from './api';
import { useAuth } from '@shared/providers/AuthProvider';
import type {
  UpdateDianConfigPayload,
  UploadCertificatePayload,
} from './types';

const DIAN_CONFIG_KEY = ['dian', 'config'] as const;
const DIAN_CONFIG_STATUS_KEY = ['dian', 'config-status'] as const;

export function useDianDocumentStatus(documentId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['dian', 'document', documentId],
    enabled: Boolean(token && documentId),
    queryFn: () => getDocumentStatus(documentId!, token!),
  });
}

export function useDianConfig() {
  const { token } = useAuth();

  return useQuery({
    queryKey: DIAN_CONFIG_KEY,
    enabled: Boolean(token),
    queryFn: () => getDianConfig(token!),
  });
}

export function useDianConfigStatus() {
  const { token } = useAuth();

  return useQuery({
    queryKey: DIAN_CONFIG_STATUS_KEY,
    enabled: Boolean(token),
    queryFn: () => getDianConfigStatus(token!),
  });
}

export function useUpdateDianConfig() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateDianConfigPayload) =>
      updateDianConfig(token!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIAN_CONFIG_KEY });
      queryClient.invalidateQueries({ queryKey: DIAN_CONFIG_STATUS_KEY });
    },
  });
}

export function useUploadCertificate() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UploadCertificatePayload) =>
      uploadCertificate(token!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DIAN_CONFIG_KEY });
      queryClient.invalidateQueries({ queryKey: DIAN_CONFIG_STATUS_KEY });
    },
  });
}
