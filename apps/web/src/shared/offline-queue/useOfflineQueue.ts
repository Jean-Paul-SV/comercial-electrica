'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getPendingQueue,
  addToQueue,
  removeFromQueue,
  subscribe,
  type PendingOperation,
} from './offlineQueueStore';
import { apiClient } from '@infrastructure/api/client';
import { useOnlineStatus } from '@shared/hooks/useOnlineStatus';

const TOKEN_KEY = 'ce_access_token';

export function useOfflineQueue() {
  const [pending, setPending] = useState<PendingOperation[]>(() =>
    getPendingQueue(),
  );
  const isOnline = useOnlineStatus();

  useEffect(() => {
    return subscribe(setPending);
  }, []);

  const processQueue = useCallback(async () => {
    const items = getPendingQueue();
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token || items.length === 0) return;

    for (const item of [...items]) {
      try {
        const opts = { authToken: token, idempotencyKey: item.idempotencyKey };
        if (item.method === 'POST') {
          await apiClient.post(item.path, item.body, opts);
        } else if (item.method === 'PATCH' || item.method === 'PUT') {
          await apiClient.patch(item.path, item.body, opts);
        } else if (item.method === 'DELETE') {
          await apiClient.delete(item.path, opts);
        }
        removeFromQueue(item.id);
      } catch {
        // Dejar en cola; el usuario puede reintentar o eliminar
      }
    }
  }, []);

  useEffect(() => {
    if (isOnline && pending.length > 0) {
      void processQueue();
    }
  }, [isOnline, pending.length, processQueue]);

  const retry = useCallback((id: string) => {
    void processQueue();
  }, [processQueue]);

  const remove = useCallback((id: string) => {
    removeFromQueue(id);
  }, []);

  return {
    pending,
    pendingCount: pending.length,
    processQueue,
    retry,
    remove,
  };
}

export { addToQueue, type PendingOperation };
