'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTrackUsage } from './useTrackUsage';

/**
 * Envía screen_view al cambiar de ruta (throttled por sección).
 * Solo se ejecuta cuando hay sesión; no bloquea la UI.
 */
export function UsageTracker() {
  const pathname = usePathname();
  const { track } = useTrackUsage();

  useEffect(() => {
    if (!pathname) return;
    const segment = pathname.slice(1).split('/').filter(Boolean)[0];
    const section = segment ?? 'app';
    track('screen_view', { section });
  }, [pathname, track]);

  return null;
}
