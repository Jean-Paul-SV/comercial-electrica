import { apiClient } from '@infrastructure/api/client';
import type { SubscriptionInfo, BillingPlan, ChangePlanResult } from './types';

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

// Stripe eliminado: facturación solo con Wompi.

// --- Wompi (Colombia: Nequi, PSE, tarjetas) ---

export type WompiConfig = { enabled: boolean; publicKey: string | null };

export function getWompiConfig(): Promise<WompiConfig> {
  return apiClient.get<WompiConfig>('/billing/wompi/config');
}

export type WompiAcceptanceTokens = {
  acceptance_token: string;
  accept_personal_auth: string;
  permalink_terms: string;
  permalink_personal_data: string;
};

export function getWompiAcceptanceTokens(authToken: string): Promise<WompiAcceptanceTokens> {
  return apiClient.get<WompiAcceptanceTokens>('/billing/wompi/acceptance-tokens', { authToken });
}

export type WompiPaymentMethodType = 'NEQUI' | 'PSE' | 'CARD';
export type WompiCreateTransactionPayload = {
  planId: string;
  billingInterval: 'monthly' | 'yearly';
  acceptance_token: string;
  accept_personal_auth: string;
  customer_email: string;
  payment_method_type: WompiPaymentMethodType;
  payment_method: Record<string, unknown>;
  customer_full_name?: string;
  customer_phone?: string;
};

export type WompiTransactionResult = {
  transactionId: string;
  status: string;
  async_payment_url?: string;
  status_message?: string;
};

export function createWompiTransaction(
  authToken: string,
  payload: WompiCreateTransactionPayload,
): Promise<WompiTransactionResult> {
  return apiClient.post<WompiTransactionResult>('/billing/wompi/transaction', payload, { authToken });
}

export type WompiTransactionStatus = {
  status: string;
  status_message?: string;
  async_payment_url?: string;
  activated?: boolean;
};

export function getWompiTransaction(
  authToken: string,
  transactionId: string,
): Promise<WompiTransactionStatus> {
  return apiClient.get<WompiTransactionStatus>(
    `/billing/wompi/transaction/${encodeURIComponent(transactionId)}`,
    { authToken },
  );
}
