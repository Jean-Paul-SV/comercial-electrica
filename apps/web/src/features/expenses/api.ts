import { apiClient } from '@infrastructure/api/client';
import type {
  Paginated,
  Expense,
  CreateExpensePayload,
  ListExpensesParams,
} from './types';

export function listExpenses(
  params: ListExpensesParams,
  authToken: string,
): Promise<Paginated<Expense>> {
  const qs = new URLSearchParams();
  if (params.startDate != null) qs.set('startDate', params.startDate);
  if (params.endDate != null) qs.set('endDate', params.endDate);
  if (params.category != null && params.category !== '') qs.set('category', params.category);
  if (params.search != null && params.search !== '') qs.set('search', params.search);
  if (params.expenseType != null && params.expenseType !== 'all') qs.set('expenseType', params.expenseType);
  if (params.kind != null) qs.set('kind', params.kind);
  if (params.cashSessionId != null && params.cashSessionId !== '') qs.set('cashSessionId', params.cashSessionId);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/expenses${query}`, { authToken });
}

export function getExpenseById(
  id: string,
  authToken: string,
): Promise<Expense> {
  return apiClient.get(`/expenses/${id}`, { authToken });
}

export function createExpense(
  payload: CreateExpensePayload,
  authToken: string,
): Promise<Expense> {
  return apiClient.post('/expenses', payload, { authToken });
}

export function deleteExpense(
  id: string,
  authToken: string,
  reason: string,
): Promise<{ id: string }> {
  const qs = new URLSearchParams({ reason: reason.trim() });
  return apiClient.delete(`/expenses/${id}?${qs.toString()}`, { authToken });
}
