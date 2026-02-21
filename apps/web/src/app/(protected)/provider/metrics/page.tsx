'use client';

import Link from 'next/link';
import { Button } from '@shared/components/ui/button';
import { Skeleton } from '@shared/components/ui/skeleton';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  Percent,
  BarChart3,
} from 'lucide-react';
import { useBusinessMetrics } from '@features/provider/hooks';
import { formatMoney } from '@shared/utils/format';

export default function ProviderMetricsPage() {
  const { data: metrics, isLoading, error } = useBusinessMetrics();

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
              <BarChart3 className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Métricas de negocio
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              MRR, churn, LTV, CAC, conversión y ARPU para el panel proveedor.
            </p>
          </div>
        </div>
      </header>

      {error && (
        <p className="text-destructive text-sm">
          {(error as { message?: string })?.message ?? 'Error al cargar métricas.'}
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
              <div className="flex flex-row items-center justify-between pb-2">
                <p className="text-sm font-medium text-foreground">MRR actual</p>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatMoney(metrics.mrr.current)}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {metrics.mrr.growth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                {metrics.mrr.growth >= 0 ? '+' : ''}
                {metrics.mrr.growth.toFixed(1)}% vs mes anterior
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
              <div className="flex flex-row items-center justify-between pb-2">
                <p className="text-sm font-medium text-foreground">Churn (mes)</p>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {metrics.churn.rate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.churn.count} cliente(s) · {formatMoney(metrics.churn.revenueLost)} perdidos
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
              <div className="flex flex-row items-center justify-between pb-2">
                <p className="text-sm font-medium text-foreground">LTV promedio</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatMoney(metrics.ltv.average)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Por plan en tabla inferior
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
              <div className="flex flex-row items-center justify-between pb-2">
                <p className="text-sm font-medium text-foreground">ARPU (mes)</p>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatMoney(metrics.arpu.monthly)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ingreso por cliente activo
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
              <p className="text-sm font-medium text-foreground">Conversión</p>
              <p className="text-xs text-muted-foreground mt-0.5">Checkout → Pago y Trial → Pago</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Checkout → Pago</span>
                  <span className="font-medium tabular-nums">
                    {metrics.conversion.checkoutToPaid.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trial → Pago</span>
                  <span className="font-medium tabular-nums">
                    {metrics.conversion.trialToPaid != null
                      ? `${metrics.conversion.trialToPaid.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
              <p className="text-sm font-medium text-foreground">Clientes</p>
              <p className="text-xs text-muted-foreground mt-0.5">Activos, churn y nuevos</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium tabular-nums">{metrics.customers.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Activos</span>
                  <span className="font-medium tabular-nums">{metrics.customers.active}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Churn</span>
                  <span className="font-medium tabular-nums">{metrics.customers.churned}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nuevos este mes</span>
                  <span className="font-medium tabular-nums">{metrics.customers.newThisMonth}</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
              <p className="text-sm font-medium text-foreground">CAC</p>
              <p className="text-xs text-muted-foreground mt-0.5">Costo de adquisición</p>
              <div className="mt-4">
                <div className="text-lg font-semibold tabular-nums">
                  {metrics.cac.average != null
                    ? formatMoney(metrics.cac.average)
                    : '—'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{metrics.cac.note}</p>
              </div>
            </div>
          </div>

          {(metrics.mrr.byPlan.length > 0 || metrics.ltv.byPlan.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {metrics.mrr.byPlan.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
                  <p className="text-base font-medium text-foreground">MRR por plan</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Ingreso recurrente mensual por tipo de plan</p>
                  <ul className="mt-4 space-y-2">
                    {metrics.mrr.byPlan.map((p) => (
                      <li
                        key={p.planId}
                        className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0"
                      >
                        <span className="font-medium">{p.planName}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatMoney(p.mrr)} · {p.customers} cliente(s)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {metrics.ltv.byPlan.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
                  <p className="text-base font-medium text-foreground">LTV por plan</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Valor de vida del cliente por tipo de plan</p>
                  <ul className="mt-4 space-y-2">
                    {metrics.ltv.byPlan.map((p) => (
                      <li
                        key={p.planId}
                        className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0"
                      >
                        <span className="font-medium">{p.planName}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatMoney(p.ltv)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
