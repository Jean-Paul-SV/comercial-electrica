'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSales, createSale, type SalesListParams } from './api';
import type { CreateSalePayload } from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useSalesList(params: SalesListParams) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['sales', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listSales(params, token!),
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateSalePayload) => createSale(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

