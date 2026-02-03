import { apiClient } from '@infrastructure/api/client';
import type { OnboardingStatusResponse } from './types';

export function getOnboardingStatus(
  authToken: string,
): Promise<OnboardingStatusResponse> {
  return apiClient.get('/onboarding/status', { authToken });
}

export function updateOnboardingStatus(
  authToken: string,
  status: 'in_progress' | 'completed' | 'skipped',
): Promise<{ status: string }> {
  return apiClient.patch('/onboarding/status', { status }, { authToken });
}
