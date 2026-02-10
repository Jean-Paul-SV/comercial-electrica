'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { cn } from '@lib/utils';

type SidebarBrandProps = {
  /** Nombre del producto (ej. "Orion"). */
  productName?: string;
  /** Si true, oculta el texto (modo colapsado). */
  collapsed?: boolean;
  className?: string;
};

export function SidebarBrand({
  productName = 'Orion',
  collapsed = false,
  className,
}: SidebarBrandProps) {
  return (
    <Link
      href="/app"
      className={cn(
        'flex items-center gap-2 rounded-lg text-foreground font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        collapsed ? 'justify-center px-0' : 'px-1',
        className
      )}
      aria-label={productName}
    >
      <Zap className="h-5 w-5 shrink-0 text-primary" />
      {!collapsed && (
        <span className="truncate text-sm sm:text-base">{productName}</span>
      )}
    </Link>
  );
}
