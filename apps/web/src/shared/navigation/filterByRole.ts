/**
 * Filtrado de navegación por rol.
 * ADMIN ve todo; el resto solo ítems/secciones sin restricción o con su rol.
 */

import type { AppRole } from './types';
import type { NavSectionConfig, NavItemConfig } from './types';

function itemVisible(item: NavItemConfig, role: AppRole | undefined): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  if (item.disabled) return false;
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes(role);
}

function sectionVisible(section: NavSectionConfig, role: AppRole | undefined): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  if (section.roles && section.roles.length > 0 && !section.roles.includes(role)) return false;
  const hasVisibleItem = section.items.some((item) => itemVisible(item, role));
  return hasVisibleItem;
}

/**
 * Devuelve el árbol de navegación filtrado por rol.
 * Secciones sin ítems visibles se excluyen.
 */
export function getNavForRole(
  sections: NavSectionConfig[],
  role: AppRole | undefined
): NavSectionConfig[] {
  if (!role) return [];

  return sections
    .filter((section) => sectionVisible(section, role))
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => itemVisible(item, role))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
