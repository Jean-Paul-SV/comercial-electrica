'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDocumentStatus,
  getDianConfig,
  getDianConfigStatus,
  updateDianConfig,
  uploadCertificate,
  retryPendingDianDocuments,
  getDianConfigForTenant,
  getDianConfigStatusForTenant,
  updateDianConfigForTenant,
  uploadCertificateForTenant,
} from './api';
import { useAuth } from '@shared/providers/AuthProvider';
import type {
  UpdateDianConfigPayload,
  UploadCertificatePayload,
} from './types';

const DIAN_CONFIG_KEY = ['dian', 'config'] as const;
const DIAN_CONFIG_STATUS_KEY = ['dian', 'config-status'] as const;

function providerDianConfigKey(tenantId: string) {
  return ['provider', 'tenants', tenantId, 'dian-config'] as const;
}
function providerDianConfigStatusKey(tenantId: string) {
  return ['provider', 'tenants', tenantId, 'dian-config-status'] as const;
}

export function useDianDocumentStatus(documentId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['dian', 'document', documentId],
    enabled: Boolean(token && documentId),
    queryFn: () => getDocumentStatus(documentId!, token!),
  });
}

export function useRetryPendingDianDocuments() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => retryPendingDianDocuments(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dian'] });
    },
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
  const { token, isPlatformAdmin } = useAuth();

  return useQuery({
    queryKey: DIAN_CONFIG_STATUS_KEY,
    enabled: Boolean(token) && !isPlatformAdmin, // Solo usuarios con tenant, no platform admins
    queryFn: () => getDianConfigStatus(token!),
    retry: false, // No reintentar si falla con 403
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

/** Panel proveedor: configuración DIAN de una empresa por tenantId */
export function useDianConfigForTenant(tenantId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: providerDianConfigKey(tenantId ?? ''),
    enabled: Boolean(token && tenantId),
    queryFn: () => getDianConfigForTenant(tenantId!, token!),
  });
}

export function useDianConfigStatusForTenant(tenantId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: providerDianConfigStatusKey(tenantId ?? ''),
    enabled: Boolean(token && tenantId),
    queryFn: () => getDianConfigStatusForTenant(tenantId!, token!),
  });
}

export function useUpdateDianConfigForTenant(tenantId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateDianConfigPayload) =>
      updateDianConfigForTenant(tenantId!, token!, payload),
    onSuccess: (_, __, context) => {
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: providerDianConfigKey(tenantId) });
        queryClient.invalidateQueries({ queryKey: providerDianConfigStatusKey(tenantId) });
      }
    },
  });
}

export function useUploadCertificateForTenant(tenantId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UploadCertificatePayload) =>
      uploadCertificateForTenant(tenantId!, token!, payload),
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: providerDianConfigKey(tenantId) });
        queryClient.invalidateQueries({ queryKey: providerDianConfigStatusKey(tenantId) });
      }
    },
  });
}
