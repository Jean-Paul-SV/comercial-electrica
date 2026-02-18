'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSales, getSale, createSale, type SalesListParams } from './api';
import type { CreateSalePayload } from './types';
import { useAuth } from '@shared/providers/AuthProvider';
import { addToQueue } from '@shared/offline-queue/useOfflineQueue';
import { isNetworkError } from '@infrastructure/api/client';

export function useSalesList(params: SalesListParams) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['sales', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listSales(params, token!),
  });
}

export function useSale(id: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['sales', id],
    enabled: Boolean(token && id),
    queryFn: () => getSale(id!, token!),
  });
}

export type CreateSaleMutationInput = {
  payload: CreateSalePayload;
  idempotencyKey: string;
};

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: CreateSaleMutationInput) =>
      createSale(payload, token!, { idempotencyKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err, variables) => {
      // Log del error en el hook para depuración
      console.error('[useCreateSale] Error capturado en hook:', {
        error: err,
        errorType: typeof err,
        errorKeys: err && typeof err === 'object' ? Object.keys(err) : [],
        errorMessage: (err as any)?.message,
        errorStatus: (err as any)?.status,
      });
      
      if (isNetworkError(err) && variables) {
        addToQueue({
          id: variables.idempotencyKey,
          idempotencyKey: variables.idempotencyKey,
          method: 'POST',
          path: '/sales',
          body: variables.payload,
          label: 'Venta',
        });
      }
      // No hacer throw aquí - dejar que React Query propague el error al componente
    },
  });
}

