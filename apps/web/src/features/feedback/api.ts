import { apiClient } from '@infrastructure/api/client';

export type FeedbackItem = {
  id: string;
  message: string;
  status: string;
  createdAt: string;
};

export function submitFeedback(
  authToken: string,
  message: string,
): Promise<FeedbackItem> {
  return apiClient.post<FeedbackItem>('/feedback', { message }, { authToken });
}

export function getMyFeedback(authToken: string): Promise<FeedbackItem[]> {
  return apiClient.get<FeedbackItem[]>('/feedback/my', { authToken });
}
