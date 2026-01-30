import { apiClient } from '@infrastructure/api/client';
import type { Paginated, SaleListItem, CreateSalePayload } from './types';

export type SalesListParams = {
  page?: number;
  limit?: number;
};

export function listSales(
  params: SalesListParams,
  authToken: string,
): Promise<Paginated<SaleListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/sales${query}`, { authToken });
}

export function createSale(
  payload: CreateSalePayload,
  authToken: string,
): Promise<SaleListItem> {
  return apiClient.post('/sales', payload, { authToken });
}

