'use client';

import { Button } from '@shared/components/ui/button';
import { LogOut } from 'lucide-react';
import { cn } from '@lib/utils';

type SidebarFooterProps = {
  /** Email del usuario (opcional). */
  userEmail?: string | null;
  /** Rol del usuario (opcional). */
  userRole?: string | null;
  /** Callback al cerrar sesión. */
  onLogout: () => void;
  /** Modo colapsado: oculta texto secundario. */
  collapsed?: boolean;
  className?: string;
};

export function SidebarFooter({
  userEmail,
  userRole,
  onLogout,
  collapsed = false,
  className,
}: SidebarFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-t border-border/80 pt-4 shrink-0',
        className
      )}
    >
      {!collapsed && (userEmail || userRole) && (
        <div className="space-y-0.5 px-1">
          {userEmail && (
            <p className="text-xs text-muted-foreground truncate" title={userEmail}>
              {userEmail}
            </p>
          )}
          {userRole && (
            <span className="text-xs font-medium text-muted-foreground">
              {userRole}
            </span>
          )}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'w-full justify-start gap-2 text-muted-foreground hover:text-foreground',
          collapsed && 'justify-center px-2'
        )}
        onClick={onLogout}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!collapsed && <span>Cerrar sesión</span>}
      </Button>
    </div>
  );
}
