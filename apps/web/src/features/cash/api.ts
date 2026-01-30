import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  CashSessionListItem,
  CashSession,
  CashMovement,
  OpenSessionPayload,
  CloseSessionPayload,
  CreateMovementPayload,
} from './types';

export type CashSessionsListParams = {
  page?: number;
  limit?: number;
};

export function listCashSessions(
  params: CashSessionsListParams,
  authToken: string,
): Promise<Paginated<CashSessionListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/cash/sessions${query}`, { authToken });
}

export function openCashSession(
  payload: OpenSessionPayload,
  authToken: string,
): Promise<CashSession> {
  return apiClient.post('/cash/sessions', payload, { authToken });
}

export function closeCashSession(
  sessionId: string,
  payload: CloseSessionPayload,
  authToken: string,
): Promise<CashSession> {
  return apiClient.post(`/cash/sessions/${sessionId}/close`, payload, {
    authToken,
  });
}

export type SessionMovementsParams = {
  page?: number;
  limit?: number;
};

export function listSessionMovements(
  sessionId: string,
  params: SessionMovementsParams,
  authToken: string,
): Promise<Paginated<CashMovement>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/cash/sessions/${sessionId}/movements${query}`, {
    authToken,
  });
}

export function createCashMovement(
  sessionId: string,
  payload: CreateMovementPayload,
  authToken: string,
): Promise<CashMovement> {
  return apiClient.post(
    `/cash/sessions/${sessionId}/add-movement`,
    payload,
    { authToken },
  );
}
