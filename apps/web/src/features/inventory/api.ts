import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  InventoryMovementListItem,
  CreateMovementPayload,
} from './types';

export type MovementsListParams = {
  page?: number;
  limit?: number;
};

export function listMovements(
  params: MovementsListParams,
  authToken: string,
): Promise<Paginated<InventoryMovementListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/inventory/movements${query}`, { authToken });
}

export function createMovement(
  payload: CreateMovementPayload,
  authToken: string,
): Promise<InventoryMovementListItem> {
  return apiClient.post('/inventory/movements', payload, { authToken });
}
