'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMovements,
  createMovement,
  getTotalInventoryValue,
  type MovementsListParams,
} from './api';
import type { CreateMovementPayload } from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useMovementsList(params: MovementsListParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['inventory', 'movements', params],
    enabled: Boolean(token),
    queryFn: () => listMovements(params, token!),
  });
}

export function useCreateMovement() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateMovementPayload) =>
      createMovement(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useInventoryTotalValue() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['inventory', 'total-value'],
    enabled: Boolean(token),
    queryFn: () => getTotalInventoryValue(token!),
  });
}
