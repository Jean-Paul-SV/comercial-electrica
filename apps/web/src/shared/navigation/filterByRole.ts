/**
 * Filtrado de navegación por rol, permisos (RBAC) y módulos habilitados (SaaS).
 * Si hay enabledModules: ítem/sección con moduleCode visible solo si está en enabledModules (o sin moduleCode = core siempre visible si hay core).
 * Si no hay enabledModules (undefined/vacío): no se filtra por módulo (comportamiento legacy = todo visible).
 */

import type { AppRole } from './types';
import type { NavSectionConfig, NavItemConfig } from './types';

function moduleVisible(
  moduleCode: string | undefined,
  enabledModules: string[] | undefined
): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  if (!moduleCode || moduleCode === 'core') return enabledModules.includes('core');
  return enabledModules.includes(moduleCode);
}

function itemVisible(
  item: NavItemConfig,
  role: AppRole | undefined,
  permissions: string[] | undefined,
  enabledModules: string[] | undefined
): boolean {
  if (!role) return false;
  if (item.disabled) return false;
  if (!moduleVisible(item.moduleCode, enabledModules)) return false;
  // Administrador ve todo sin depender de la lista de permisos (p. ej. RBAC sin users:read).
  if (role === 'ADMIN') return true;
  if (permissions && permissions.length > 0) {
    if (permissions.includes('*')) return true;
    if (item.requiredPermission && !permissions.includes(item.requiredPermission)) return false;
  }
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes(role);
}

function sectionVisible(
  section: NavSectionConfig,
  role: AppRole | undefined,
  permissions: string[] | undefined,
  enabledModules: string[] | undefined,
  isPlatformAdmin?: boolean
): boolean {
  if (!role) return false;
  // Admin de plataforma (sin tenant) solo ve Panel proveedor; el resto no aplica.
  if (isPlatformAdmin === true) return section.platformAdminOnly === true;
  if (section.platformAdminOnly) return false;
  if (!moduleVisible(section.moduleCode, enabledModules)) return false;
  // Administrador ve todas las secciones sin depender de la lista de permisos.
  if (role === 'ADMIN') return true;
  if (permissions && permissions.length > 0) {
    if (permissions.includes('*')) return true;
    if (section.requiredPermission && !permissions.includes(section.requiredPermission))
      return false;
  }
  if (section.roles && section.roles.length > 0 && !section.roles.includes(role)) return false;
  const hasVisibleItem = section.items.some((item) =>
    itemVisible(item, role, permissions, enabledModules)
  );
  return hasVisibleItem;
}

/**
 * Devuelve el árbol de navegación filtrado por rol, permisos, módulos habilitados y si es admin de plataforma.
 * Secciones sin ítems visibles se excluyen.
 */
export function getNavForRole(
  sections: NavSectionConfig[],
  role: AppRole | undefined,
  permissions?: string[],
  enabledModules?: string[],
  isPlatformAdmin?: boolean
): NavSectionConfig[] {
  if (!role) return [];

  return sections
    .filter((section) =>
      sectionVisible(section, role, permissions, enabledModules, isPlatformAdmin)
    )
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) =>
          itemVisible(item, role, permissions, enabledModules)
        )
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
