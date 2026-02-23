import { apiClient } from '@infrastructure/api/client';

export type RecordUsagePayload = {
  event: string;
  payload?: Record<string, unknown>;
};

export function recordUsageEvent(
  authToken: string,
  body: RecordUsagePayload
): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>('/usage/events', body, { authToken });
}

/** Registra una visita a una página para el contador del panel proveedor. */
export function recordPageVisit(
  authToken: string,
  path: string
): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>('/tracking/visit', { path }, { authToken });
}
