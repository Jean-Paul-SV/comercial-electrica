import { apiClient } from '@infrastructure/api/client';
import type {
  DianDocumentStatusResponse,
  DianConfigPublic,
  DianConfigStatusResponse,
  UpdateDianConfigPayload,
  UploadCertificatePayload,
} from './types';

const DIAN_BASE = '/dian';

export function getDocumentStatus(
  documentId: string,
  authToken: string,
): Promise<DianDocumentStatusResponse> {
  return apiClient.get(`${DIAN_BASE}/documents/${documentId}/status`, {
    authToken,
  });
}

export function retryPendingDianDocuments(
  authToken: string,
): Promise<{ enqueued: number; message: string }> {
  return apiClient.post<{ enqueued: number; message: string }>(
    `${DIAN_BASE}/documents/retry-pending`,
    {},
    { authToken },
  );
}

export function getDianConfig(authToken: string): Promise<DianConfigPublic | null> {
  return apiClient.get<DianConfigPublic | null>(`${DIAN_BASE}/config`, {
    authToken,
  });
}

export function getDianConfigStatus(
  authToken: string,
): Promise<DianConfigStatusResponse> {
  return apiClient.get<DianConfigStatusResponse>(`${DIAN_BASE}/config-status`, {
    authToken,
  });
}

export function updateDianConfig(
  authToken: string,
  payload: UpdateDianConfigPayload,
): Promise<DianConfigPublic> {
  return apiClient.patch<DianConfigPublic>(`${DIAN_BASE}/config`, payload, {
    authToken,
  });
}

export function uploadCertificate(
  authToken: string,
  payload: UploadCertificatePayload,
): Promise<{ ok: boolean; message: string }> {
  return apiClient.post<{ ok: boolean; message: string }>(
    `${DIAN_BASE}/config/certificate`,
    payload,
    { authToken },
  );
}

/** Panel proveedor: configuración DIAN de una empresa por tenantId */
const PROVIDER_DIAN = (tenantId: string) => `/provider/tenants/${tenantId}/dian-config`;

export function getDianConfigForTenant(
  tenantId: string,
  authToken: string,
): Promise<import('./types').DianConfigPublic | null> {
  return apiClient.get(`${PROVIDER_DIAN(tenantId)}`, { authToken });
}

export function getDianConfigStatusForTenant(
  tenantId: string,
  authToken: string,
): Promise<import('./types').DianConfigStatusResponse> {
  return apiClient.get(`${PROVIDER_DIAN(tenantId)}-status`, { authToken });
}

export function updateDianConfigForTenant(
  tenantId: string,
  authToken: string,
  payload: import('./types').UpdateDianConfigPayload,
): Promise<import('./types').DianConfigPublic> {
  return apiClient.patch(`${PROVIDER_DIAN(tenantId)}`, payload, { authToken });
}

export function uploadCertificateForTenant(
  tenantId: string,
  authToken: string,
  payload: UploadCertificatePayload,
): Promise<{ ok: boolean; message: string }> {
  return apiClient.post(
    `${PROVIDER_DIAN(tenantId)}/certificate`,
    payload,
    { authToken },
  );
}
