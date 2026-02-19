import { apiClient } from '@infrastructure/api/client';
import type {
  ListTenantsResponse,
  TenantDetail,
  CreateTenantPayload,
  CreateTenantResponse,
  PlanListItem,
  CreatePlanPayload,
  UpdatePlanPayload,
  ProviderTenantsSummary,
  DianActivationRequest,
  ProviderFeedbackItem,
  ListUsageEventsResponse,
  UsageByDayItem,
} from './types';

export type ListTenantsQuery = {
  limit?: number;
  offset?: number;
  isActive?: string;
  searchName?: string;
  searchNumber?: string;
};

export function listPlans(
  authToken: string,
  activeOnly?: boolean
): Promise<PlanListItem[]> {
  const qs = activeOnly === true ? '?activeOnly=true' : '';
  return apiClient.get(`/provider/plans${qs}`, { authToken });
}

export function createPlan(
  payload: CreatePlanPayload,
  authToken: string
): Promise<PlanListItem> {
  return apiClient.post<PlanListItem>('/provider/plans', payload, { authToken });
}

export function updatePlan(
  id: string,
  payload: UpdatePlanPayload,
  authToken: string
): Promise<PlanListItem> {
  return apiClient.patch(`/provider/plans/${id}`, payload, { authToken });
}

export function listTenants(
  authToken: string,
  query?: ListTenantsQuery
): Promise<ListTenantsResponse> {
  const params = new URLSearchParams();
  if (query?.limit != null) params.set('limit', String(query.limit));
  if (query?.offset != null) params.set('offset', String(query.offset));
  if (query?.isActive != null) params.set('isActive', query.isActive);
  if (query?.searchName?.trim()) params.set('searchName', query.searchName.trim());
  if (query?.searchNumber?.trim()) params.set('searchNumber', query.searchNumber.trim());
  const qs = params.toString();
  return apiClient.get(`/provider/tenants${qs ? `?${qs}` : ''}`, {
    authToken,
  });
}

export function getTenantsSummary(
  authToken: string
): Promise<ProviderTenantsSummary> {
  return apiClient.get('/provider/tenants/summary', { authToken });
}

export function getTenant(id: string, authToken: string): Promise<TenantDetail> {
  return apiClient.get(`/provider/tenants/${id}`, { authToken });
}

export function updateTenantStatus(
  id: string,
  isActive: boolean,
  authToken: string
): Promise<{ success: boolean; isActive: boolean }> {
  return apiClient.patch(`/provider/tenants/${id}/status`, { isActive }, { authToken });
}

export function updateTenant(
  id: string,
  payload: import('./types').UpdateTenantPayload,
  authToken: string
): Promise<{ success: boolean; planId: string | null }> {
  return apiClient.patch(`/provider/tenants/${id}`, payload, { authToken });
}

export function renewSubscription(
  tenantId: string,
  extendDays: number,
  authToken: string
): Promise<{ success: boolean; currentPeriodEnd: string }> {
  return apiClient.patch(
    `/provider/tenants/${tenantId}/subscription/renew`,
    { extendDays },
    { authToken }
  );
}

export function createTenant(
  payload: CreateTenantPayload,
  authToken: string
): Promise<CreateTenantResponse> {
  return apiClient.post<CreateTenantResponse>('/provider/tenants', payload, {
    authToken,
  });
}

export function deleteTenant(
  id: string,
  authToken: string
): Promise<{ success: boolean }> {
  return apiClient.delete(`/provider/tenants/${id}`, { authToken });
}

export function listDianActivationRequests(
  authToken: string
): Promise<DianActivationRequest[]> {
  return apiClient.get('/provider/dian-activations', { authToken });
}

export function markDianActivationAsCompleted(
  tenantId: string,
  authToken: string
): Promise<{ success: boolean }> {
  return apiClient.patch(
    `/provider/tenants/${tenantId}/dian-activation/complete`,
    {},
    { authToken }
  );
}

export type ListFeedbackQuery = {
  tenantId?: string;
  status?: 'PENDING' | 'READ' | 'DONE';
};

export function listFeedback(
  authToken: string,
  query?: ListFeedbackQuery
): Promise<ProviderFeedbackItem[]> {
  const params = new URLSearchParams();
  if (query?.tenantId) params.set('tenantId', query.tenantId);
  if (query?.status) params.set('status', query.status);
  const qs = params.toString();
  return apiClient.get<ProviderFeedbackItem[]>(
    `/provider/feedback${qs ? `?${qs}` : ''}`,
    { authToken }
  );
}

export function updateFeedbackStatus(
  id: string,
  status: 'PENDING' | 'READ' | 'DONE',
  authToken: string
): Promise<{ id: string; status: string; updatedAt: string }> {
  return apiClient.patch(
    `/provider/feedback/${id}`,
    { status },
    { authToken }
  );
}

export type ListUsageEventsQuery = {
  tenantId?: string;
  event?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export function listUsageEvents(
  authToken: string,
  query?: ListUsageEventsQuery
): Promise<ListUsageEventsResponse> {
  const params = new URLSearchParams();
  if (query?.tenantId) params.set('tenantId', query.tenantId);
  if (query?.event) params.set('event', query.event);
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  if (query?.limit != null) params.set('limit', String(query.limit));
  if (query?.offset != null) params.set('offset', String(query.offset));
  const qs = params.toString();
  return apiClient.get<ListUsageEventsResponse>(
    `/provider/usage/events${qs ? `?${qs}` : ''}`,
    { authToken }
  );
}

export type UsageByDayQuery = {
  from?: string;
  to?: string;
  tenantId?: string;
  event?: string;
};

export function getUsageEventsByDay(
  authToken: string,
  query?: UsageByDayQuery
): Promise<UsageByDayItem[]> {
  const params = new URLSearchParams();
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  if (query?.tenantId) params.set('tenantId', query.tenantId);
  if (query?.event) params.set('event', query.event);
  const qs = params.toString();
  return apiClient.get<UsageByDayItem[]>(
    `/provider/usage/events/by-day${qs ? `?${qs}` : ''}`,
    { authToken }
  );
}
