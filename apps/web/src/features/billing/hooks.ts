'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubscription, createPortalSession } from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useSubscriptionInfo() {
  const { token, isPlatformAdmin } = useAuth();

  return useQuery({
    queryKey: ['billing', 'subscription'],
    enabled: Boolean(token) && !isPlatformAdmin,
    queryFn: () => getSubscription(token!),
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
