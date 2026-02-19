'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  FileText,
  Truck,
  ShoppingBag,
  FileCheck,
  Boxes,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useDashboard, useActionableIndicators, useDashboardSummary, useOperationalState, useTrendingProducts } from '@features/reports/hooks';
import { useOnboardingStatus } from '@features/onboarding/hooks';
import { useLowStockThreshold } from '@shared/hooks/useLowStockThreshold';
import { formatMoney } from '@shared/utils/format';
import { KpiBarChart } from '@shared/components/charts/KpiBarChart';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { STORAGE_KEY_HIDE_PROGRESS } from '@features/onboarding/constants';

const severityBorderClass: Record<string, string> = {
  critical: 'border-l-destructive',
  high: 'border-l-warning',
  medium: 'border-l-primary',
  low: 'border-l-muted-foreground/40',
  info: 'border-l-muted-foreground/30',
};

export default function DashboardView() {
  const router = useRouter();
  const { user } = useAuth();
  const [lowStockThreshold] = useLowStockThreshold();
  const dashboard = useDashboard({ lowStockThreshold });
  const actionable = useActionableIndicators({ days: 30, top: 10 });
  const dashboardSummary = useDashboardSummary({ days: 30, top: 10 });
  const operationalState = useOperationalState();
  const trendingProducts = useTrendingProducts({ days: 30, top: 8 });
  const onboarding = useOnboardingStatus();
  const [progressCollapsed, setProgressCollapsed] = useState(false);
  const [progressHidden, setProgressHidden] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_HIDE_PROGRESS) === '1';
  });

  const d = dashboard.data;
  const indicators = actionable.data?.indicators ?? [];
  const onboardingData = onboarding.data;
  const hasPendingChecklist =
    onboardingData && onboardingData.checklist.some((i) => !i.done);
  const showProgressPanel = !progressHidden && onboardingData && hasPendingChecklist;

  const kpiChartData = useMemo(() => {
    if (!d) return [];
    const items = [
      ...(d.inventory?.lowStockCount != null ? [{ name: 'Stock bajo', value: d.inventory.lowStockCount, format: 'number' as const }] : []),
      ...(d.cash?.openSessions != null ? [{ name: 'Sesiones abiertas', value: d.cash.openSessions, format: 'number' as const }] : []),
      ...(d.quotes?.pending != null ? [{ name: 'Cotiz. pendientes', value: d.quotes.pending, format: 'number' as const }] : []),
    ];
    return items.slice().sort((a, b) => b.value - a.value);
  }, [d]);

  useEffect(() => {
    if (!onboarding.data) return;
    const s = onboarding.data.status;
    if (s === 'not_started' || s === 'in_progress') {
      router.replace('/onboarding');
    }
  }, [onboarding.data, router]);

  const handleHideProgress = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_HIDE_PROGRESS, '1');
      setProgressHidden(true);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-transparent px-4 py-3 sm:px-5 sm:py-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sesión: {user?.email} · {user?.role === 'USER' ? 'USUARIO' : user?.role}
        </p>
      </div>

      {d?.inventory?.lowStockCount != null && d.inventory.lowStockCount > 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-orange-400/60 dark:border-orange-500/50 bg-[#fff9f5] dark:bg-orange-950/30 shadow-md shadow-orange-500/10">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-400 to-amber-500 dark:from-orange-500 dark:to-amber-600" aria-hidden />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-5 py-4 sm:pl-6">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-600 dark:bg-orange-400/25 dark:text-orange-400 shadow-inner">
                <AlertTriangle className="h-6 w-6" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                  Alerta de stock
                </p>
                <p className="mt-1 text-sm text-orange-700/90 dark:text-orange-300/90">
                  Hay {d.inventory.lowStockCount} producto(s) con stock bajo (≤{d.inventory.lowStockThreshold ?? lowStockThreshold ?? 10} unidades). Considera reponer.
                </p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="shrink-0 rounded-xl border-2 border-orange-400/70 bg-white dark:bg-orange-950/50 font-semibold text-orange-700 dark:text-orange-300 hover:bg-orange-100 hover:border-orange-500 dark:hover:bg-orange-900/50 dark:hover:border-orange-400 transition-all shadow-sm"
            >
              <Link href={`/products?lowStock=true&lowStockThreshold=${d.inventory.lowStockThreshold ?? lowStockThreshold ?? 10}`}>
                Ver productos con stock bajo
              </Link>
            </Button>
          </div>
        </div>
      )}

      {operationalState.data?.alerts && operationalState.data.alerts.length > 0 && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Acciones recomendadas
            </CardTitle>
            <CardDescription>
              Alertas por caja, inventario, cotizaciones, facturas proveedor y ventas
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-3">
              {operationalState.data.alerts
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((alert) => (
                  <li
                    key={alert.code + (alert.entityIds?.[0] ?? '')}
                    className={`flex flex-col gap-2 rounded-lg border-l-4 py-2 px-3 bg-muted/30 dark:bg-muted/20 ${severityBorderClass[alert.severity] ?? 'border-l-muted-foreground/40'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
                      </div>
                      {alert.count > 0 && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {alert.count}
                        </Badge>
                      )}
                    </div>
                    {alert.actionLabel && alert.actionHref && (
                      <Button asChild size="sm" variant="outline" className="w-fit">
                        <Link href={alert.actionHref}>{alert.actionLabel}</Link>
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {showProgressPanel && onboardingData && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tu progreso
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setProgressCollapsed(!progressCollapsed)}
                >
                  {progressCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={handleHideProgress}
                >
                  Ya no mostrar
                </Button>
              </div>
            </div>
            <CardDescription>Configuración recomendada para operar</CardDescription>
          </CardHeader>
          {!progressCollapsed && (
            <CardContent>
              <ul className="space-y-2">
                {onboardingData.checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={item.done ? 'text-muted-foreground' : ''}>
                      {item.label}
                    </span>
                    {!item.done && (
                      <Link
                        href={item.href}
                        className="ml-auto text-primary text-xs font-medium hover:underline"
                      >
                        Ir
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <Link
                href="/onboarding"
                className="mt-2 inline-block text-sm text-muted-foreground hover:text-primary"
              >
                Configurar en 3 pasos
              </Link>
            </CardContent>
          )}
        </Card>
      )}

      {dashboard.isLoading && (
        <p className="text-sm text-muted-foreground">Cargando KPIs…</p>
      )}
      {dashboard.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            {(dashboard.error as { message?: string })?.message ??
              'Error cargando dashboard'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Comprueba que la API esté en marcha (ej. <code className="rounded bg-muted px-1">npm run dev</code> en <code className="rounded bg-muted px-1">apps/api</code>) y que <code className="rounded bg-muted px-1">NEXT_PUBLIC_API_BASE_URL</code> en el frontend apunte a la API.
          </p>
        </div>
      )}

      {trendingProducts.data?.items && trendingProducts.data.items.length > 0 && (
        <Card className="w-full flex flex-col overflow-hidden rounded-2xl border border-border/80 border-l-4 border-l-primary shadow-sm bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 min-h-[280px] h-[320px]">
          <CardHeader className="shrink-0 pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </span>
                Artículos en tendencias
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Por ingreso (últimos {trendingProducts.data.periodDays} días)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-0">
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden pr-1">
              {trendingProducts.data.items.slice(0, 8).map((item, idx) => (
                <li
                  key={item.product.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/60 dark:bg-muted/25 dark:hover:bg-muted/45"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {idx + 1}. {item.product.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
                    {formatMoney(item.totalRevenue)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/reports?tab=trending"
              className="shrink-0 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
            >
              Ver todos los artículos en tendencias
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          </CardContent>
        </Card>
      )}

      {d && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {d.sales?.today?.total != null && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ventas hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatMoney(d.sales.today.total)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {d.sales.today.count ?? 0} ventas
                </p>
              </CardContent>
            </Card>
          )}
          {d.inventory?.lowStockCount != null && d.inventory.lowStockCount > 0 && (
            <Card className="border-0 shadow-md overflow-hidden border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 flex h-[280px] min-h-[280px] w-full flex-col">
              <CardHeader className="shrink-0 pb-2 pt-4 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Package className="h-4 w-4" />
                    </span>
                    Stock bajo
                  </CardTitle>
                  <Badge variant="default" className="shrink-0 font-medium">
                    {d.inventory.lowStockCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-0">
                {d.inventory.lowStockProducts && d.inventory.lowStockProducts.length > 0 ? (
                  <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                    {d.inventory.lowStockProducts.slice(0, 8).map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 transition-colors hover:bg-muted/70 dark:bg-muted/30 dark:hover:bg-muted/50"
                      >
                        <span className="truncate text-sm font-medium text-foreground">
                          {p.name}
                        </span>
                        <Badge
                          variant={p.stock === 0 ? 'destructive' : 'secondary'}
                          className="shrink-0 text-xs font-semibold"
                        >
                          {p.stock} u.
                        </Badge>
                      </li>
                    ))}
                    {d.inventory.lowStockProducts.length > 8 && (
                      <li className="py-1.5 text-center text-xs text-muted-foreground">
                        + {d.inventory.lowStockProducts.length - 8} más
                      </li>
                    )}
                  </ul>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col justify-center">
                    <p className="text-2xl font-semibold">{d.inventory.lowStockCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">productos</p>
                  </div>
                )}
                <Link
                  href={`/products?lowStock=true&lowStockThreshold=${d.inventory.lowStockThreshold ?? lowStockThreshold ?? 10}`}
                  className="shrink-0 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 dark:hover:bg-primary/15"
                >
                  Ver productos con stock bajo
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          )}
          {d.cash?.openSessions != null && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sesiones abiertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{d.cash.openSessions}</p>
                <p className="text-xs text-muted-foreground mt-1">caja</p>
              </CardContent>
            </Card>
          )}
          {d.quotes?.pending != null && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cotizaciones pendientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{d.quotes.pending}</p>
                <p className="text-xs text-muted-foreground mt-1">pendientes</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {d && (d.inventory?.lowStockCount != null || d.cash?.openSessions != null || d.quotes?.pending != null) && (
        <Card className="border-0 shadow-sm overflow-visible">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Indicadores
            </CardTitle>
            <CardDescription>Stock bajo, sesiones abiertas, cotizaciones pendientes</CardDescription>
          </CardHeader>
          <CardContent className="overflow-visible">
            <KpiBarChart className="h-56 w-full min-w-0" data={kpiChartData} />
          </CardContent>
        </Card>
      )}

      {dashboardSummary.isLoading && (
        <Card className="border-0 shadow-sm overflow-hidden border-l-4 border-l-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resumen del día
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground animate-pulse">
              Cargando resumen…
            </p>
          </CardContent>
        </Card>
      )}
      {!dashboardSummary.isLoading && dashboardSummary.data?.summary && (
        <Card className="border-0 shadow-sm overflow-hidden border-l-4 border-l-primary/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium text-foreground">
                Resumen del día
              </CardTitle>
              {dashboardSummary.data.source === 'llm' ? (
                <Badge variant="secondary" className="text-xs">IA</Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Resumen automático</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {dashboardSummary.data.summary}
            </p>
            {dashboardSummary.data.source === 'fallback' && (
              <p className="text-xs text-muted-foreground/80">
                Configura <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> en la API para un resumen generado con IA.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {!dashboardSummary.isLoading && dashboardSummary.isError && (
        <Card className="border-0 shadow-sm border-l-4 border-l-muted">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">
              No se pudo cargar el resumen del día.
            </p>
          </CardContent>
        </Card>
      )}

      {actionable.data !== undefined && (
        <section className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 dark:bg-primary/10">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Lightbulb className="h-4 w-4" />
            </span>
            Sugerencias
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
            {indicators.length > 0
              ? `Ideas para mejorar basadas en productos, facturas y rotación (últimos ${actionable.data?.periodDays ?? 30} días)`
              : 'Se generan a partir de tus ventas y datos recientes.'}
          </p>
          {indicators.length > 0 ? (
            <ul className="space-y-1.5">
              {indicators.map((ind) => (
                <li key={ind.code}>
                  <Link
                    href={
                      ind.code === 'SALES_BY_EMPLOYEE'
                        ? '/reports?tab=sales-by-employee'
                        : ind.code === 'PRODUCTS_NO_ROTATION'
                          ? '/reports?tab=no-rotation'
                          : ind.actionHref
                    }
                    className={`group flex rounded-md border-l-2 py-2 pr-2 pl-3 transition-colors hover:bg-background/60 ${severityBorderClass[ind.severity] ?? severityBorderClass.info}`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground text-sm">
                        Sugerencia: {ind.title}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ind.insight}
                        {ind.metric != null && ind.metric !== '' && (
                          <span className="text-muted-foreground/80"> · {String(ind.metric)}</span>
                        )}
                      </p>
                      {ind.items.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 pl-1 border-l border-muted/50">
                          {ind.items.slice(0, 5).map((item) => (
                            <li key={item.id} className="text-xs text-muted-foreground flex flex-wrap items-baseline gap-x-1.5">
                              <span className="font-medium text-foreground/90">{item.name}</span>
                              {item.value != null && item.value !== '' && (
                                <span>{String(item.value)}</span>
                              )}
                              {item.suggestedPrice != null && (
                                <span className="text-primary font-medium">
                                  Precio sug. 15%: {formatMoney(item.suggestedPrice)}
                                </span>
                              )}
                            </li>
                          ))}
                          {ind.items.length > 5 && (
                            <li className="text-xs text-muted-foreground/80">+ {ind.items.length - 5} más</li>
                          )}
                        </ul>
                      )}
                      <span className="mt-1 inline-flex items-center gap-0.5 text-xs text-primary group-hover:underline">
                        {ind.actionLabel}
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Las sugerencias aparecerán cuando tengas ventas en los últimos días. Usa el sistema (ventas, productos, clientes) y en poco tiempo verás recomendaciones personalizadas según tu operación.
            </p>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/sales">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                Ventas
              </CardTitle>
              <CardDescription>Listado y creación de ventas</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/products">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Productos
              </CardTitle>
              <CardDescription>Catálogo y categorías</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/customers">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Clientes
              </CardTitle>
              <CardDescription>Gestión de clientes</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/cash">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" />
                Caja
              </CardTitle>
              <CardDescription>Sesiones y movimientos</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/quotes">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Cotizaciones
              </CardTitle>
              <CardDescription>Crear y convertir cotizaciones</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/inventory">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes className="h-4 w-4" />
                Inventario
              </CardTitle>
              <CardDescription>Movimientos de stock</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/suppliers">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4" />
                Proveedores
              </CardTitle>
              <CardDescription>Gestión de proveedores</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/supplier-invoices">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck className="h-4 w-4" />
                Facturas proveedor
              </CardTitle>
              <CardDescription>Cuentas por pagar</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/reports">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutDashboard className="h-4 w-4" />
                Reportes
              </CardTitle>
              <CardDescription>Ventas, inventario, caja, clientes</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
