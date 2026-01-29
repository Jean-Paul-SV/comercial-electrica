'use client';

import { useQuery } from '@tanstack/react-query';
import { listSales, type SalesListParams } from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useSalesList(params: SalesListParams) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['sales', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listSales(params, token!),
  });
}

