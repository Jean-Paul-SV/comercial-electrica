import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  AuditLog,
  ListAuditLogsParams,
  VerifyChainResponse,
} from './types';

export function listAuditLogs(
  params: ListAuditLogsParams,
  authToken: string,
): Promise<Paginated<AuditLog>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.entity?.trim()) qs.set('entity', params.entity.trim());
  if (params.action?.trim()) qs.set('action', params.action.trim());
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.search?.trim()) qs.set('search', params.search.trim());
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/audit-logs${query}`, { authToken });
}

export function verifyAuditChain(authToken: string): Promise<VerifyChainResponse> {
  return apiClient.get('/audit-logs/verify-chain', { authToken });
}
