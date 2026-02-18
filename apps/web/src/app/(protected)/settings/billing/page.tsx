'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import { CreditCard, Calendar, Package, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { useSubscriptionInfo, useCreatePortalSession } from '@features/billing/hooks';
import { useAuth } from '@shared/providers/AuthProvider';
import { toast } from 'sonner';
import { getErrorMessage } from '@shared/utils/errors';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  CANCELLED: 'Cancelada',
};

export default function BillingPage() {
  const { isPlatformAdmin } = useAuth();
  const subscriptionQuery = useSubscriptionInfo();
  const createPortalMutation = useCreatePortalSession();

  const handleOpenPortal = () => {
    const returnUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/settings/billing`
        : undefined;
    createPortalMutation.mutate(returnUrl, {
      onSuccess: (data) => {
        if (data?.url) {
          window.location.href = data.url;
        }
      },
      onError: (e) => {
        toast.error(getErrorMessage(e));
      },
    });
  };

  if (isPlatformAdmin) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Plan
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión de planes y suscripciones.
          </p>
        </div>
        <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
          <CardContent className="pt-6">
            <p className="text-muted-foreground flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
              Los administradores de plataforma gestionan empresas y planes
              desde el{' '}
              <a
                href="/provider"
                className="text-primary font-medium underline underline-offset-2 hover:no-underline"
              >
                panel proveedor
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (subscriptionQuery.isLoading || subscriptionQuery.isPending) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="border border-border/80 rounded-xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/60">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (subscriptionQuery.isError) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Plan
          </h1>
        </div>
        <Card className="border border-destructive/30 rounded-xl overflow-hidden">
          <CardContent className="pt-6">
            <p className="text-destructive flex items-center gap-3 rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {getErrorMessage(subscriptionQuery.error)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = subscriptionQuery.data;
  const plan = data?.plan;
  const subscription = data?.subscription;
  const canManageBilling = data?.canManageBilling ?? false;

  const statusLabel = subscription
    ? (STATUS_LABELS[subscription.status] ?? subscription.status)
    : null;
  const isActive = subscription?.status === 'ACTIVE';

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Plan
        </h1>
        <p className="text-sm text-muted-foreground">
          Información de tu suscripción, renovación y opciones de pago.
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
            <Package className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Plan actual
          </CardTitle>
          <CardDescription>
            Tu plan incluye todos los módulos activos para tu empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {plan ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/80 bg-card p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{plan.name}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {plan.slug}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="w-fit font-medium">
                Plan vigente
              </Badge>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-3">
              No hay plan asignado. Contacte a soporte.
            </p>
          )}

          {subscription && (
            <div className="flex items-start gap-4 rounded-xl border border-border/80 bg-muted/10 p-4 sm:p-5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'
                }`}
              >
                {isActive ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Calendar className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Estado</span>
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    className={isActive ? 'bg-green-600 hover:bg-green-600 dark:bg-green-700' : ''}
                  >
                    {statusLabel}
                  </Badge>
                </div>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    Próxima renovación:{' '}
                    <span className="font-medium text-foreground">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {plan && (
            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
              <p className="text-sm font-semibold text-foreground">
                ¿Necesitas mejorar tu plan?
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Si tu negocio crece y necesitas más usuarios o módulos (por ejemplo pasar de Básico a
                Premium o Empresarial), podemos cambiar tu plan sin interrumpir la operación.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 text-primary hover:bg-primary/10"
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href =
                      'mailto:soporte@orion-app.cloud?subject=Mejorar%20plan%20Orion';
                  }
                }}
              >
                Mejorar plan
              </Button>
            </div>
          )}

          {canManageBilling && (
            <div className="space-y-3 rounded-xl border border-border/80 bg-muted/5 p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">
                Actualiza tu método de pago, descarga facturas o gestiona tu
                suscripción en el portal seguro de Stripe.
              </p>
              <Button
                onClick={handleOpenPortal}
                disabled={createPortalMutation.isPending}
                className="gap-2"
              >
                <CreditCard className="h-4 w-4 shrink-0" />
                {createPortalMutation.isPending
                  ? 'Abriendo…'
                  : 'Gestionar método de pago y facturas'}
              </Button>
            </div>
          )}

          {!canManageBilling && plan && (
            <p className="text-sm text-muted-foreground rounded-lg bg-muted/20 px-3 py-2 border border-border/60">
              Para cambiar el método de pago o ver facturas, contacte a soporte.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
