'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@shared/components/ui/dialog';
import { CreditCard, Calendar, Package, AlertCircle, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { useSubscriptionInfo, useCreatePortalSession, useCreateCheckoutSession, useBillingPlans, useChangePlan, useValidateDowngrade } from '@features/billing/hooks';
import { useDianConfigStatus } from '@features/dian/hooks';
import { useSubmitFeedback } from '@features/feedback/hooks';
import { useAuth } from '@shared/providers/AuthProvider';
import { DianActivationDisclaimer } from '@shared/components/DianActivationDisclaimer';
import { toast } from 'sonner';
import { getErrorMessage } from '@shared/utils/errors';

/** Planes con DIAN requieren activación manual; al elegirlos se envía mensaje a soporte. */
function isPlanWithDian(slug: string): boolean {
  return slug === 'enterprise' || slug.includes('con-dian');
}

/** Planes donde la DIAN la configura el proveedor desde su panel; no mostrar enlace ni aviso de activación al tenant. */
function isDianConfiguredByProvider(slug: string): boolean {
  return slug === 'enterprise' || slug === 'basico-con-dian' || slug === 'premium-con-dian';
}

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

type BillingPlanItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  maxUsers: number | null;
};

const PLAN_FEATURES: Record<string, string[]> = {
  'basico-sin-dian': ['Ventas', 'Inventario', 'Clientes', 'Backup 1 día a la semana'],
  'premium-sin-dian': ['Todo lo del Básico', 'Reportes avanzados', 'IA en el resumen del día', 'Backup 2 días a la semana'],
  'basico-con-dian': ['Ventas', 'Inventario', 'Clientes', 'Facturación electrónica DIAN', 'Backup 3 días a la semana'],
  'premium-con-dian': ['Todo lo del Básico con DIAN', 'Reportes avanzados', 'IA en el resumen del día', 'Compras y proveedores', 'Backup diario'],
  enterprise: ['DIAN', 'Reportes avanzados', 'Compras y proveedores', 'Auditoría', 'Backups avanzados'],
};

