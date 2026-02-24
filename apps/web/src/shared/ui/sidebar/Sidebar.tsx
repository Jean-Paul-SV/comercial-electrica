'use client';

import { cn } from '@lib/utils';
import { Button } from '@shared/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SidebarBrand } from './SidebarBrand';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter } from './SidebarFooter';
import { useSidebarOptional } from './SidebarContext';
import type { NavSectionConfig } from '@shared/navigation/types';

type SidebarProps = {
  /** Secciones ya filtradas por rol. */
  sections: NavSectionConfig[];
  /** Email del usuario (opcional). */
  userEmail?: string | null;
  /** Rol del usuario (opcional). */
  userRole?: string | null;
  /** Callback al cerrar sesión. */
  onLogout: () => void;
  /** Modo colapsado (solo iconos). */
  collapsed?: boolean;
  /** Nombre del producto en la marca. */
  productName?: string;
  /** Clase del contenedor. */
  className?: string;
  /** Para drawer móvil: no mostrar footer duplicado si ya está fuera. */
  showFooter?: boolean;
  /** Mostrar botón colapsar/expandir (solo desktop). */
  showCollapseToggle?: boolean;
};

export function Sidebar({
  sections,
  userEmail,
  userRole,
  onLogout,
  collapsed = false,
  productName = 'Orion',
  className,
  showFooter = true,
  showCollapseToggle = false,
}: SidebarProps) {
  const sidebarContext = useSidebarOptional();

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border/50 bg-card shrink-0 transition-[width] duration-250 ease-in-out overflow-hidden',
        collapsed ? 'w-[72px]' : 'w-[240px]',
        className
      )}
      aria-label="Navegación principal"
    >
      <div className="flex flex-col flex-1 min-h-0 p-4">
        <div className={cn('mb-6', collapsed && 'mb-4')}>
          <SidebarBrand
            productName={productName}
            collapsed={collapsed}
          />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <SidebarNav sections={sections} collapsed={collapsed} />
        </div>
        {showCollapseToggle && sidebarContext && (
          <div className={cn('pt-2', collapsed && 'flex justify-center')}>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8 text-muted-foreground hover:text-foreground', !collapsed && 'w-full justify-start gap-2')}
              onClick={sidebarContext.toggleCollapsed}
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" />{!collapsed && <span className="text-xs">Colapsar</span>}</>}
            </Button>
          </div>
        )}
      </div>
      {showFooter && (
        <div className="p-4">
          <SidebarFooter
            userEmail={userEmail}
            userRole={userRole}
            onLogout={onLogout}
            collapsed={collapsed}
          />
        </div>
      )}
    </aside>
  );
}
