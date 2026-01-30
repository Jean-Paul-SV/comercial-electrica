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
};

export function SidebarNavItem({ item, collapsed = false }: SidebarNavItemProps) {
  const pathname = usePathname();
  const active = pathname === item.href || (item.href !== '/app' && pathname?.startsWith(item.href + '/'));
  const Icon = getNavIcon(item.icon);

  if (item.disabled) {
    return (
      <span
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/60 cursor-not-allowed',
          collapsed && 'justify-center px-2'
        )}
        aria-disabled
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        {!collapsed && item.label}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        collapsed && 'justify-center px-2'
      )}
      aria-current={active ? 'page' : undefined}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
