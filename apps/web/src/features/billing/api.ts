import { apiClient } from '@infrastructure/api/client';
import type { SubscriptionInfo, PortalSessionResponse, BillingPlan, ChangePlanResult } from './types';

export function getSubscription(authToken: string): Promise<SubscriptionInfo> {
  return apiClient.get('/billing/subscription', { authToken });
}

export function getBillingPlans(authToken: string): Promise<BillingPlan[]> {
  return apiClient.get<BillingPlan[]>('/billing/plans', { authToken });
}

export function changePlan(
  authToken: string,
  planId: string,
  billingInterval?: 'monthly' | 'yearly',
): Promise<ChangePlanResult> {
  return apiClient.patch<ChangePlanResult>(
    '/billing/plan',
    { planId, ...(billingInterval && { billingInterval }) },
    { authToken }
  );
}

export type ValidateDowngradeResult = {
  allowed: boolean;
  errors: string[];
  warnings: string[];
};

export function validateDowngrade(
  authToken: string,
  planId: string,
): Promise<ValidateDowngradeResult> {
  return apiClient.get<ValidateDowngradeResult>(
    `/billing/plan/validate-downgrade?planId=${encodeURIComponent(planId)}`,
    { authToken },
  );
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
