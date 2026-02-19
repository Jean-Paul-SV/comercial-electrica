'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';
import { useOnlineStatus } from '@shared/hooks/useOnlineStatus';
import { useSubscriptionInfo } from '@features/billing/hooks';
import { AppShell } from '@shared/ui/AppShell';
import { SidebarProvider } from '@shared/ui/sidebar';
import { canAccessPath } from '@shared/auth/roles';
import { getModuleForPath } from '@shared/navigation/routeModuleMap';
import { UsageTracker } from '@features/usage/UsageTracker';
import { WifiOff } from 'lucide-react';

const isOnboardingPath = (path: string | null) =>
  path?.startsWith('/onboarding') ?? false;

const isPlanRequiredPath = (path: string | null) =>
  path === '/plan-required';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Cargando…</p>
      </div>
    );
  }

  return <ProtectedLayoutContent>{children}</ProtectedLayoutContent>;
}

function ProtectedLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, enabledModules, isPlatformAdmin, hasCheckedStorage, isRestoringSession } = useAuth();
  const isOnline = useOnlineStatus();
  const subscriptionQuery = useSubscriptionInfo();
  const requiresPayment = subscriptionQuery.data?.requiresPayment === true;
  const isBillingPath = (pathname ?? '').startsWith('/settings/billing');

  useEffect(() => {
    if (!hasCheckedStorage) return;
    // No redirigir a login mientras se restaura la sesión (token en localStorage, getMe en curso).
    if (isRestoringSession) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user?.role && !canAccessPath(pathname ?? '', user.role)) {
      router.replace('/app');
      return;
    }
    if ((pathname ?? '').startsWith('/provider') && !isPlatformAdmin) {
      router.replace('/app');
      return;
    }
    // Admin de plataforma solo usa Panel proveedor; redirigir cualquier ruta del negocio a /provider
    const isTenantPath =
      pathname === '/app' ||
      pathname === '/' ||
      (pathname != null &&
        !pathname.startsWith('/provider') &&
        !pathname.startsWith('/onboarding') &&
        pathname !== '/plan-required');
    if (isPlatformAdmin && isTenantPath) {
      router.replace('/provider');
      return;
    }
    if (!isPlanRequiredPath(pathname) && enabledModules.length > 0) {
      const requiredModule = getModuleForPath(pathname);
      if (requiredModule && !enabledModules.includes(requiredModule)) {
        router.replace(`/plan-required?module=${encodeURIComponent(requiredModule)}`);
      }
    }
  }, [isAuthenticated, isRestoringSession, user?.role, pathname, router, enabledModules, isPlatformAdmin, hasCheckedStorage]);

  if (!hasCheckedStorage || isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Cargando sesión…</p>
      </div>
    );
  }
  if (!isAuthenticated) return null;
  if (user?.role && pathname && !canAccessPath(pathname, user.role)) {
    return null;
  }
  if ((pathname ?? '').startsWith('/provider') && !isPlatformAdmin) {
    return null;
  }
  const isTenantPathRender =
    pathname === '/app' ||
    pathname === '/' ||
    (pathname != null &&
      !pathname.startsWith('/provider') &&
      !pathname.startsWith('/onboarding') &&
      pathname !== '/plan-required');
  if (isPlatformAdmin && isTenantPathRender) {
    return null;
  }
  if (
    !isPlanRequiredPath(pathname) &&
    !isOnboardingPath(pathname) &&
    enabledModules.length > 0
  ) {
    const requiredModule = getModuleForPath(pathname);
    if (requiredModule && !enabledModules.includes(requiredModule)) {
      return null;
    }
  }

  if (isOnboardingPath(pathname)) {
    return (
      <div className="min-h-screen bg-background">
        {!isOnline && (
          <div
            className="flex items-center justify-center gap-2 py-2 px-4 bg-warning/15 text-warning-foreground border-b border-warning/30 text-sm"
            role="status"
            aria-live="polite"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>
              Sin conexión. Se reintentará al recuperar la conexión.
            </span>
          </div>
        )}
        {children}
      </div>
    );
  }

  // No mostrar sidebar hasta saber si el tenant tiene pago pendiente (evita flash de menú)
  if (!isPlatformAdmin && subscriptionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Cargando…</p>
      </div>
    );
  }

  // Pago pendiente: solo mostrar pantalla de facturación (sin sidebar)
  if (!isPlatformAdmin && requiresPayment) {
    if (!isBillingPath) {
      router.replace('/settings/billing');
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground text-sm">Redirigiendo a pago…</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <UsageTracker />
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}

