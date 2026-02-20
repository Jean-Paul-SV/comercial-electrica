'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSubscription,
  createPortalSession,
  createCheckoutSession,
  getBillingPlans,
  changePlan,
  validateDowngrade,
  getWompiConfig,
  getWompiAcceptanceTokens,
  createWompiTransaction,
  getWompiTransaction,
  type WompiCreateTransactionPayload,
} from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useSubscriptionInfo(options?: { refetchWhenPendingPayment?: boolean }) {
  const { token, isPlatformAdmin } = useAuth();

  return useQuery({
    queryKey: ['billing', 'subscription'],
    enabled: Boolean(token) && !isPlatformAdmin,
    queryFn: () => getSubscription(token!),
    // Cuando hay pago pendiente, seguir comprobando cada 3s hasta que el webhook actualice (máx. ~2 min)
    refetchInterval: (query) => {
      if (options?.refetchWhenPendingPayment && query.state.data?.requiresPayment) return 3000;
      return false;
    },
  });
}

export function useBillingPlans() {
  const { token, isPlatformAdmin } = useAuth();

  return useQuery({
    queryKey: ['billing', 'plans'],
    enabled: Boolean(token) && !isPlatformAdmin,
    queryFn: () => getBillingPlans(token!),
  });
}

export function useChangePlan() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { planId: string; billingInterval?: 'monthly' | 'yearly' }) =>
      changePlan(token!, params.planId, params.billingInterval),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
  });
}

export function useCreatePortalSession() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (returnUrl?: string) =>
      createPortalSession(token!, returnUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
  });
}

/** Crea sesión de Stripe Checkout para comprar un plan (página tipo Spotify: tarjeta + completar compra). */
export function useCreateCheckoutSession() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { planId: string; billingInterval: 'monthly' | 'yearly'; returnUrl?: string }) =>
      createCheckoutSession(token!, params.planId, params.billingInterval, params.returnUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
  });
}

/** Valida si el downgrade al plan indicado está permitido (errores/advertencias). */
export function useValidateDowngrade(planId: string | null) {
  const { token, isPlatformAdmin } = useAuth();

  return useQuery({
    queryKey: ['billing', 'validate-downgrade', planId],
    enabled: Boolean(token) && !isPlatformAdmin && Boolean(planId),
    queryFn: () => validateDowngrade(token!, planId!),
  });
}

// --- Wompi (Colombia) ---

export function useWompiConfig() {
  return useQuery({
    queryKey: ['billing', 'wompi-config'],
    queryFn: () => getWompiConfig(),
  });
}

export function useWompiAcceptanceTokens(enabled: boolean) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['billing', 'wompi-acceptance-tokens'],
    enabled: Boolean(token) && enabled,
    queryFn: () => getWompiAcceptanceTokens(token!),
  });
}

export function useCreateWompiTransaction() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WompiCreateTransactionPayload) =>
      createWompiTransaction(token!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
  });
}

export function useWompiTransactionStatus(transactionId: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['billing', 'wompi-transaction', transactionId],
    enabled: Boolean(token) && Boolean(transactionId),
    queryFn: () => getWompiTransaction(token!, transactionId!),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ? 3000 : false,
  });
}
