import { apiClient } from '@infrastructure/api/client';
import type { Paginated, SaleListItem } from './types';

export type SalesListParams = {
  page?: number;
  limit?: number;
};

export function listSales(
  params: SalesListParams,
  authToken: string,
): Promise<Paginated<SaleListItem>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/sales${query}`, { authToken });
}

