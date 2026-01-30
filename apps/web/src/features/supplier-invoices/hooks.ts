'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listSupplierInvoices,
  getPendingPayments,
  getSupplierInvoice,
  createSupplierInvoice,
  createSupplierInvoicePayment,
  updateSupplierInvoiceStatus,
  type SupplierInvoicesListParams,
} from './api';
import type {
  CreateSupplierInvoicePayload,
  CreatePaymentPayload,
} from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useSupplierInvoicesList(
  params: SupplierInvoicesListParams = {},
) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['supplier-invoices', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listSupplierInvoices(params, token!),
  });
}

export function usePendingPayments() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['supplier-invoices', 'pending'],
    enabled: Boolean(token),
    queryFn: () => getPendingPayments(token!),
  });
}

export function useSupplierInvoice(id: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['supplier-invoices', id],
    enabled: Boolean(token && id),
    queryFn: () => getSupplierInvoice(id!, token!),
  });
}

export function useCreateSupplierInvoice() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateSupplierInvoicePayload) =>
      createSupplierInvoice(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
    },
  });
}

export function useCreateSupplierInvoicePayment() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      invoiceId,
      payload,
    }: {
      invoiceId: string;
      payload: CreatePaymentPayload;
    }) => createSupplierInvoicePayment(invoiceId, payload, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({
        queryKey: ['supplier-invoices', variables.invoiceId],
      });
    },
  });
}

export function useUpdateSupplierInvoiceStatus() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      invoiceId,
      status,
    }: {
      invoiceId: string;
      status: string;
    }) => updateSupplierInvoiceStatus(invoiceId, status, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({
        queryKey: ['supplier-invoices', variables.invoiceId],
      });
    },
  });
}
