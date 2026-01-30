'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type SuppliersListParams,
} from './api';
import type { CreateSupplierPayload, UpdateSupplierPayload } from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useSuppliersList(params: SuppliersListParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['suppliers', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listSuppliers(params, token!),
  });
}

export function useSupplier(id: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['suppliers', id],
    enabled: Boolean(token && id),
    queryFn: () => getSupplier(id!, token!),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateSupplierPayload) =>
      createSupplier(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateSupplierPayload;
    }) => updateSupplier(id, payload, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', variables.id] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}
