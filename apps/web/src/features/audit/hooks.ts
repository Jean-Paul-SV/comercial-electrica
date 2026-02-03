'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAuditLogs, verifyAuditChain } from './api';
import type { ListAuditLogsParams } from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useAuditLogsList(params: ListAuditLogsParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['audit-logs', params],
    enabled: Boolean(token),
    queryFn: () => listAuditLogs(params, token!),
  });
}

export function useVerifyAuditChain() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => verifyAuditChain(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}
