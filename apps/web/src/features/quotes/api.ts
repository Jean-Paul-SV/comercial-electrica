import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  QuoteListItem,
  Quote,
  CreateQuotePayload,
  UpdateQuotePayload,
  ConvertQuotePayload,
  ConvertQuoteResponse,
} from './types';

export type QuotesListParams = {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  search?: string;
};

export function listQuotes(
  params: QuotesListParams,
  authToken: string,
): Promise<Paginated<QuoteListItem>> {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  if (params.customerId) qs.set('customerId', params.customerId);
  if (params.search != null && params.search !== '') qs.set('search', params.search);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/quotes${query}`, { authToken });
}

export function getQuote(id: string, authToken: string): Promise<Quote> {
  return apiClient.get(`/quotes/${id}`, { authToken });
}

export function createQuote(
  payload: CreateQuotePayload,
  authToken: string,
): Promise<Quote> {
  return apiClient.post('/quotes', payload, { authToken });
}

export function updateQuote(
  id: string,
  payload: UpdateQuotePayload,
  authToken: string,
): Promise<Quote> {
  return apiClient.patch(`/quotes/${id}`, payload, { authToken });
}

export function convertQuote(
  id: string,
  payload: ConvertQuotePayload,
  authToken: string,
): Promise<ConvertQuoteResponse> {
  return apiClient.post(`/quotes/${id}/convert`, payload, { authToken });
}

export function updateQuoteStatus(
  id: string,
  status: string,
  authToken: string,
): Promise<Quote> {
  return apiClient.patch(`/quotes/${id}/status`, { status }, { authToken });
}
