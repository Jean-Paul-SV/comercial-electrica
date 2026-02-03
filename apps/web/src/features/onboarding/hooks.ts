'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOnboardingStatus, updateOnboardingStatus } from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useOnboardingStatus() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['onboarding', 'status'],
    enabled: Boolean(token),
    queryFn: () => getOnboardingStatus(token!),
  });
}

export function useUpdateOnboardingStatus() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: 'in_progress' | 'completed' | 'skipped') =>
      updateOnboardingStatus(token!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
    },
  });
}
