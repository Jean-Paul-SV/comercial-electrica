'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@shared/providers/AuthProvider';
import * as api from './api';

export function useMyFeedback() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['feedback', 'my'],
    queryFn: () => api.getMyFeedback(token!),
    enabled: Boolean(token),
  });
}

export function useSubmitFeedback() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => api.submitFeedback(token!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', 'my'] });
    },
  });
}
