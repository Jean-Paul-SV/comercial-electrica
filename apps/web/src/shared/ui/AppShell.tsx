'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';
import { useOnlineStatus } from '@shared/hooks/useOnlineStatus';
import { Button } from '@shared/components/ui/button';
import { cn } from '@lib/utils';
import { Menu, X, LogOut, WifiOff, LayoutDashboard, ShoppingCart, Wallet, MoreHorizontal, Clock } from 'lucide-react';
import Link from 'next/link';
import { AlertsBell } from '@shared/components/AlertsBell';
import { ProviderAlertsBell } from '@shared/components/ProviderAlertsBell';
import { OfflineQueueBell } from '@shared/components/OfflineQueueBell';
import { DianAlertsBanner } from '@shared/components/DianAlertsBanner';
import { SupportWhatsAppButton } from '@shared/components/SupportWhatsAppButton';
import { Sidebar, useSidebarOptional } from '@shared/ui/sidebar';
import { navConfig } from '@shared/navigation/config';
import { getNavForRole } from '@shared/navigation/filterByRole';
import { getRouteLabel } from '@shared/navigation/routeLabel';
import { ChangePasswordDialog } from '@features/auth/ChangePasswordDialog';
import type { AppRole } from '@shared/navigation/types';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    user,
    permissions,
    enabledModules,
    isPlatformAdmin,
    logout,
    mustChangePassword,
    clearMustChangePassword,
    sessionRemainingSeconds,
  } = useAuth();
  const isOnline = useOnlineStatus();
  const sidebarContext = useSidebarOptional();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const isMobileOpen = sidebarContext?.isMobileOpen ?? mobileOpen;
  const setMobileOpenState = sidebarContext?.setMobileOpen ?? setMobileOpen;
  const isCollapsed = sidebarContext?.isCollapsed ?? false;

  function formatRemainingMinutes(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '< 1 min';
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes <= 0) return '< 1 min';
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
  }

  const sections = getNavForRole(
    navConfig.sections,
    user?.role as AppRole | undefined,
    permissions,
    enabledModules?.length ? enabledModules : undefined,
    isPlatformAdmin
  );
  const routeLabel = getRouteLabel(pathname ?? '');

  useEffect(() => {
    setMobileOpenState(false);
  }, [pathname]);

  useEffect(() => {
    if (mustChangePassword) setChangePasswordOpen(true);
  }, [mustChangePassword]);

  useEffect(() => {
    const openDialog = () => setChangePasswordOpen(true);
    window.addEventListener('open-change-password', openDialog);
    return () => window.removeEventListener('open-change-password', openDialog);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpenState(false);
    };
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [isMobileOpen, setMobileOpenState]);

  return (
    <div
      className={cn(
        'min-h-screen bg-background flex flex-col lg:grid',
        isCollapsed ? 'lg:grid-cols-[72px_1fr]' : 'lg:grid-cols-[240px_1fr]'
      )}
    >
      {!isOnline && (
        <div
          className="col-span-full flex items-center justify-center gap-2 py-2 px-4 bg-warning/15 text-warning-foreground border-b border-warning/30 text-sm"
          role="status"
          aria-live="polite"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Sin conexión. Los datos pueden no estar actualizados. Se reintentará al recuperar la conexión.
          </span>
        </div>
      )}
      {/* Sidebar desktop: siempre visible en lg+ */}
      <aside
        className="hidden lg:flex lg:flex-col border-r border-border/60 bg-card shrink-0"
        style={{ width: isCollapsed ? 72 : 240 } as React.CSSProperties}
      >
        <Sidebar
          sections={sections}
          userEmail={user?.email}
          userRole={user?.role}
          onLogout={logout}
          collapsed={isCollapsed}
          showFooter={true}
          showCollapseToggle={true}
        />
      </aside>

      {/* Overlay móvil */}
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileOpenState(false)}
        />
      )}

      {/* Drawer móvil: menú de navegación (abrir con el icono de hamburguesa en la barra superior) */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[280px] max-w-[85vw] flex flex-col border-r border-border bg-card transition-transform duration-250 ease-out lg:hidden',
          'pt-[env(safe-area-inset-top)]',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!isMobileOpen}
        aria-label="Menú de navegación"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/80 shrink-0">
          <span className="font-semibold text-foreground text-base">Menú</span>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 min-h-[44px] min-w-[44px]"
            onClick={() => setMobileOpenState(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
          <Sidebar
            sections={sections}
            userEmail={null}
            userRole={null}
            onLogout={logout}
            collapsed={false}
            showFooter={false}
            className="border-0 w-full"
          />
        </div>
        <div className="p-4 border-t border-border/80">
          {user && (
            <div className="mb-3 space-y-0.5">
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <span className="text-xs font-medium text-muted-foreground">{user.role === 'USER' ? 'USUARIO' : user.role}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex flex-col min-h-0 flex-1">
        <header className="shrink-0 border-b border-border/80 bg-background/80 backdrop-blur-sm pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-6 pt-[env(safe-area-inset-top)]">
          <div className="h-14 flex items-center justify-between gap-2 min-h-[56px]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden shrink-0 min-h-[44px] min-w-[44px] h-11 w-11 rounded-lg"
                onClick={() => setMobileOpenState(true)}
                aria-label="Abrir menú de navegación"
              >
                <Menu className="h-6 w-6" aria-hidden />
              </Button>
              <span className="text-sm font-medium text-foreground truncate">
                {routeLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {sessionRemainingSeconds != null && sessionRemainingSeconds > 0 && (
                <div className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Sesión: {formatRemainingMinutes(sessionRemainingSeconds)}
                  </span>
                </div>
              )}
              <OfflineQueueBell />
              {/* Alertas operativas (caja, ventas, inventario) solo en rutas del negocio */}
              {!pathname?.startsWith('/provider') && <AlertsBell />}
              {/* Alertas del panel (planes, empresas, Stripe) solo en panel proveedor */}
              {pathname?.startsWith('/provider') && <ProviderAlertsBell />}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 lg:pb-8">
          <div className="mx-auto w-full max-w-[1137px] animate-in fade-in duration-200">
            {enabledModules?.includes('electronic_invoicing') && <DianAlertsBanner />}
            {children}
          </div>
        </main>

        {/* Botón WhatsApp solo para administradores de empresa (no en panel proveedor) */}
        {!isPlatformAdmin && <SupportWhatsAppButton />}
        {!isPlatformAdmin && (
          <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
            aria-label="Navegación principal"
          >
            <div className="grid grid-cols-4 h-14 min-h-[56px]">
              <Link
                href="/app"
                className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground focus:text-foreground min-h-[44px] active:bg-muted/50"
                aria-current={pathname === '/app' ? 'page' : undefined}
              >
                <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden />
                <span className="text-[10px] font-medium">Inicio</span>
              </Link>
              <Link
                href="/sales"
                className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground focus:text-foreground min-h-[44px] active:bg-muted/50"
                aria-current={pathname?.startsWith('/sales') ? 'page' : undefined}
              >
                <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
                <span className="text-[10px] font-medium">Ventas</span>
              </Link>
              <Link
                href="/cash"
                className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground focus:text-foreground min-h-[44px] active:bg-muted/50"
                aria-current={pathname?.startsWith('/cash') ? 'page' : undefined}
              >
                <Wallet className="h-5 w-5 shrink-0" aria-hidden />
                <span className="text-[10px] font-medium">Caja</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpenState(true)}
                className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground focus:text-foreground min-h-[44px] active:bg-muted/50"
                aria-label="Abrir menú"
              >
                <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden />
                <span className="text-[10px] font-medium">Menú</span>
              </button>
            </div>
          </nav>
        )}
      </div>
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={(open) => {
          if (!open && mustChangePassword) return;
          setChangePasswordOpen(open);
        }}
        onSuccess={() => {
          clearMustChangePassword();
          setChangePasswordOpen(false);
        }}
        forceOpen={mustChangePassword}
      />
    </div>
  );
}
