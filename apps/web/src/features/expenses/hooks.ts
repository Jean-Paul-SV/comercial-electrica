'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listExpenses,
  getExpenseById,
  createExpense,
  deleteExpense,
} from './api';
import type { CreateExpensePayload, ListExpensesParams } from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useExpensesList(params: ListExpensesParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['expenses', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listExpenses(params, token!),
  });
}

export function useExpense(id: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['expenses', id],
    enabled: Boolean(token && id),
    queryFn: () => getExpenseById(id!, token!),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateExpensePayload) =>
      createExpense(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      deleteExpense(id, token!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
  });
}
