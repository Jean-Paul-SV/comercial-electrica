'use client';

import { useCallback, useRef } from 'react';
import { useAuth } from '@shared/providers/AuthProvider';
import { recordUsageEvent } from './api';

const SCREEN_VIEW_COOLDOWN_MS = 60_000; // No repetir mismo section en 1 min

/**
 * Hook para registrar eventos de uso (solo para mejorar el producto, uso interno).
 * track() es fire-and-forget; no bloquea la UI.
 */
export function useTrackUsage() {
  const { token } = useAuth();
  const lastScreenView = useRef<{ section: string; at: number } | null>(null);

  const track = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      if (!token) return;
      // Throttle screen_view por section
      if (event === 'screen_view' && payload?.section) {
        const section = String(payload.section);
        const now = Date.now();
        const last = lastScreenView.current;
        if (last?.section === section && now - last.at < SCREEN_VIEW_COOLDOWN_MS) {
          return;
        }
        lastScreenView.current = { section, at: now };
      }
      recordUsageEvent(token, { event, payload }).catch(() => {
        // Silently ignore; no afectar UX
      });
    },
    [token]
  );

  return { track };
}
