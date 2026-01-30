import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  SupplierListItem,
  Supplier,
  CreateSupplierPayload,
  UpdateSupplierPayload,
} from './types';

export type SuppliersListParams = {
  page?: number;
  limit?: number;
};

export function listSuppliers(
  params: SuppliersListParams,
  authToken: string,
): Promise<Paginated<SupplierListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/suppliers${query}`, { authToken });
}

export function getSupplier(id: string, authToken: string): Promise<Supplier> {
  return apiClient.get(`/suppliers/${id}`, { authToken });
}

export function createSupplier(
  payload: CreateSupplierPayload,
  authToken: string,
): Promise<Supplier> {
  return apiClient.post('/suppliers', payload, { authToken });
}

export function updateSupplier(
  id: string,
  payload: UpdateSupplierPayload,
  authToken: string,
): Promise<Supplier> {
  return apiClient.patch(`/suppliers/${id}`, payload, { authToken });
}

export function deleteSupplier(id: string, authToken: string): Promise<void> {
  return apiClient.delete(`/suppliers/${id}`, { authToken });
}
