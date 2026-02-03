/**
 * Mapa ruta → módulo para guard de rutas (SaaS).
 * Rutas con módulo distinto de "core" requieren que el tenant tenga ese módulo habilitado.
 */

import { navConfig } from './config';

/** Obtiene el moduleCode requerido para una pathname, o null si es core / no definido. */
export function getModuleForPath(pathname: string | null): string | null {
  if (!pathname) return null;

  const allItems = navConfig.sections.flatMap((s) => s.items);
  const exact = allItems.find((item) => pathname === item.href);
  if (exact?.moduleCode && exact.moduleCode !== 'core') return exact.moduleCode;

  const withPrefix = [...allItems]
    .filter((item) => item.href !== '/app' && item.moduleCode && item.moduleCode !== 'core')
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0));
  const prefix = withPrefix.find(
    (item) => pathname.startsWith(item.href + '/')
  );
  if (prefix?.moduleCode) return prefix.moduleCode;

  return null;
}
