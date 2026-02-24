'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lib/utils';
import { getNavIcon } from '@shared/navigation/icons';
import type { NavItemConfig } from '@shared/navigation/types';

type SidebarNavItemProps = {
  item: NavItemConfig;
  /** Modo colapsado: solo icono, sin label. */
  collapsed?: boolean;
  /** Si se pasa, se usa en lugar de calcular por pathname (para que solo un ítem por sección quede activo). */
  isActive?: boolean;
};

export function SidebarNavItem({ item, collapsed = false, isActive: isActiveProp }: SidebarNavItemProps) {
  const pathname = usePathname();
  const activeByPath = pathname === item.href || (item.href !== '/app' && pathname?.startsWith(item.href + '/'));
  const active = isActiveProp !== undefined ? isActiveProp : activeByPath;
  const Icon = getNavIcon(item.icon);

  const linkClass = cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200',
    'min-h-[44px] sm:min-h-0', // Área táctil mínima en móvil (44px recomendado)
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    active
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    collapsed && 'justify-center px-2'
  );

  if (item.disabled) {
    return (
      <span
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/60 cursor-not-allowed min-h-[44px] sm:min-h-0',
          collapsed && 'justify-center px-2'
        )}
        aria-disabled
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span
          className={cn(
            'truncate transition-opacity duration-200 ease-out',
            collapsed && 'opacity-0 max-w-0 overflow-hidden'
          )}
        >
          {item.label}
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={linkClass}
      aria-current={active ? 'page' : undefined}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span
        className={cn(
          'truncate transition-opacity duration-200 ease-out',
          collapsed && 'opacity-0 max-w-0 overflow-hidden'
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}
