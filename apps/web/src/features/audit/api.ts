import { apiClient } from '@infrastructure/api/client';
import type { Paginated, AuditLog, ListAuditLogsParams } from './types';

export function listAuditLogs(
  params: ListAuditLogsParams,
  authToken: string,
): Promise<Paginated<AuditLog>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/audit-logs${query}`, { authToken });
}
