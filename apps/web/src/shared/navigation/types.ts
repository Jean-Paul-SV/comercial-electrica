/**
 * Tipos para la navegación modular del sidebar.
 * Pensado para escalar: múltiples roles, secciones, productos/franquicias.
 */

/** Roles del sistema. Extensible (ej. CAJERO, VENDEDOR, GERENTE). */
export type AppRole = 'ADMIN' | 'USER';

/** Ítem de navegación: una ruta en el menú. */
export type NavItemConfig = {
  /** Identificador único (para keys, analytics, feature flags). */
  id: string;
  /** Ruta (href). */
  href: string;
  /** Texto visible. */
  label: string;
  /** Nombre del icono (resuelto en runtime desde el registro). */
  icon: string;
  /** Si se define, solo estos roles ven el ítem. ADMIN ve todo. */
  roles?: AppRole[];
  /** Orden dentro de la sección (menor = más arriba). */
  order?: number;
  /** Para deshabilitar temporalmente sin borrar (mantenibilidad). */
  disabled?: boolean;
};

/** Sección del menú: agrupa ítems con opcional título. */
export type NavSectionConfig = {
  id: string;
  /** Título de la sección (opcional; si no hay título, se renderiza como grupo sin cabecera). */
  label?: string;
  /** Ítems de la sección. */
  items: NavItemConfig[];
  /** Orden de la sección en el sidebar (menor = más arriba). */
  order?: number;
  /** Si se define, solo estos roles ven la sección entera. */
  roles?: AppRole[];
};

/** Árbol de navegación completo (configuración cruda). */
export type NavTreeConfig = {
  sections: NavSectionConfig[];
};
