import { apiClient } from '@infrastructure/api/client';
import type { Paginated, ReturnListItem, CreateReturnPayload } from './types';

export type ReturnsListParams = {
  page?: number;
  limit?: number;
};

export function listReturns(
  params: ReturnsListParams,
  authToken: string,
): Promise<Paginated<ReturnListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/returns${query}`, { authToken });
}

export function getReturn(id: string, authToken: string): Promise<ReturnListItem> {
  return apiClient.get(`/returns/${id}`, { authToken });
}

export function createReturn(
  payload: CreateReturnPayload,
  authToken: string,
): Promise<ReturnListItem> {
  return apiClient.post('/returns', payload, { authToken });
}
