'use client';

import { SidebarNavSection } from './SidebarNavSection';
import type { NavSectionConfig } from '@shared/navigation/types';

type SidebarNavProps = {
  sections: NavSectionConfig[];
  collapsed?: boolean;
};

export function SidebarNav({ sections, collapsed = false }: SidebarNavProps) {
  return (
    <nav
      className="flex flex-col gap-6"
      aria-label="Navegación principal"
    >
      {sections.map((section) => (
        <SidebarNavSection
          key={section.id}
          section={section}
          collapsed={collapsed}
        />
      ))}
    </nav>
  );
}
