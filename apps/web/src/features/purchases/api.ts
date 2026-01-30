import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  PurchaseOrderListItem,
  PurchaseOrder,
  CreatePurchaseOrderPayload,
  ReceivePurchaseOrderPayload,
} from './types';

export type PurchasesListParams = {
  page?: number;
  limit?: number;
};

export function listPurchases(
  params: PurchasesListParams,
  authToken: string,
): Promise<Paginated<PurchaseOrderListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/purchases${query}`, { authToken });
}

export function getPurchase(
  id: string,
  authToken: string,
): Promise<PurchaseOrder> {
  return apiClient.get(`/purchases/${id}`, { authToken });
}

export function createPurchaseOrder(
  payload: CreatePurchaseOrderPayload,
  authToken: string,
): Promise<PurchaseOrder> {
  return apiClient.post('/purchases', payload, { authToken });
}

export function receivePurchaseOrder(
  id: string,
  payload: ReceivePurchaseOrderPayload,
  authToken: string,
): Promise<PurchaseOrder> {
  return apiClient.post(`/purchases/${id}/receive`, payload, { authToken });
}
