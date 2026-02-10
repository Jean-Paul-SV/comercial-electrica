'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { SidebarNavItem } from './SidebarNavItem';
import type { NavSectionConfig } from '@shared/navigation/types';

type SidebarNavSectionProps = {
  section: NavSectionConfig;
  collapsed?: boolean;
};

/** En la sección, solo el ítem con href más específico que coincida con pathname queda activo (evita que Productos y Diccionario estén ambos activos). */
function getActiveItemId(pathname: string | null, items: { id: string; href: string }[]): string | null {
  if (!pathname) return null;
  let best: { id: string; href: string } | null = null;
  for (const item of items) {
    const exact = pathname === item.href;
    const prefix = item.href !== '/app' && pathname.startsWith(item.href + '/');
    if (exact || prefix) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best?.id ?? null;
}

export function SidebarNavSection({ section, collapsed = false }: SidebarNavSectionProps) {
  const pathname = usePathname();
  const activeItemId = useMemo(
    () => getActiveItemId(pathname, section.items),
    [pathname, section.items]
  );

  if (section.items.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {section.label && !collapsed && (
        <p
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground"
          id={`nav-section-${section.id}`}
        >
          {section.label}
        </p>
      )}
      <ul
        className="space-y-0.5"
        aria-labelledby={section.label ? `nav-section-${section.id}` : undefined}
      >
        {section.items.map((item) => (
          <li key={item.id}>
            <SidebarNavItem item={item} collapsed={collapsed} isActive={activeItemId === item.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
