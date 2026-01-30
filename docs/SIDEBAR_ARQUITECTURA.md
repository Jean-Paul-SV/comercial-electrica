# Arquitectura modular del Sidebar

Sidebar pensado para **crecimiento empresarial**: modular, por roles, reutilizable en desktop y móvil.

---

## 1. Estructura de archivos

```
shared/
├── navigation/           # Configuración y lógica de navegación
│   ├── types.ts          # AppRole, NavItemConfig, NavSectionConfig, NavTreeConfig
│   ├── config.ts         # ÚNICO lugar donde se definen rutas y secciones
│   ├── icons.tsx         # Registro nombre → componente de icono
│   ├── filterByRole.ts   # Filtrado del árbol por rol
│   ├── routeLabel.ts     # Etiqueta de la ruta actual (header)
│   └── index.ts
├── auth/
│   └── roles.ts          # canAccessPath, ADMIN_ONLY_PATHS (derivado de config)
└── ui/
    ├── sidebar/          # Componentes visuales
    │   ├── SidebarContext.tsx   # Estado colapsado / móvil (opcional)
    │   ├── Sidebar.tsx          # Contenedor
    │   ├── SidebarBrand.tsx     # Logo + nombre producto
    │   ├── SidebarNav.tsx       # Lista de secciones
    │   ├── SidebarNavSection.tsx
    │   ├── SidebarNavItem.tsx
    │   ├── SidebarFooter.tsx    # Usuario + cerrar sesión
    │   └── index.ts
    └── AppShell.tsx       # Layout que usa Sidebar + config + rol
```

---

## 2. Separación de responsabilidades

| Capa | Responsabilidad | Dónde cambiar |
|------|-----------------|----------------|
| **Configuración** | Qué rutas existen, en qué sección, qué roles las ven | `navigation/config.ts` |
| **Permisos** | Quién ve qué (filtrado por rol, rutas protegidas) | `navigation/filterByRole.ts`, `auth/roles.ts` |
| **Componentes** | Cómo se ve el menú (secciones, ítems, estados activos) | `ui/sidebar/*` |
| **Layout** | Ensamblado desktop/móvil, header, provider | `AppShell.tsx`, `layout.tsx` |

---

## 3. Cómo agregar o quitar módulos

**Solo se toca la configuración**, no la UI:

1. Abrir `shared/navigation/config.ts`.
2. Añadir o editar una sección en `sections`:
   - `id`, `label` (título del grupo), `order`, opcionalmente `roles`.
   - En `items`: `id`, `href`, `label`, `icon` (nombre en `icons.tsx`), opcionalmente `roles`, `order`.
3. Si el ítem usa un icono nuevo, registrarlo en `shared/navigation/icons.tsx`.

**Ejemplo: nuevo módulo "Almacén" solo para ADMIN**

```ts
// config.ts
{
  id: 'almacen',
  label: 'Almacén',
  order: 5,
  roles: ['ADMIN'],
  items: [
    { id: 'warehouses', href: '/warehouses', label: 'Bodegas', icon: 'Warehouse', order: 0 },
  ],
},
```

Y en `icons.tsx`: `import { Warehouse } from 'lucide-react';` y `Warehouse` en `navIconMap`.

---

## 4. Roles y permisos

- **ADMIN**: ve todas las secciones e ítems.
- **USER** (u otros roles): solo ve ítems sin `roles` o cuyo array `roles` incluye su rol.
- Las rutas solo-ADMIN se derivan de `config` en `auth/roles.ts` (una sola fuente de verdad).
- Añadir un nuevo rol (ej. `CAJERO`): extender `AppRole` en `navigation/types.ts` y en `config` asignar `roles: ['CAJERO']` a los ítems que correspondan.

---

## 5. UX/UI aplicadas

- **Agrupación por secciones**: Operaciones, Catálogo, Inventario, Compras, Análisis.
- **Estado activo**: ítem de la ruta actual con `bg-primary/10 text-primary`.
- **Jerarquía**: títulos de sección en mayúsculas, ítems con icono + texto.
- **Accesibilidad**: `aria-current="page"`, `aria-label`, cierre con Escape en drawer.
- **Móvil**: drawer que se abre/cierra, overlay, mismo árbol de navegación que desktop.

---

## 6. Escalabilidad futura

- **Producto/franquicia**: cambiar `productName` (y opcionalmente logo) por tenant o marca; la estructura de navegación puede venir de config por entorno o API.
- **Colapsable**: ya existe `SidebarProvider` con `isCollapsed` / `toggleCollapsed`; falta un botón en la UI que llame a `toggleCollapsed` (ej. en el header o en el pie del sidebar).
- **Feature flags**: en `filterByRole` o en un nuevo filtro se puede excluir ítems según flags (ej. `item.featureFlag && !flags[item.featureFlag]`).
- **Nuevos roles**: ampliar `AppRole` y usar `roles` en secciones/ítems en `config.ts`.

---

## 7. Buenas prácticas

- No hardcodear rutas ni etiquetas en componentes; usar siempre `config` y `getRouteLabel`.
- Mantener `config.ts` como datos (strings, órdenes, roles); la resolución de iconos se hace en `icons.tsx`.
- Para deshabilitar temporalmente un ítem sin borrarlo: `disabled: true` en ese ítem en `config`.
- El sidebar funciona sin `SidebarProvider` (estado local para móvil, no colapsado); con provider se habilita colapsado y estado móvil compartido.
