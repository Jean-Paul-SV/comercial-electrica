import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  CustomerListItem,
  Customer,
  CreateCustomerPayload,
  UpdateCustomerPayload,
} from './types';

export type CustomersListParams = {
  page?: number;
  limit?: number;
};

export function listCustomers(
  params: CustomersListParams,
  authToken: string,
): Promise<Paginated<CustomerListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/customers${query}`, { authToken });
}

export function getCustomer(id: string, authToken: string): Promise<Customer> {
  return apiClient.get(`/customers/${id}`, { authToken });
}

export function createCustomer(
  payload: CreateCustomerPayload,
  authToken: string,
): Promise<Customer> {
  return apiClient.post('/customers', payload, { authToken });
}

export function updateCustomer(
  id: string,
  payload: UpdateCustomerPayload,
  authToken: string,
): Promise<Customer> {
  return apiClient.patch(`/customers/${id}`, payload, { authToken });
}
