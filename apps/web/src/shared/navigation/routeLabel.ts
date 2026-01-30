/**
 * Obtiene la etiqueta de la ruta actual para el header/título.
 * Usa la configuración de navegación (una sola fuente de verdad).
 */

import { navConfig } from './config';

export function getRouteLabel(pathname: string): string {
  if (!pathname) return 'Inicio';

  const allItems = navConfig.sections.flatMap((s) => s.items);
  const exact = allItems.find((item) => pathname === item.href);
  if (exact) return exact.label;

  const sorted = [...allItems].filter((item) => item.href !== '/app').sort(
    (a, b) => b.href.length - a.href.length
  );
  const prefix = sorted.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );
  if (prefix) return prefix.label;

  const segment = pathname.slice(1).split('/')[0];
  return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : 'Inicio';
}
