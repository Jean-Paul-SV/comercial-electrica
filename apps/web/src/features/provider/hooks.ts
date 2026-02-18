import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@shared/providers/AuthProvider';
import * as api from './api';
import type { ListTenantsQuery } from './api';
import type { CreateTenantPayload, ProviderAlert } from './types';

export function usePlans(activeOnly?: boolean) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['provider', 'plans', activeOnly],
    queryFn: () => api.listPlans(token!, activeOnly),
    enabled: Boolean(token),
  });
}

export function useCreatePlan() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: import('./types').CreatePlanPayload) =>
      api.createPlan(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider', 'plans'] });
    },
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

export function useTenantsSummary() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['provider', 'tenants', 'summary'],
    queryFn: () => api.getTenantsSummary(token!),
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

/** Alertas del panel proveedor (planes sin Stripe, empresas sin plan, etc.). */
export function useProviderAlerts(): { alerts: ProviderAlert[]; isLoading: boolean } {
  const plansQuery = usePlans(false);
  const tenantsQuery = useListTenants({ limit: 500 });
  const plans = plansQuery.data ?? [];
  const tenants = tenantsQuery.data?.items ?? [];
  const isLoading = plansQuery.isLoading || tenantsQuery.isLoading;

  const alerts = useMemo((): ProviderAlert[] => {
    const list: ProviderAlert[] = [];

    if (!plansQuery.isSuccess || !tenantsQuery.isSuccess) return list;

    const activePlansWithoutStripe = plans.filter(
      (p) => p.isActive && (!p.stripePriceId || p.stripePriceId.trim() === '')
    );
    if (activePlansWithoutStripe.length > 0) {
      list.push({
        code: 'PLAN_NO_STRIPE_ID',
        severity: 'high',
        priority: 1,
        title: 'Planes activos sin Stripe Price ID',
        message: `${activePlansWithoutStripe.length} plan(es) activo(s) no tienen Stripe Price ID. Las suscripciones no se crearán en Stripe al asignar a una empresa.`,
        count: activePlansWithoutStripe.length,
        actionLabel: 'Ir a Planes',
        actionHref: '/provider/plans',
      });
    }

    if (plans.length === 0) {
      list.push({
        code: 'NO_PLANS',
        severity: 'critical',
        priority: 0,
        title: 'No hay planes configurados',
        message: 'Crea al menos un plan para poder asignarlo a las empresas.',
        count: 0,
        actionLabel: 'Ir a Planes',
        actionHref: '/provider/plans',
      });
    }

    const tenantsWithoutPlan = tenants.filter((t) => !t.plan);
    if (tenantsWithoutPlan.length > 0) {
      list.push({
        code: 'TENANTS_WITHOUT_PLAN',
        severity: 'medium',
        priority: 2,
        title: 'Empresas sin plan asignado',
        message: `${tenantsWithoutPlan.length} empresa(s) no tienen plan. Asígnales un plan para habilitar suscripciones y límites.`,
        count: tenantsWithoutPlan.length,
        actionLabel: 'Ver empresas',
        actionHref: '/provider',
      });
    }

    return list.sort((a, b) => a.priority - b.priority);
  }, [plans, tenants, plansQuery.isSuccess, tenantsQuery.isSuccess]);

  return { alerts, isLoading };
}
