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
} from './types';

export type ListTenantsQuery = {
  limit?: number;
  offset?: number;
  isActive?: string;
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
  payload: { planId?: string },
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
