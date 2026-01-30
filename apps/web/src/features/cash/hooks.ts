'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCashSessions,
  openCashSession,
  closeCashSession,
  listSessionMovements,
  createCashMovement,
  type CashSessionsListParams,
  type SessionMovementsParams,
} from './api';
import type {
  OpenSessionPayload,
  CloseSessionPayload,
  CreateMovementPayload,
} from './types';
import { useAuth } from '@shared/providers/AuthProvider';

export function useCashSessionsList(params: CashSessionsListParams) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['cash', 'sessions', params],
    enabled: Boolean(token),
    queryFn: () => listCashSessions(params, token!),
  });
}

export function useSessionMovements(
  sessionId: string | null,
  params: SessionMovementsParams,
) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['cash', 'sessions', sessionId, 'movements', params],
    enabled: Boolean(token && sessionId),
    queryFn: () => listSessionMovements(sessionId!, params, token!),
  });
}

export function useOpenCashSession() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: (payload: OpenSessionPayload) =>
      openCashSession(payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
  });
}

export function useCloseCashSession() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      sessionId,
      payload,
    }: {
      sessionId: string;
      payload: CloseSessionPayload;
    }) => closeCashSession(sessionId, payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
  });
}

export function useCreateCashMovement() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: ({
      sessionId,
      payload,
    }: {
      sessionId: string;
      payload: CreateMovementPayload;
    }) => createCashMovement(sessionId, payload, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
  });
}
