/**
 * Configuración de navegación del sidebar.
 * ÚNICO lugar donde se definen rutas y secciones.
 * Para agregar/quitar módulos: editar solo este archivo.
 */

import type { NavTreeConfig } from './types';

/** Navegación con moduleCode por sección/ítem (ARQUITECTURA_MODULAR_SAAS). core = siempre incluido en todos los planes. */
export const navConfig: NavTreeConfig = {
  sections: [
    {
      id: 'operaciones',
      label: 'Operaciones',
      order: 0,
      moduleCode: 'core',
      items: [
        { id: 'dashboard', href: '/app', label: 'Dashboard', icon: 'LayoutDashboard', order: 0, moduleCode: 'core' },
        { id: 'sales', href: '/sales', label: 'Ventas', icon: 'ShoppingCart', order: 1, moduleCode: 'core' },
        { id: 'invoices', href: '/invoices', label: 'Facturas', icon: 'FileText', order: 2, moduleCode: 'core' },
        { id: 'returns', href: '/returns', label: 'Devoluciones', icon: 'RotateCcw', order: 3, moduleCode: 'core' },
        { id: 'cash', href: '/cash', label: 'Caja', icon: 'Wallet', order: 4, moduleCode: 'core' },
        { id: 'expenses', href: '/expenses', label: 'Gastos', icon: 'Receipt', order: 5, moduleCode: 'core' },
        { id: 'quotes', href: '/quotes', label: 'Cotizaciones', icon: 'FileSignature', order: 6, moduleCode: 'core' },
      ],
    },
    {
      id: 'catalogo',
      label: 'Catálogo',
      order: 1,
      moduleCode: 'core',
      items: [
        { id: 'products', href: '/products', label: 'Productos', icon: 'Package', order: 0, moduleCode: 'core' },
        { id: 'product-dictionary', href: '/products/dictionary', label: 'Diccionario de búsqueda', icon: 'BookOpen', order: 1, moduleCode: 'core' },
        { id: 'customers', href: '/customers', label: 'Clientes', icon: 'Users', order: 2, moduleCode: 'core' },
      ],
    },
    {
      id: 'inventario',
      label: 'Inventario',
      order: 2,
      moduleCode: 'inventory',
      items: [
        { id: 'inventory', href: '/inventory', label: 'Inventario', icon: 'Boxes', order: 0, moduleCode: 'inventory' },
      ],
    },
    {
      id: 'compras',
      label: 'Compras',
      order: 3,
      roles: ['ADMIN'],
      requiredPermission: 'suppliers:read',
      moduleCode: 'suppliers',
      items: [
        { id: 'suppliers', href: '/suppliers', label: 'Proveedores', icon: 'Truck', order: 0, requiredPermission: 'suppliers:read', moduleCode: 'suppliers' },
        { id: 'supplier-invoices', href: '/supplier-invoices', label: 'Facturas proveedor', icon: 'FileCheck', order: 1, requiredPermission: 'supplier-invoices:read', moduleCode: 'suppliers' },
      ],
    },
    {
      id: 'analisis',
      label: 'Análisis',
      order: 4,
      roles: ['ADMIN'],
      requiredPermission: 'reports:read',
      items: [
        { id: 'reports', href: '/reports', label: 'Reportes', icon: 'FileText', order: 0, requiredPermission: 'reports:read', moduleCode: 'advanced_reports' },
        { id: 'audit', href: '/audit', label: 'Auditoría', icon: 'ClipboardList', order: 1, requiredPermission: 'audit:read', moduleCode: 'audit' },
      ],
    },
    {
      id: 'administracion',
      label: 'Administración',
      order: 5,
      requiredPermission: 'users:read',
      moduleCode: 'core',
      items: [
        { id: 'users', href: '/users', label: 'Usuarios', icon: 'UserPlus', order: 0, requiredPermission: 'users:read', moduleCode: 'core' },
        { id: 'backups', href: '/backups', label: 'Backups', icon: 'Database', order: 1, requiredPermission: 'backups:manage', moduleCode: 'backups' },
      ],
    },
  ],
};
