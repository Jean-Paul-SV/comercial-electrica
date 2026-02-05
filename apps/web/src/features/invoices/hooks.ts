'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInvoices, voidInvoice, type InvoicesListParams } from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useInvoicesList(params: InvoicesListParams) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['invoices', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listInvoices(params, token!),
  });
}

export function useVoidInvoice() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (invoiceId: string) => voidInvoice(invoiceId, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}
