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
