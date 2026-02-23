'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTrackUsage } from './useTrackUsage';
import { useAuth } from '@shared/providers/AuthProvider';
import { recordPageVisit } from './api';

const PAGE_VISIT_COOLDOWN_MS = 30_000; // No repetir misma ruta en 30 s

/**
 * Envía screen_view al cambiar de ruta (throttled por sección).
 * Registra visita a página para contador del panel proveedor (por empresa y por ruta).
 * Solo se ejecuta cuando hay sesión; no bloquea la UI.
 */
export function UsageTracker() {
  const pathname = usePathname();
  const { track } = useTrackUsage();
  const { token } = useAuth();
  const lastVisit = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const segment = pathname.slice(1).split('/').filter(Boolean)[0];
    const section = segment ?? 'app';
    track('screen_view', { section });
  }, [pathname, track]);

  useEffect(() => {
    if (!pathname || !token) return;
    const now = Date.now();
    const last = lastVisit.current;
    if (last?.path === pathname && now - last.at < PAGE_VISIT_COOLDOWN_MS) return;
    lastVisit.current = { path: pathname, at: now };
    recordPageVisit(token, pathname).catch(() => {});
  }, [pathname, token]);

  return null;
}
