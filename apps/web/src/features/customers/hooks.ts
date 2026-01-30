'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  type CustomersListParams,
} from './api';
import type { CreateCustomerPayload, UpdateCustomerPayload } from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useCustomersList(params: CustomersListParams) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['customers', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listCustomers(params, token!),
  });
}

export function useCustomer(id: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['customers', id],
    enabled: Boolean(token && id),
    queryFn: () => getCustomer(id!, token!),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateCustomerPayload) =>
      createCustomer(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateCustomerPayload;
    }) => updateCustomer(id, payload, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', variables.id] });
    },
  });
}
