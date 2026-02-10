'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Skeleton } from '@shared/components/ui/skeleton';
import { CreditCard, Calendar, Package, AlertCircle } from 'lucide-react';
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
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Facturación
        </h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Los administradores de plataforma gestionan empresas y planes
              desde el{' '}
              <a
                href="/provider"
                className="text-primary underline underline-offset-2"
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
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Facturación
        </h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (subscriptionQuery.isError) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Facturación
        </h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
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

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Facturación
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Plan actual
          </CardTitle>
          <CardDescription>
            Información de tu suscripción y opciones de pago.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {plan ? (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{plan.name}</p>
                <p className="text-sm text-muted-foreground">{plan.slug}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No hay plan asignado. Contacte a soporte.
            </p>
          )}

          {subscription && (
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Estado: {STATUS_LABELS[subscription.status] ?? subscription.status}
                </p>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    Próxima renovación:{' '}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                      'es-CO',
                      {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      },
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          {canManageBilling && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Actualiza tu método de pago, descarga facturas o gestiona tu
                suscripción en el portal seguro de Stripe.
              </p>
              <Button
                onClick={handleOpenPortal}
                disabled={createPortalMutation.isPending}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {createPortalMutation.isPending
                  ? 'Abriendo…'
                  : 'Gestionar método de pago y facturas'}
              </Button>
            </div>
          )}

          {!canManageBilling && plan && (
            <p className="text-sm text-muted-foreground">
              Para cambiar el método de pago o ver facturas, contacte a
              soporte.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
