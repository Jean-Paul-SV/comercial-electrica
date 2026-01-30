'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPurchases,
  getPurchase,
  createPurchaseOrder,
  receivePurchaseOrder,
  type PurchasesListParams,
} from './api';
import type {
  CreatePurchaseOrderPayload,
  ReceivePurchaseOrderPayload,
} from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function usePurchasesList(params: PurchasesListParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['purchases', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listPurchases(params, token!),
  });
}

export function usePurchase(id: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['purchases', id],
    enabled: Boolean(token && id),
    queryFn: () => getPurchase(id!, token!),
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreatePurchaseOrderPayload) =>
      createPurchaseOrder(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ReceivePurchaseOrderPayload;
    }) => receivePurchaseOrder(id, payload, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
