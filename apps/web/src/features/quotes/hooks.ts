'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  convertQuote,
  updateQuoteStatus,
  type QuotesListParams,
} from './api';
import type {
  CreateQuotePayload,
  UpdateQuotePayload,
  ConvertQuotePayload,
} from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useQuotesList(params: QuotesListParams = {}) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['quotes', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listQuotes(params, token!),
  });
}

export function useQuote(id: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['quotes', id],
    enabled: Boolean(token && id),
    queryFn: () => getQuote(id!, token!),
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateQuotePayload) => createQuote(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateQuotePayload;
    }) => updateQuote(id, payload, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.id] });
    },
  });
}

export function useConvertQuote() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ConvertQuotePayload;
    }) => convertQuote(id, payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateQuoteStatus(id, status, token!),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.id] });
    },
  });
}
