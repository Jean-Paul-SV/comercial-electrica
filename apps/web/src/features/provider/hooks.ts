import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@shared/providers/AuthProvider';
import * as api from './api';
import type { ListTenantsQuery } from './api';
import type { CreateTenantPayload } from './types';

export function usePlans(activeOnly?: boolean) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['provider', 'plans', activeOnly],
    queryFn: () => api.listPlans(token!, activeOnly),
    enabled: Boolean(token),
  });
}

export function useUpdatePlan() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: import('./types').UpdatePlanPayload;
    }) => api.updatePlan(id, payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider', 'plans'] });
    },
  });
}

export function useListTenants(query?: ListTenantsQuery) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['provider', 'tenants', query],
    queryFn: () => api.listTenants(token!, query),
    enabled: Boolean(token),
  });
}

export function useTenant(id: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['provider', 'tenant', id],
    queryFn: () => api.getTenant(id!, token!),
    enabled: Boolean(token && id),
  });
}

export function useUpdateTenantStatus() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateTenantStatus(id, isActive, token!),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['provider', 'tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['provider', 'tenants'] });
    },
  });
}

export function useUpdateTenant() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, planId }: { id: string; planId?: string }) =>
      api.updateTenant(id, { planId }, token!),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['provider', 'tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['provider', 'tenants'] });
    },
  });
}

export function useRenewSubscription() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, extendDays = 30 }: { tenantId: string; extendDays?: number }) =>
      api.renewSubscription(tenantId, extendDays, token!),
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['provider', 'tenant', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['provider', 'tenants'] });
    },
  });
}

export function useCreateTenant() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTenantPayload) =>
      api.createTenant(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider', 'tenants'] });
    },
  });
}
