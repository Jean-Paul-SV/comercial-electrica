'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type SidebarContextValue = {
  /** Sidebar colapsado (solo iconos). Solo desktop. */
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  /** Drawer móvil abierto. */
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setMobileOpen] = useState(false);
  const toggleCollapsed = useCallback(() => setIsCollapsed((v) => !v), []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleCollapsed,
        isMobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return ctx;
}

/** Hook opcional: devuelve null si no hay provider (para uso sin provider). */
export function useSidebarOptional(): SidebarContextValue | null {
  return useContext(SidebarContext);
}
