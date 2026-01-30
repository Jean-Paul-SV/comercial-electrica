import { apiClient } from '@infrastructure/api/client';
import type { DianDocumentStatusResponse } from './types';

export function getDocumentStatus(
  documentId: string,
  authToken: string,
): Promise<DianDocumentStatusResponse> {
  return apiClient.get(`/dian/documents/${documentId}/status`, { authToken });
}
