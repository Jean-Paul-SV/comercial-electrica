'use client';

import { useQuery } from '@tanstack/react-query';
import { listAuditLogs, type ListAuditLogsParams } from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useAuditLogsList(params: ListAuditLogsParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['audit-logs', params],
    enabled: Boolean(token),
    queryFn: () => listAuditLogs(params, token!),
  });
}
