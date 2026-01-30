/**
 * Configuración de navegación del sidebar.
 * ÚNICO lugar donde se definen rutas y secciones.
 * Para agregar/quitar módulos: editar solo este archivo.
 */

import type { NavTreeConfig } from './types';

export const navConfig: NavTreeConfig = {
  sections: [
    {
      id: 'operaciones',
      label: 'Operaciones',
      order: 0,
      items: [
        { id: 'dashboard', href: '/app', label: 'Dashboard', icon: 'LayoutDashboard', order: 0 },
        { id: 'sales', href: '/sales', label: 'Ventas', icon: 'ShoppingCart', order: 1 },
        { id: 'returns', href: '/returns', label: 'Devoluciones', icon: 'RotateCcw', order: 2 },
        { id: 'cash', href: '/cash', label: 'Caja', icon: 'Wallet', order: 3 },
        { id: 'expenses', href: '/expenses', label: 'Gastos', icon: 'Receipt', order: 4 },
        { id: 'quotes', href: '/quotes', label: 'Cotizaciones', icon: 'FileSignature', order: 5 },
      ],
    },
    {
      id: 'catalogo',
      label: 'Catálogo',
      order: 1,
      items: [
        { id: 'products', href: '/products', label: 'Productos', icon: 'Package', order: 0 },
        { id: 'customers', href: '/customers', label: 'Clientes', icon: 'Users', order: 1 },
      ],
    },
    {
      id: 'inventario',
      label: 'Inventario',
      order: 2,
      items: [
        { id: 'inventory', href: '/inventory', label: 'Inventario', icon: 'Boxes', order: 0 },
      ],
    },
    {
      id: 'compras',
      label: 'Compras',
      order: 3,
      roles: ['ADMIN'],
      items: [
        { id: 'suppliers', href: '/suppliers', label: 'Proveedores', icon: 'Truck', order: 0 },
        { id: 'purchases', href: '/purchases', label: 'Compras', icon: 'ShoppingBag', order: 1 },
        { id: 'supplier-invoices', href: '/supplier-invoices', label: 'Facturas proveedor', icon: 'FileCheck', order: 2 },
      ],
    },
    {
      id: 'analisis',
      label: 'Análisis',
      order: 4,
      roles: ['ADMIN'],
      items: [
        { id: 'reports', href: '/reports', label: 'Reportes', icon: 'FileText', order: 0 },
        { id: 'audit', href: '/audit', label: 'Auditoría', icon: 'ClipboardList', order: 1 },
      ],
    },
  ],
};
