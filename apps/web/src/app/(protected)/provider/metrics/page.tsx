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
              <BarChart3 className="h-6 w-6 text-primary" />
              Métricas de negocio
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              MRR, churn, LTV, CAC, conversión y ARPU para el panel proveedor.
            </p>
          </div>
        </div>
      </div>

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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR actual</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Churn (mes)</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {metrics.churn.rate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.churn.count} cliente(s) · {formatMoney(metrics.churn.revenueLost)} perdidos
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">LTV promedio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {formatMoney(metrics.ltv.average)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Por plan en tabla inferior
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ARPU (mes)</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {formatMoney(metrics.arpu.monthly)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ingreso por cliente activo
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Conversión</CardTitle>
                <CardDescription>Checkout → Pago y Trial → Pago</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                <CardDescription>Activos, churn y nuevos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">CAC</CardTitle>
                <CardDescription>Costo de adquisición</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold tabular-nums">
                  {metrics.cac.average != null
                    ? formatMoney(metrics.cac.average)
                    : '—'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{metrics.cac.note}</p>
              </CardContent>
            </Card>
          </div>

          {(metrics.mrr.byPlan.length > 0 || metrics.ltv.byPlan.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {metrics.mrr.byPlan.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">MRR por plan</CardTitle>
                    <CardDescription>Ingreso recurrente mensual por tipo de plan</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
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
                  </CardContent>
                </Card>
              )}
              {metrics.ltv.byPlan.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">LTV por plan</CardTitle>
                    <CardDescription>Valor de vida del cliente por tipo de plan</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
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
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
