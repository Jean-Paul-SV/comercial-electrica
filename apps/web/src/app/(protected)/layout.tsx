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
import { WifiOff, AlertCircle, CreditCard } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useCreatePortalSession } from '@features/billing/hooks';

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
  const inGracePeriod = subscriptionQuery.data?.inGracePeriod === true;
  const gracePeriodEnd = subscriptionQuery.data?.gracePeriodEnd ?? null;
  const canManageBilling = subscriptionQuery.data?.canManageBilling ?? false;
  const createPortalMutation = useCreatePortalSession();
  const isBillingPath = (pathname ?? '').startsWith('/settings/billing');

  const handleOpenPortal = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const returnUrl = `${baseUrl}/settings/billing`;
    createPortalMutation.mutate(returnUrl, {
      onSuccess: (data) => {
        if (data?.url) {
          window.location.href = data.url;
        }
      },
      onError: (e: { message?: string }) => {
        console.error('Error abriendo portal:', e);
      },
    });
  };

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
      {/* Banner periodo de gracia */}
      {!isPlatformAdmin && inGracePeriod && !requiresPayment && (
        <div className="border-b border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Periodo de gracia activo
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tu periodo de pago terminó. Tienes hasta el{' '}
                  {gracePeriodEnd && (
                    <span className="font-semibold">
                      {new Date(gracePeriodEnd).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                  {' '}para reactivar tu suscripción antes de perder el acceso.
                </p>
              </div>
            </div>
            {canManageBilling && (
              <Button
                onClick={handleOpenPortal}
                disabled={createPortalMutation.isPending}
                variant="outline"
                size="sm"
                className="gap-2 shrink-0 border-amber-500/50 hover:bg-amber-500/10"
              >
                <CreditCard className="h-4 w-4" />
                {createPortalMutation.isPending ? 'Abriendo…' : 'Reactivar'}
              </Button>
            )}
          </div>
        </div>
      )}
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}

