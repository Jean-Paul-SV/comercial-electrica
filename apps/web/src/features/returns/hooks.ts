'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listReturns, getReturn, createReturn, type ReturnsListParams } from './api';
import type { CreateReturnPayload } from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useReturnsList(params: ReturnsListParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['returns', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listReturns(params, token!),
  });
}

export function useReturn(id: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['returns', id],
    enabled: Boolean(token && id),
    queryFn: () => getReturn(id!, token!),
  });
}

export function useCreateReturn() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateReturnPayload) => createReturn(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
