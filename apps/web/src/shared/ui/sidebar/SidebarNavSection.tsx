'use client';

import { cn } from '@lib/utils';
import { SidebarNavItem } from './SidebarNavItem';
import type { NavSectionConfig } from '@shared/navigation/types';

type SidebarNavSectionProps = {
  section: NavSectionConfig;
  collapsed?: boolean;
};

export function SidebarNavSection({ section, collapsed = false }: SidebarNavSectionProps) {
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
            <SidebarNavItem item={item} collapsed={collapsed} />
          </li>
        ))}
      </ul>
    </div>
  );
}
