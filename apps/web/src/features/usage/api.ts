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
