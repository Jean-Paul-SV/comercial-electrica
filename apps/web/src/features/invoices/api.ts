import { apiClient } from '@infrastructure/api/client';
import type { Paginated, InvoiceListItem, InvoiceStatus } from './types';

export type InvoicesListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
};

export function listInvoices(
  params: InvoicesListParams,
  authToken: string,
): Promise<Paginated<InvoiceListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.search != null && params.search.trim() !== '') {
    qs.set('search', params.search);
  }
  if (params.status != null) {
    qs.set('status', params.status);
  }
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/sales/invoices${query}`, { authToken });
}

export function voidInvoice(invoiceId: string, authToken: string): Promise<void> {
  return apiClient.patch(`/sales/invoices/${invoiceId}/void`, undefined, { authToken });
}
