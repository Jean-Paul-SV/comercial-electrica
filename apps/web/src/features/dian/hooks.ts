'use client';

import { useQuery } from '@tanstack/react-query';
import { getDocumentStatus } from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useDianDocumentStatus(documentId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['dian', 'document', documentId],
    enabled: Boolean(token && documentId),
    queryFn: () => getDocumentStatus(documentId!, token!),
  });
}
