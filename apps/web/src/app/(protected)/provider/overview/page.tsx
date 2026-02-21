'use client';

import Link from 'next/link';
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
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/provider">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <LayoutGrid className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Vista global
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Todas las empresas con plan, estado, uso y última actividad en una sola vista.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-5 dark:border-[#1F2937]">
          <p className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            Total empresas
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </p>
          <div className="mt-2">
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold tabular-nums">{summary?.totalTenants ?? 0}</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-5 dark:border-[#1F2937]">
          <p className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            Empresas activas
            <Activity className="h-4 w-4 text-muted-foreground" />
          </p>
          <div className="mt-2">
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold tabular-nums">{summary?.activeTenants ?? 0}</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-5 dark:border-[#1F2937]">
          <p className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            Total usuarios
            <Users className="h-4 w-4 text-muted-foreground" />
          </p>
          <div className="mt-2">
            {summaryLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="text-2xl font-bold tabular-nums">{summary?.totalUsers ?? 0}</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-5 dark:border-[#1F2937]">
          <p className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            MRR aproximado
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </p>
          <div className="mt-2">
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-xl font-semibold tabular-nums">
                {formatMoney(summary?.totalMrrApprox ?? 0)}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-5 dark:border-[#1F2937]">
          <p className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            Ventas del mes
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </p>
          <div className="mt-2">
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-xl font-semibold tabular-nums">
                {formatMoney(summary?.totalSalesCurrentMonth ?? 0)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <h2 className="text-lg font-medium text-foreground">Empresas por plan</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Distribución por tipo de plan.</p>
          <div className="mt-4">
            {summaryLoading ? (
              <Skeleton className="h-56 w-full rounded-lg" />
            ) : plansBarData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin datos de planes.</p>
            ) : (
              <KpiBarChart data={plansBarData} className="h-56 w-full min-w-0" />
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <h2 className="text-lg font-medium text-foreground">Uso en el tiempo</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Eventos de uso por día (últimos 30 días).</p>
          <div className="mt-4">
            {eventsByDayLoading ? (
              <Skeleton className="h-56 w-full rounded-lg" />
            ) : !eventsByDay?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin eventos en el periodo.</p>
            ) : (
              <UsagePeakChart data={eventsByDay} className="h-56 w-full min-w-0" />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-medium text-foreground">Todas las empresas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Resumen unificado: plan, suscripción, usuarios, productos, ventas, clientes y última actividad.
          </p>
        </div>
        <div>
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg mx-6 mb-6" />
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 px-6 text-center">
              No hay empresas.
            </p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
