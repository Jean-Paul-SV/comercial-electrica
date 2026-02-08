/**
 * Registro de iconos para la navegación.
 * La configuración usa strings; aquí se resuelven a componentes.
 * Añadir nuevos iconos aquí cuando se agreguen rutas.
 */

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BookOpen,
  Users,
  UserPlus,
  Wallet,
  FileText,
  FileSignature,
  Boxes,
  Truck,
  ShoppingBag,
  FileCheck,
  RotateCcw,
  Receipt,
  ClipboardList,
  Database,
  type LucideIcon,
} from 'lucide-react';

export const navIconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BookOpen,
  Users,
  UserPlus,
  Wallet,
  FileText,
  FileSignature,
  Boxes,
  Truck,
  ShoppingBag,
  FileCheck,
  RotateCcw,
  Receipt,
  ClipboardList,
  Database,
};

export function getNavIcon(name: string): LucideIcon | undefined {
  return navIconMap[name];
}
