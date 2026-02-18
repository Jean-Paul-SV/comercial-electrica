'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubscription, createPortalSession, getBillingPlans, changePlan } from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useSubscriptionInfo() {
  const { token, isPlatformAdmin } = useAuth();

  return useQuery({
    queryKey: ['billing', 'subscription'],
    enabled: Boolean(token) && !isPlatformAdmin,
    queryFn: () => getSubscription(token!),
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
    mutationFn: (planId: string) => changePlan(token!, planId),
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
