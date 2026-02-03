import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  SupplierInvoiceListItem,
  SupplierInvoice,
  CreateSupplierInvoicePayload,
  CreatePaymentPayload,
  PendingPaymentItem,
} from './types';

export type SupplierInvoicesListParams = {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: string;
  search?: string;
};

export function listSupplierInvoices(
  params: SupplierInvoicesListParams,
  authToken: string,
): Promise<Paginated<SupplierInvoiceListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  if (params.supplierId) qs.set('supplierId', params.supplierId);
  if (params.search && params.search.trim()) qs.set('search', params.search.trim());
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/supplier-invoices${query}`, { authToken });
}

export function getPendingPayments(
  authToken: string,
): Promise<PendingPaymentItem[]> {
  return apiClient.get('/supplier-invoices/pending', { authToken });
}

export function getSupplierInvoice(
  id: string,
  authToken: string,
): Promise<SupplierInvoice> {
  return apiClient.get(`/supplier-invoices/${id}`, { authToken });
}

export function createSupplierInvoice(
  payload: CreateSupplierInvoicePayload,
  authToken: string,
): Promise<SupplierInvoice> {
  return apiClient.post('/supplier-invoices', payload, { authToken });
}

export function createSupplierInvoicePayment(
  invoiceId: string,
  payload: CreatePaymentPayload,
  authToken: string,
): Promise<unknown> {
  return apiClient.post(`/supplier-invoices/${invoiceId}/payments`, payload, {
    authToken,
  });
}

export function updateSupplierInvoiceStatus(
  invoiceId: string,
  status: string,
  authToken: string,
): Promise<SupplierInvoice> {
  return apiClient.patch(`/supplier-invoices/${invoiceId}/status`, { status }, { authToken });
}
