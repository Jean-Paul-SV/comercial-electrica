/**
 * Rutas y visibilidad por rol.
 * ADMIN ve todo; USER solo lo que no esté restringido.
 * Rutas solo-ADMIN se derivan de la configuración de navegación (una sola fuente de verdad).
 */

import type { AppRole } from '@shared/navigation/types';
import { navConfig } from '@shared/navigation/config';

/** Rutas que solo ADMIN puede ver (derivadas del nav config). */
export const ADMIN_ONLY_PATHS: string[] = (() => {
  const paths: string[] = [];
  for (const section of navConfig.sections) {
    if (section.roles?.includes('ADMIN')) {
      for (const item of section.items) {
        if (item.href) paths.push(item.href);
      }
    }
    for (const item of section.items) {
      if (item.roles?.includes('ADMIN') && item.href) paths.push(item.href);
    }
  }
  return [...new Set(paths)];
})();

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );
}

export function canAccessPath(pathname: string, role: AppRole | undefined): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  return !isAdminOnlyPath(pathname);
}

/** Para ocultar acciones solo ADMIN en páginas (ej. botón desactivar). */
export function isAdmin(role: AppRole | undefined): boolean {
  return role === 'ADMIN';
}
