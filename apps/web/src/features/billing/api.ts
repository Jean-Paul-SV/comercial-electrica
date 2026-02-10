import { apiClient } from '@infrastructure/api/client';
import type { SubscriptionInfo, PortalSessionResponse } from './types';

export function getSubscription(authToken: string): Promise<SubscriptionInfo> {
  return apiClient.get('/billing/subscription', { authToken });
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
