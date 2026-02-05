import { apiClient } from '@infrastructure/api/client';
import type { Paginated, SaleListItem, SaleDetail, CreateSalePayload, CreateSaleResponse } from './types';

export type CreateSaleOptions = {
  idempotencyKey?: string;
};

export type SalesListParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export function listSales(
  params: SalesListParams,
  authToken: string,
): Promise<Paginated<SaleListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.search != null && params.search !== '') qs.set('search', params.search);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/sales${query}`, { authToken });
}

export function getSale(id: string, authToken: string): Promise<SaleDetail> {
  return apiClient.get(`/sales/${id}`, { authToken });
}

export function createSale(
  payload: CreateSalePayload,
  authToken: string,
  options?: CreateSaleOptions,
): Promise<CreateSaleResponse> {
  return apiClient.post('/sales', payload, {
    authToken,
    idempotencyKey: options?.idempotencyKey,
  });
}

