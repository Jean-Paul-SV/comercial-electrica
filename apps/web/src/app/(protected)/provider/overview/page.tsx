'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, LayoutGrid, Eye, Building2, Users, Activity, Wallet, TrendingUp } from 'lucide-react';
import { useListTenants, useTenantsSummary, useUsageEventsByDay } from '@features/provider/hooks';
import { KpiBarChart } from '@shared/components/charts/KpiBarChart';
import { UsagePeakChart } from '@shared/components/charts/UsagePeakChart';
import { formatMoney } from '@shared/utils/format';

export default function ProviderOverviewPage() {
  const { data, isLoading } = useListTenants({ limit: 500 });
  const { data: summary, isLoading: summaryLoading } = useTenantsSummary();
  const { data: eventsByDay, isLoading: eventsByDayLoading } = useUsageEventsByDay();
  const tenants = data?.items ?? [];

  const plansBarData = (summary?.plansUsage ?? []).map((p) => ({
    name: p.name,
    value: p.tenantsCount,
    fullName: p.name,
  }));

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
              <LayoutGrid className="h-6 w-6 text-primary" />
              Vista global
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Todas las empresas con plan, estado, uso y última actividad en una sola vista.
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold tabular-nums">{summary?.totalTenants ?? 0}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas activas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold tabular-nums">{summary?.activeTenants ?? 0}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold tabular-nums">{summary?.totalUsers ?? 0}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR aproximado</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-xl font-semibold tabular-nums">
                {formatMoney(summary?.totalMrrApprox ?? 0)}
              </span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-xl font-semibold tabular-nums">
                {formatMoney(summary?.totalSalesCurrentMonth ?? 0)}
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico por plan + Uso en el tiempo */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Empresas por plan</CardTitle>
            <CardDescription>Distribución por tipo de plan.</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-56 w-full rounded-lg" />
            ) : plansBarData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin datos de planes.</p>
            ) : (
              <KpiBarChart data={plansBarData} className="h-56 w-full min-w-0" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Uso en el tiempo</CardTitle>
            <CardDescription>Eventos de uso por día (últimos 30 días).</CardDescription>
          </CardHeader>
          <CardContent>
            {eventsByDayLoading ? (
              <Skeleton className="h-56 w-full rounded-lg" />
            ) : !eventsByDay?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin eventos en el periodo.</p>
            ) : (
              <UsagePeakChart data={eventsByDay} className="h-56 w-full min-w-0" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Todas las empresas</CardTitle>
          <CardDescription>
            Resumen unificado: plan, suscripción, usuarios, productos, ventas, clientes y última actividad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay empresas.
            </p>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-medium">Empresa</TableHead>
                    <TableHead className="font-medium">Plan</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="font-medium text-right">Usuarios</TableHead>
                    <TableHead className="font-medium text-right">Productos</TableHead>
                    <TableHead className="font-medium text-right">Ventas</TableHead>
                    <TableHead className="font-medium text-right">Clientes</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Última actividad</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id} className="border-border/50">
                      <TableCell>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{t.slug}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{t.plan?.name ?? '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.isActive && t.subscription?.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {t.isActive && (t.subscription == null || t.subscription.status === 'ACTIVE')
                            ? 'Activa'
                            : 'Suspendida'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.usersCount ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.productsCount ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.salesCount ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.customersCount ?? 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {t.lastActivityAt
                          ? new Date(t.lastActivityAt).toLocaleString('es-CO')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/provider/${t.id}`}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