/** Tarjeta de un plan con validación de downgrade para deshabilitar botón si no permitido. */
function PlanCard({
  p,
  currentPlanId,
  currentBillingInterval,
  onSelectDian,
  onSelectChange,
  isChanging,
}: {
  p: BillingPlanItem;
  currentPlanId: string;
  currentBillingInterval: 'monthly' | 'yearly' | null;
  onSelectDian: (id: string, name: string, billingInterval: 'monthly' | 'yearly') => void;
  onSelectChange: (id: string, name: string, billingInterval: 'monthly' | 'yearly') => void;
  isChanging: boolean;
}) {
  const isCurrent = currentPlanId === p.id;
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>(() => {
    if (isCurrent && currentBillingInterval) return currentBillingInterval;
    return p.priceYearly != null ? 'yearly' : 'monthly';
  });
  useEffect(() => {
    if (isCurrent && currentBillingInterval) setBillingInterval(currentBillingInterval);
  }, [isCurrent, currentBillingInterval]);
  // Solo validar downgrade si hay un plan actual (currentPlanId no está vacío)
  const validation = useValidateDowngrade(isCurrent || !currentPlanId ? null : p.id);
  const downgradeBlocked = validation.data?.allowed === false;
  const firstError = validation.data?.errors?.[0];
  const highlights = PLAN_FEATURES[p.slug] ?? [];
  const hasBothPrices = p.priceMonthly != null && p.priceYearly != null;
  // Bloquear cambio a mensual solo si es el mismo plan y es anual
  const blockMonthlyChange = isCurrent && currentBillingInterval === 'yearly' && p.id === currentPlanId;

  return (
    <div
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
            <Badge variant="secondary" className="shrink-0 px-2.5">
              Vigente
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          {hasBothPrices && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-1.5">
              <button
                type="button"
                onClick={() => setBillingInterval('monthly')}
                disabled={blockMonthlyChange}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  billingInterval === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                } ${blockMonthlyChange ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={blockMonthlyChange ? 'No se puede cambiar a mensual cuando tienes un plan anual activo. Puedes cambiar a un plan más avanzado con facturación mensual.' : ''}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval('yearly')}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  billingInterval === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Anual
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {(p.priceMonthly ?? p.priceYearly) != null && (
              <span className="text-lg font-bold text-foreground">
                {formatPrice(
                  billingInterval === 'yearly' && p.priceYearly != null
                    ? p.priceYearly
                    : p.priceMonthly ?? p.priceYearly ?? 0
                )}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {billingInterval === 'yearly' ? '/año' : '/mes'}
                </span>
              </span>
            )}
            {hasBothPrices && billingInterval === 'monthly' && (
              <span className="text-xs text-muted-foreground">
                Ahorra {Math.round(((p.priceMonthly! * 12 - p.priceYearly!) / (p.priceMonthly! * 12)) * 100)}% con anual
              </span>
            )}
            {hasBothPrices && billingInterval === 'yearly' && p.priceMonthly != null && p.priceYearly != null && (
              <span className="text-xs text-success font-medium">
                Ahorras {formatPrice(p.priceMonthly * 12 - p.priceYearly)} vs mensual
              </span>
            )}
            {p.priceMonthly == null && p.priceYearly == null && (
              <span className="text-muted-foreground text-sm">Consultar precio</span>
            )}
          </div>
        </div>
        {p.description?.trim() && (
          <p className="text-sm text-muted-foreground leading-snug">
            {p.description}
          </p>
        )}
        {highlights.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Incluye: </span>
            {highlights.join(' · ')}
          </p>
        )}
        {(!isCurrent || (isCurrent && billingInterval !== currentBillingInterval)) && (
          <div className="space-y-1">
            {blockMonthlyChange && billingInterval === 'monthly' ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="text-xs text-foreground font-medium">
                  No se puede cambiar a mensual cuando tienes un plan anual activo
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  El cambio a mensual estará disponible al finalizar tu periodo anual actual. Puedes cambiar a un plan más avanzado con facturación mensual.
                </p>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                disabled={isChanging || downgradeBlocked || blockMonthlyChange}
                onClick={() => {
                  if (isPlanWithDian(p.slug)) {
                    onSelectDian(p.id, p.name, billingInterval);
                  } else {
                    onSelectChange(p.id, p.name, billingInterval);
                  }
                }}
              >
                {isChanging 
                  ? 'Cambiando…' 
                  : downgradeBlocked 
                    ? 'No disponible' 
                    : currentPlanId 
                      ? isCurrent && billingInterval !== currentBillingInterval
                        ? billingInterval === 'monthly'
                          ? 'Cambiar a mensual'
                          : 'Cambiar a anual'
                        : 'Cambiar a este plan'
                      : 'Seleccionar plan'}
              </Button>
            )}
            {downgradeBlocked && firstError && (
              <p className="text-xs text-destructive" title={validation.data?.errors?.join(' ')}>
                {firstError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { isPlatformAdmin } = useAuth();
  const subscriptionQuery = useSubscriptionInfo({ refetchWhenPendingPayment: true });
  const createPortalMutation = useCreatePortalSession();
  const createCheckoutMutation = useCreateCheckoutSession();
  const plansQuery = useBillingPlans();
  const changePlanMutation = useChangePlan();
  const submitFeedbackMutation = useSubmitFeedback();
  const planSlug = subscriptionQuery.data?.plan?.slug;
  const planIncludesDian = planSlug ? isPlanWithDian(planSlug) : false;
  const { data: dianStatus } = useDianConfigStatus(planIncludesDian);
  const [dianPlanDialog, setDianPlanDialog] = useState<{ id: string; name: string; billingInterval: 'monthly' | 'yearly' } | null>(null);
  /** Plan pendiente de confirmación (sin DIAN): mostrar modal de prorrateo antes de cambiar. */
  const [changePlanConfirm, setChangePlanConfirm] = useState<{ id: string; name: string; billingInterval: 'monthly' | 'yearly' } | null>(null);
  /** Errores de validación al intentar downgrade (ej. demasiados usuarios). */
  const [changePlanErrors, setChangePlanErrors] = useState<string[]>([]);

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

  const handleConfirmDianPlan = () => {
    if (!dianPlanDialog) return;
    const planName = dianPlanDialog.name;
    changePlanMutation.mutate(
      { planId: dianPlanDialog.id, billingInterval: dianPlanDialog.billingInterval },
      {
      onSuccess: () => {
        submitFeedbackMutation.mutate(
          `Solicitud de activación de facturación electrónica (DIAN). Plan contratado: ${planName}. Por favor contactar al cliente para activar el servicio.`,
          {
            onSuccess: () => {
              toast.success(
                'Plan actualizado. Hemos enviado tu solicitud de activación DIAN a soporte; te contactaremos pronto.',
              );
              setDianPlanDialog(null);
            },
            onError: () => {
              toast.success('Plan actualizado. Contacta a soporte para activar la facturación electrónica (DIAN).');
              setDianPlanDialog(null);
            },
          },
        );
      },
      onError: (e) => {
        toast.error(getErrorMessage(e));
      },
    });
  };

  // Al volver de Stripe, refrescar suscripción para que el layout desbloquee si el webhook ya procesó el pago
  const hasRefetchedOnMount = useRef(false);
  useEffect(() => {
    if (!hasRefetchedOnMount.current && subscriptionQuery.data !== undefined) {
      hasRefetchedOnMount.current = true;
      subscriptionQuery.refetch();
    }
  }, [subscriptionQuery.data]); // Solo refetch una vez cuando los datos estén disponibles

  // Si sigue pendiente de pago, reintentar cada 2s hasta 4 veces para dar tiempo al webhook
  const pollCount = useRef(0);
  const isPolling = useRef(false);
  const requiresPaymentForPolling = subscriptionQuery.data?.requiresPayment === true;
  useEffect(() => {
    if (!requiresPaymentForPolling || isPolling.current) return;
    isPolling.current = true;
    pollCount.current = 0;
    const POLL_MAX = 4;
    const POLL_INTERVAL_MS = 2000;
    const id = setInterval(() => {
      pollCount.current += 1;
      if (pollCount.current > POLL_MAX) {
        clearInterval(id);
        isPolling.current = false;
        return;
      }
      subscriptionQuery.refetch();
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      isPolling.current = false;
    };
  }, [requiresPaymentForPolling]); // Solo depende de requiresPaymentForPolling

  if (isPlatformAdmin) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6">
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
      <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6">
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
      <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6">
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
  const scheduledPlan = data?.scheduledPlan ?? null;
  const scheduledChangeAt = data?.scheduledChangeAt ?? null;
  const billingInterval = data?.billingInterval ?? null;
  const canManageBilling = data?.canManageBilling ?? false;
  const requiresPayment = data?.requiresPayment === true;
  const hasUnpaidInvoice = data?.hasUnpaidInvoice === true;
  const gracePeriodEnd = data?.gracePeriodEnd ?? null;
  const inGracePeriod = data?.inGracePeriod === true;
  const pendingInvoiceAmount = data?.pendingInvoiceAmount ?? null;

  // Calcular precio efectivo del plan actual
  const currentPrice = plan
    ? billingInterval === 'yearly' && plan.priceYearly != null
      ? plan.priceYearly
      : plan.priceMonthly ?? plan.priceYearly ?? null
    : null;

  const statusLabel = subscription
    ? (STATUS_LABELS[subscription.status] ?? subscription.status)
    : null;
  const isActive = subscription?.status === 'ACTIVE';
  const isCancelled = subscription?.status === 'CANCELLED';
  const periodEnded = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd) < new Date()
    : false;

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6 pb-8">
      {/* Hero */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {requiresPayment ? 'Completa tu pago' : plan ? 'Plan' : 'Elige tu plan'}
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          {requiresPayment
            ? 'Tu empresa está creada. Activa tu acceso completando el pago de tu suscripción.'
            : plan
              ? 'Información de tu suscripción, renovación y opciones de pago.'
              : 'Selecciona el plan que mejor se adapte a las necesidades de tu empresa.'}
        </p>
      </header>

      {/* Aviso periodo de gracia */}
      {inGracePeriod && !requiresPayment && (
        <Card className="overflow-hidden rounded-2xl border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-foreground flex items-start gap-3 font-medium">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  Periodo de gracia activo. Tu periodo de pago terminó, pero tienes{' '}
                  {gracePeriodEnd && (
                    <>
                      hasta el{' '}
                      <span className="font-semibold">
                        {new Date(gracePeriodEnd).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </>
                  )}
                  {' '}para reactivar tu suscripción antes de perder el acceso.
                </p>
              </div>
              {canManageBilling && (
                <Button
                  onClick={handleOpenPortal}
                  disabled={createPortalMutation.isPending}
                  className="gap-2 shrink-0"
                >
                  <CreditCard className="h-4 w-4" />
                  {createPortalMutation.isPending ? 'Abriendo…' : 'Reactivar suscripción'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* "Completa tu pago" solo aparece si requiresPayment (PENDING_PAYMENT) o hasUnpaidInvoice (factura abierta en Stripe). Si el estado es Activa y no hay factura abierta, esta sección no se muestra. */}
      {/* Factura abierta en Stripe (plan Activo pero cobro pendiente): permitir completar pago desde el portal */}
      {hasUnpaidInvoice && !requiresPayment && (
        <Card className="overflow-hidden rounded-2xl border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-foreground flex items-start gap-3 font-medium">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  Tienes una factura pendiente de pago. Completa el pago para mantener tu suscripción al día.
                  {pendingInvoiceAmount != null && (
                    <span className="block mt-1 font-semibold text-amber-700 dark:text-amber-500">
                      Total a pagar: {formatPrice(pendingInvoiceAmount)}
                    </span>
                  )}
                </p>
              </div>
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

      {/* Aviso pago pendiente + CTA: desglose para que vean descuento/total antes de ir a Stripe */}
      {requiresPayment && (
        <Card className="overflow-hidden rounded-2xl border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground flex items-start gap-3 font-medium">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  Pago pendiente. Completa el pago para desbloquear tu cuenta y acceder a todos los módulos.
                </p>
                {currentPrice != null && plan && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm space-y-1">
                    {pendingInvoiceAmount != null && pendingInvoiceAmount < currentPrice ? (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Precio del plan</span>
                          <span>
                            {formatPrice(currentPrice)}
                            {billingInterval && (
                              <span className="text-xs ml-1">/{billingInterval === 'yearly' ? 'año' : 'mes'}</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Descuento por cambio de plan (prorrateo)</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            -{formatPrice(currentPrice - pendingInvoiceAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between font-semibold text-amber-700 dark:text-amber-500 pt-0.5 border-t border-amber-500/20">
                          <span>Lo que pagarás al completar</span>
                          <span>{formatPrice(pendingInvoiceAmount)}</span>
                        </div>
                      </>
                    ) : pendingInvoiceAmount != null && pendingInvoiceAmount !== currentPrice ? (
                      <div className="flex justify-between font-semibold text-amber-700 dark:text-amber-500">
                        <span>Lo que pagarás al completar</span>
                        <span>{formatPrice(pendingInvoiceAmount)}</span>
                      </div>
                    ) : (
                      <>
                        {billingInterval === 'yearly' &&
                        plan.priceMonthly != null &&
                        plan.priceYearly != null &&
                        plan.priceMonthly * 12 > plan.priceYearly ? (
                          <>
                            <div className="flex justify-between text-muted-foreground">
                              <span>12 meses en mensual</span>
                              <span>{formatPrice(plan.priceMonthly * 12)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Descuento por pago anual</span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                -{formatPrice(plan.priceMonthly * 12 - plan.priceYearly)}
                              </span>
                            </div>
                          </>
                        ) : null}
                        <div className="flex justify-between font-semibold text-amber-700 dark:text-amber-500 pt-0.5 border-t border-amber-500/20">
                          <span>Lo que pagarás al completar</span>
                          <span>
                            {formatPrice(pendingInvoiceAmount ?? currentPrice)}
                            {billingInterval && (
                              <span className="text-xs font-normal ml-1">
                                /{billingInterval === 'yearly' ? 'año' : 'mes'}
                              </span>
                            )}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {currentPrice != null && !plan && (
                  <p className="font-semibold text-amber-700 dark:text-amber-500">
                    Total a pagar: {formatPrice(currentPrice)}
                    {billingInterval && (
                      <span className="text-xs font-normal ml-1">
                        /{billingInterval === 'yearly' ? 'año' : 'mes'}
                      </span>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  {subscriptionQuery.isFetching ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                      Comprobando pago…
                    </>
                  ) : (
                    <>
                      Si acabas de pagar, se actualizará en unos segundos. Si tarda,{' '}
                      <button
                        type="button"
                        onClick={() => subscriptionQuery.refetch()}
                        className="underline font-medium text-foreground hover:no-underline"
                      >
                        actualiza la página
                      </button>
                      .
                    </>
                  )}
                </p>
              </div>
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
          {plan && isPlanWithDian(plan.slug) && !isDianConfiguredByProvider(plan.slug) && dianStatus && isActive && (
            <>
              {dianStatus.readyForSend ? (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">¡Ya cuentas con facturación electrónica (DIAN)!</p>
                      <p className="text-muted-foreground mt-1">
                        Tu configuración está completa y lista para emitir facturas electrónicas a la DIAN. Puedes gestionar tu configuración en{' '}
                        <Link href="/settings/electronic-invoicing" className="text-primary underline hover:no-underline font-medium">
                          Configuración de facturación electrónica
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                    <p className="font-medium text-foreground">Tu plan incluye facturación electrónica (DIAN).</p>
                    <p className="text-muted-foreground mt-1">
                      Para emitir facturas a la DIAN, configura certificado, NIT y numeración en{' '}
                      <Link href="/settings/electronic-invoicing" className="text-primary underline hover:no-underline font-medium">
                        Configuración de facturación electrónica
                      </Link>
                      . Hasta entonces podrás usar documentos internos.
                    </p>
                  </div>
                  <DianActivationDisclaimer variant="card" className="mt-4" />
                </>
              )}
            </>
          )}
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {plan ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-muted/5 p-4 sm:p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    {currentPrice != null && (
                      <span className="text-lg font-bold text-primary">
                        {formatPrice(currentPrice)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          /{billingInterval === 'yearly' ? 'año' : 'mes'}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mt-0.5">
                    {plan.slug}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="w-fit font-medium px-3">
                Plan vigente
              </Badge>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <p className="text-sm text-foreground font-medium mb-1">
                No tienes un plan asignado
              </p>
              <p className="text-xs text-muted-foreground">
                Selecciona un plan a continuación para comenzar a usar el servicio.
              </p>
            </div>
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
                        ? 'bg-emerald-600 hover:bg-emerald-600 dark:bg-emerald-700'
                        : 'bg-amber-600/90 text-white hover:bg-amber-600 dark:bg-amber-500'
                    }
                  >
                    {statusLabel}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {subscription.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground">
                      {isCancelled ? (
                        inGracePeriod ? (
                          <>
                            Tu periodo de pago terminó el{' '}
                            <span className="font-medium text-foreground">
                              {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                            . Estás en un <strong>periodo de gracia de 7 días</strong>. Tu acceso continuará hasta el{' '}
                            <span className="font-medium text-foreground">
                              {gracePeriodEnd ? new Date(gracePeriodEnd).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              }) : 'fin del periodo de gracia'}
                            </span>
                            . Reactiva tu suscripción antes de esa fecha para evitar perder el acceso.
                          </>
                        ) : periodEnded ? (
                          <>
                            Tu acceso finalizó el{' '}
                            <span className="font-medium text-foreground">
                              {gracePeriodEnd ? new Date(gracePeriodEnd).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              }) : new Date(subscription.currentPeriodEnd).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                            . Reactiva tu suscripción para continuar usando el servicio.
                          </>
                        ) : (
                          <>
                            Tu suscripción fue cancelada (probablemente se quitó el método de pago). Tu acceso continuará hasta el{' '}
                            <span className="font-medium text-foreground">
                              {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                            . Después de esa fecha tendrás un periodo de gracia de 7 días para reactivar.
                          </>
                        )
                      ) : (
                        <>
                          Próxima renovación:{' '}
                          <span className="font-medium text-foreground">
                            {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                  {isCancelled && !subscription.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground">
                      Tu suscripción fue cancelada (probablemente se quitó el método de pago). Reactiva tu suscripción para continuar usando el servicio.
                    </p>
                  )}
                  {isCancelled && canManageBilling && (
                    <Button
                      onClick={handleOpenPortal}
                      disabled={createPortalMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="gap-2 mt-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      {createPortalMutation.isPending ? 'Abriendo…' : periodEnded ? 'Reactivar suscripción' : 'Agregar método de pago y reactivar'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Aviso: cambio de plan programado (downgrade) */}
          {scheduledPlan && scheduledChangeAt && (
            <div className="flex items-start gap-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5">
              <Calendar className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Tu plan cambiará a <strong>{scheduledPlan.name}</strong> el{' '}
                  {new Date(scheduledChangeAt).toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hasta entonces mantienes tu plan actual y sus funcionalidades. No hay reembolso por el periodo ya pagado.
                </p>
              </div>
            </div>
          )}

          {/* Seleccionar o cambiar de plan */}
          <section className="space-y-4 rounded-2xl border border-border/60 bg-muted/5 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              {plan ? (
                <RefreshCw className="h-5 w-5 shrink-0 text-primary/80" />
              ) : (
                <Package className="h-5 w-5 shrink-0 text-primary/80" />
              )}
              <h2 className="text-base font-semibold text-foreground">
                {plan ? 'Cambiar de plan' : 'Planes disponibles'}
              </h2>
            </div>
            {plan ? (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Si eliges un plan <strong>más costoso</strong>, el cambio es inmediato y se cobra solo la diferencia proporcional en tu próxima factura.
                  Si eliges un plan <strong>más económico</strong>, el cambio se aplica al final de tu periodo actual (sin reembolso).
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Los planes &quot;con DIAN&quot; te dan acceso a facturación electrónica. Hasta que actives el servicio podrás usar documentos internos.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Elige el plan que mejor se adapte a las necesidades de tu empresa. Puedes cambiar de plan en cualquier momento.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Los planes &quot;con DIAN&quot; incluyen facturación electrónica. Una vez que actives el servicio podrás emitir facturas electrónicas a la DIAN.
                </p>
              </>
            )}
            {plansQuery.data?.some((p) => isPlanWithDian(p.slug)) && (
              <DianActivationDisclaimer variant="inline" className="text-xs mt-2" />
            )}
            {plansQuery.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
              </div>
            ) : plansQuery.data && plansQuery.data.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                {plansQuery.data.map((p) => (
                  <PlanCard
                    key={p.id}
                    p={p}
                    currentPlanId={plan?.id || ''}
                    currentBillingInterval={billingInterval}
                    onSelectDian={(id, name, billingInterval) => setDianPlanDialog({ id, name, billingInterval })}
                    onSelectChange={(id, name, billingInterval) => setChangePlanConfirm({ id, name, billingInterval })}
                    isChanging={changePlanMutation.isPending || submitFeedbackMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">
                No hay planes disponibles. Contacte a soporte.
              </p>
            )}
          </section>

          {/* Portal Stripe (cuando no es pago pendiente y la suscripción está activa) */}
          {canManageBilling && !requiresPayment && isActive && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/5 p-4 sm:p-5">
              {billingInterval === 'yearly' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Actualiza tu método de pago y descarga facturas en el portal seguro de Stripe.
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                    ⚠️ Las suscripciones anuales no pueden cancelarse hasta el final del periodo contratado.
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
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}

          {!canManageBilling && plan && (
            <p className="text-sm text-muted-foreground rounded-xl bg-muted/20 px-4 py-3 border border-border/50">
              Para cambiar el método de pago o ver facturas, contacte a soporte.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Confirmación cambio de plan o selección de plan */}
      <Dialog
        open={!!changePlanConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setChangePlanConfirm(null);
            setChangePlanErrors([]);
          }
        }}
      >
        <DialogContent showClose>
          <DialogHeader>
            <DialogTitle>{plan ? '¿Cambiar de plan?' : 'Confirmar selección de plan'}</DialogTitle>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p>
                {plan ? (
                  <>Pasarás al <strong className="text-foreground">{changePlanConfirm?.name}</strong>.</>
                ) : (
                  <>Has seleccionado el <strong className="text-foreground">{changePlanConfirm?.name}</strong>.</>
                )}
              </p>
              {plan ? (
                <>
                  <p>
                    Si el nuevo plan es <strong>más costoso</strong>: el cambio es inmediato. En tu próxima factura verás un descuento por lo no usado del plan actual y el cobro del nuevo plan solo por los días restantes. Podrás usar las nuevas funciones de inmediato.
                  </p>
                  <p>
                    Si el nuevo plan es <strong>más económico</strong>: el cambio se aplicará al final de tu periodo actual (en la próxima fecha de renovación). No hay reembolso; hasta entonces mantienes tu plan actual.
                  </p>
                  <p className="text-xs">
                    Puedes revisar el detalle en tu siguiente factura o en &quot;Gestionar método de pago y facturas&quot;.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Serás redirigido a la página de pago seguro (Stripe Checkout), donde podrás agregar tu tarjeta y completar la compra. El plan se activará al instante.
                  </p>
                  <p className="text-xs">
                    Una vez completado el pago, tendrás acceso inmediato a todas las funcionalidades del plan seleccionado.
                  </p>
                </>
              )}
              {changePlanErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <p className="font-medium text-destructive text-left">No se puede completar el cambio:</p>
                  <ul className="list-disc list-inside text-destructive/90 text-left space-y-1">
                    {changePlanErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setChangePlanConfirm(null); setChangePlanErrors([]); }}>
              Cancelar
            </Button>
            <Button
              disabled={changePlanMutation.isPending || createCheckoutMutation.isPending}
              onClick={() => {
                if (!changePlanConfirm) return;
                setChangePlanErrors([]);

                if (!plan) {
                  // Sin plan: ir directo a Stripe Checkout (página tipo Spotify: tarjeta + completar compra)
                  const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/settings/billing` : undefined;
                  createCheckoutMutation.mutate(
                    {
                      planId: changePlanConfirm.id,
                      billingInterval: changePlanConfirm.billingInterval,
                      returnUrl,
                    },
                    {
                      onSuccess: (data) => {
                        if (data?.url) {
                          toast.success('Redirigiendo a la página de pago...');
                          setChangePlanConfirm(null);
                          window.location.href = data.url;
                        } else {
                          toast.error('No se pudo abrir la página de pago.');
                        }
                      },
                      onError: (e: unknown) => {
                        const err = e as { response?: { data?: { errors?: string[]; message?: string } } };
                        const errors = Array.isArray(err.response?.data?.errors) ? err.response.data.errors : [];
                        if (errors.length > 0) {
                          setChangePlanErrors(errors);
                        } else {
                          toast.error(getErrorMessage(e));
                          setChangePlanConfirm(null);
                        }
                      },
                    },
                  );
                  return;
                }

                changePlanMutation.mutate(
                  { planId: changePlanConfirm.id, billingInterval: changePlanConfirm.billingInterval },
                  {
                  onSuccess: (result) => {
                    if (result?.scheduledChangeAt) {
                      const date = new Date(result.scheduledChangeAt).toLocaleDateString('es-CO', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      });
                      toast.success(`Plan actualizado. Tu plan cambiará el ${date}.`);
                    } else {
                      toast.success('Plan actualizado. El nuevo plan se aplica hoy.');
                    }
                    setChangePlanConfirm(null);
                  },
                  onError: (e: unknown) => {
                    const err = e as { response?: { data?: { errors?: string[]; message?: string } } };
                    const errors = Array.isArray(err.response?.data?.errors) ? err.response.data.errors : [];
                    if (errors.length > 0) {
                      setChangePlanErrors(errors);
                    } else {
                      toast.error(getErrorMessage(e));
                      setChangePlanConfirm(null);
                    }
                  },
                });
              }}
            >
              {createCheckoutMutation.isPending
                ? 'Redirigiendo a pago…'
                : changePlanMutation.isPending 
                  ? (plan ? 'Cambiando…' : 'Creando suscripción…') 
                  : (plan ? 'Sí, cambiar de plan' : 'Completar compra')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dianPlanDialog} onOpenChange={(open) => !open && setDianPlanDialog(null)}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle>Activar facturación electrónica (DIAN)</DialogTitle>
            <DialogDescription>
              Este plan incluye facturación electrónica. La activación se realiza de forma manual por nuestro equipo.
              Al continuar, se enviará un mensaje a soporte para que te contactemos y activen el servicio.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDianPlanDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDianPlan}
              disabled={changePlanMutation.isPending || submitFeedbackMutation.isPending}
            >
              {changePlanMutation.isPending || submitFeedbackMutation.isPending ? 'Enviando…' : 'Continuar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
