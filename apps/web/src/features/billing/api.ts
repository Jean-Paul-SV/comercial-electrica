import { apiClient } from '@infrastructure/api/client';
import type { SubscriptionInfo, PortalSessionResponse, BillingPlan } from './types';

export function getSubscription(authToken: string): Promise<SubscriptionInfo> {
  return apiClient.get('/billing/subscription', { authToken });
}

export function getBillingPlans(authToken: string): Promise<BillingPlan[]> {
  return apiClient.get<BillingPlan[]>('/billing/plans', { authToken });
}

export function changePlan(
  authToken: string,
  planId: string,
): Promise<{ success: boolean }> {
  return apiClient.patch<{ success: boolean }>('/billing/plan', { planId }, { authToken });
}

export function createPortalSession(
  authToken: string,
  returnUrl?: string,
): Promise<PortalSessionResponse> {
  return apiClient.post<PortalSessionResponse>(
    '/billing/portal-session',
    returnUrl ? { returnUrl } : {},
    { authToken },
  );
}
