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
import { CreditCard, Calendar, Package, AlertCircle, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { useSubscriptionInfo, useCreatePortalSession, useBillingPlans, useChangePlan } from '@features/billing/hooks';
import { useAuth } from '@shared/providers/AuthProvider';
import { DianActivationDisclaimer } from '@shared/components/DianActivationDisclaimer';
import { toast } from 'sonner';
import { getErrorMessage } from '@shared/utils/errors';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activa',
  PENDING_PAYMENT: 'Pago pendiente',
  SUSPENDED: 'Suspendida',
  CANCELLED: 'Cancelada',
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function BillingPage() {
  const { isPlatformAdmin } = useAuth();
  const subscriptionQuery = useSubscriptionInfo();
  const createPortalMutation = useCreatePortalSession();
  const plansQuery = useBillingPlans();
  const changePlanMutation = useChangePlan();

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
  const requiresPayment = data?.requiresPayment === true;

  const statusLabel = subscription
    ? (STATUS_LABELS[subscription.status] ?? subscription.status)
    : null;
  const isActive = subscription?.status === 'ACTIVE';

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-8">
      {/* Hero */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {requiresPayment ? 'Completa tu pago' : 'Plan'}
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          {requiresPayment
            ? 'Tu empresa está creada. Activa tu acceso completando el pago de tu suscripción.'
            : 'Información de tu suscripción, renovación y opciones de pago.'}
        </p>
      </header>

      {/* Aviso pago pendiente + CTA */}
      {requiresPayment && (
        <Card className="overflow-hidden rounded-2xl border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground flex items-start gap-3 font-medium">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                Pago pendiente. Completa el pago para desbloquear tu cuenta y acceder a todos los módulos.
              </p>
              {canManageBilling && (
                <Button
                  onClick={handleOpenPortal}
                  disabled={createPortalMutation.isPending}
                  className="shrink-0 gap-2 bg-amber-600 hover:bg-amber-700 text-white border-0"
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  {createPortalMutation.isPending ? 'Abriendo…' : 'Completar pago'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan actual + Estado */}
      <Card className="overflow-hidden rounded-2xl border border-border/70 shadow-sm bg-card">
        <CardHeader className="pb-5 border-b border-border/50 bg-muted/10">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <Package className="h-5 w-5 shrink-0 text-primary/80" aria-hidden />
            Plan actual
          </CardTitle>
          <CardDescription className="text-sm mt-0.5">
            Tu plan incluye los módulos activos para tu empresa.
          </CardDescription>
          <DianActivationDisclaimer variant="card" className="mt-4" />
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {plan ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-muted/5 p-4 sm:p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{plan.name}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mt-0.5">
                    {plan.slug}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="w-fit font-medium rounded-full px-3">
                Plan vigente
              </Badge>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-3">
              No hay plan asignado. Contacte a soporte.
            </p>
          )}

          {subscription && (
            <div
              className={`flex items-start gap-4 rounded-xl border p-4 sm:p-5 ${
                isActive
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-amber-500/20 bg-amber-500/5'
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  isActive ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                {isActive ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Calendar className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Estado</span>
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    className={
                      isActive
                        ? 'rounded-full bg-emerald-600 hover:bg-emerald-600 dark:bg-emerald-700'
                        : 'rounded-full bg-amber-600/90 text-white hover:bg-amber-600 dark:bg-amber-500'
                    }
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

          {/* Cambiar de plan */}
          {plan && (
            <section className="space-y-4 rounded-2xl border border-border/60 bg-muted/5 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 shrink-0 text-primary/80" />
                <h2 className="text-base font-semibold text-foreground">Cambiar de plan</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Elige plan mensual o anual. El cambio se aplica de inmediato; el periodo actual se mantiene.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Los planes &quot;con DIAN&quot; te dan acceso a facturación electrónica. Hasta que actives el servicio podrás usar documentos internos.
              </p>
              <DianActivationDisclaimer variant="inline" className="text-xs mt-2" />
              {plansQuery.isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-36 rounded-xl" />
                  ))}
                </div>
              ) : plansQuery.data && plansQuery.data.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  {plansQuery.data.map((p) => {
                    const isCurrent = plan.id === p.id;
                    const price = p.priceMonthly ?? p.priceYearly;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-xl border p-5 transition-all ${
                          isCurrent
                            ? 'border-primary/40 bg-primary/10 shadow-sm ring-1 ring-primary/20'
                            : 'border-border/70 bg-card hover:border-primary/30 hover:shadow-md'
                        }`}
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-foreground">{p.name}</p>
                              {p.maxUsers != null && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  hasta {p.maxUsers} usuarios
                                </p>
                              )}
                            </div>
                            {isCurrent && (
                              <Badge variant="secondary" className="shrink-0 rounded-full px-2.5">
                                Vigente
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            {price != null && (
                              <span className="text-lg font-bold text-foreground">
                                {formatPrice(price)}
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                  {p.priceMonthly != null ? '/mes' : '/año'}
                                </span>
                              </span>
                            )}
                            {p.priceMonthly != null && p.priceYearly != null && (
                              <span className="text-xs text-muted-foreground">
                                Anual: {formatPrice(p.priceYearly)}
                              </span>
                            )}
                            {p.priceMonthly == null && p.priceYearly == null && (
                              <span className="text-muted-foreground text-sm">Consultar precio</span>
                            )}
                          </div>
                          {!isCurrent && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                              disabled={changePlanMutation.isPending}
                              onClick={() => {
                                changePlanMutation.mutate(p.id, {
                                  onSuccess: () => toast.success('Plan actualizado.'),
                                  onError: (e) => toast.error(getErrorMessage(e)),
                                });
                              }}
                            >
                              {changePlanMutation.isPending ? 'Cambiando…' : 'Cambiar a este plan'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  No hay planes disponibles. Contacte a soporte para cambiar su plan.
                </p>
              )}
            </section>
          )}

          {/* Portal Stripe (cuando no es pago pendiente) */}
          {canManageBilling && !requiresPayment && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/5 p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">
                Actualiza tu método de pago, descarga facturas o gestiona tu suscripción en el portal seguro de Stripe.
              </p>
              <Button
                onClick={handleOpenPortal}
                disabled={createPortalMutation.isPending}
                className="gap-2 rounded-lg"
              >
                <CreditCard className="h-4 w-4 shrink-0" />
                {createPortalMutation.isPending
                  ? 'Abriendo…'
                  : 'Gestionar método de pago y facturas'}
              </Button>
            </div>
          )}

          {!canManageBilling && plan && (
            <p className="text-sm text-muted-foreground rounded-xl bg-muted/20 px-4 py-3 border border-border/50">
              Para cambiar el método de pago o ver facturas, contacte a soporte.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
