'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Select } from '@shared/components/ui/select';
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, Building2, PauseCircle, PlayCircle } from 'lucide-react';
import { useTenant, useUpdateTenantStatus, useUpdateTenant, usePlans, useRenewSubscription } from '@features/provider/hooks';

export default function ProviderTenantDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : null;

  const { data: tenant, isLoading, error } = useTenant(id);
  const { data: plans = [] } = usePlans(true);
  const updateStatus = useUpdateTenantStatus();
  const updateTenant = useUpdateTenant();
  const renewSubscription = useRenewSubscription();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  useEffect(() => {
    if (tenant?.plan?.id) setSelectedPlanId(tenant.plan.id);
    else setSelectedPlanId('');
  }, [tenant?.plan?.id]);
  const planChanged = selectedPlanId !== (tenant?.plan?.id ?? '');

  const handleChangePlan = async () => {
    if (!id) return;
    try {
      await updateTenant.mutateAsync({
        id,
        planId: selectedPlanId || undefined,
      });
      toast.success('Plan actualizado.');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Error al actualizar el plan.';
      toast.error(msg);
    }
  };

  const handleRenewSubscription = async () => {
    if (!id) return;
    try {
      await renewSubscription.mutateAsync({ tenantId: id, extendDays: 30 });
      toast.success('Suscripción renovada 30 días.');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Error al renovar.';
      toast.error(msg);
    }
  };

  const handleToggleStatus = async () => {
    if (!tenant) return;
    try {
      await updateStatus.mutateAsync({
        id: tenant.id,
        isActive: !tenant.isActive,
      });
      toast.success(
        tenant.isActive
          ? 'Empresa suspendida. Los usuarios no podrán iniciar sesión.'
          : 'Empresa reactivada.'
      );
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Error al actualizar estado.';
      toast.error(msg);
    }
  };

  if (!id) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">ID no válido.</p>
        <Button variant="link" asChild>
          <Link href="/provider">Volver a empresas</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-destructive">
          {(error as { message?: string })?.message ?? 'Error al cargar la empresa.'}
        </p>
        <Button variant="link" asChild>
          <Link href="/provider">Volver a empresas</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !tenant) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/provider">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              {tenant.name}
            </h1>
            <p className="text-muted-foreground text-sm">{tenant.slug}</p>
          </div>
        </div>
        <Button
          variant={tenant.isActive ? 'outline' : 'default'}
          size="sm"
          disabled={updateStatus.isPending}
          onClick={handleToggleStatus}
        >
          {tenant.isActive ? (
            <>
              <PauseCircle className="mr-2 h-4 w-4" />
              Suspender
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" />
              Reactivar
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estado y suscripción</CardTitle>
            <CardDescription>Datos de la cuenta y plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
                {tenant.isActive ? 'Activa' : 'Suspendida'}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span>{tenant.plan?.name ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Cambiar plan</span>
              <div className="flex gap-2">
                <Select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                >
                  <option value="">Sin plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!planChanged || updateTenant.isPending}
                  onClick={handleChangePlan}
                >
                  {updateTenant.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
            {tenant.subscription && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estado suscripción</span>
                  <span>{tenant.subscription.status}</span>
                </div>
                {tenant.subscription.currentPeriodEnd && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Periodo hasta</span>
                    <span>
                      {new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={renewSubscription.isPending}
                    onClick={handleRenewSubscription}
                  >
                    {renewSubscription.isPending ? 'Renovando…' : 'Renovar 30 días'}
                  </Button>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Última actividad</span>
              <span>
                {tenant.lastActivityAt
                  ? new Date(tenant.lastActivityAt).toLocaleString()
                  : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso</CardTitle>
            <CardDescription>Conteos de datos en la empresa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Usuarios</span>
              <span>{tenant._count.users}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Productos</span>
              <span>{tenant._count.products}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ventas</span>
              <span>{tenant._count.sales}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Clientes</span>
              <span>{tenant._count.customers}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>Alta: {new Date(tenant.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
