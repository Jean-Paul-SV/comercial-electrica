'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';
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
  const { user, enabledModules } = useAuth();
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
    <div className="space-y-10 sm:space-y-12">
      <header className="pt-1 pb-2 animate-fade-in">
        <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sesión: {user?.email} · {user?.role === 'USER' ? 'USUARIO' : user?.role}
        </p>
      </header>

      {d?.inventory?.lowStockCount != null && d.inventory.lowStockCount > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-muted/30 dark:bg-warning/5 px-6 py-4 shadow-sm animate-fade-in">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning/60 rounded-l-2xl" aria-hidden />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pl-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <AlertTriangle className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-medium text-foreground">
                  Alerta de stock
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hay {d.inventory.lowStockCount} producto(s) con stock bajo (≤{d.inventory.lowStockThreshold ?? lowStockThreshold ?? 10} unidades). Considera reponer.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 rounded-xl border-border">
              <Link href={`/products?lowStock=true&lowStockThreshold=${d.inventory.lowStockThreshold ?? lowStockThreshold ?? 10}`}>
                Ver productos con stock bajo
              </Link>
            </Button>
          </div>
        </div>
      )}

      {operationalState.data?.alerts && operationalState.data.alerts.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937] animate-fade-in">
          <div className="p-6 pb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Acciones recomendadas
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Alertas por caja, inventario, cotizaciones, facturas proveedor y ventas
            </p>
          </div>
          <div className="pt-0 px-6 pb-6">
            <ul className="space-y-3">
              {operationalState.data.alerts
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((alert) => (
                  <li
                    key={alert.code + (alert.entityIds?.[0] ?? '')}
                    className={`flex min-h-[88px] flex-col justify-center gap-2 rounded-xl border-l-4 py-4 px-4 bg-muted/30 dark:bg-muted/20 ${severityBorderClass[alert.severity] ?? 'border-l-muted-foreground/40'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                      </div>
                      {alert.count > 0 && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {alert.count}
                        </Badge>
                      )}
                    </div>
                    {alert.actionLabel && alert.actionHref && (
                      <Button asChild size="sm" variant="outline" className="w-fit mt-0.5">
                        <Link href={alert.actionHref}>{alert.actionLabel}</Link>
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {showProgressPanel && onboardingData && (
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] sm:p-6 animate-fade-in">
          <div className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Tu progreso
              </p>
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
            <p className="text-sm text-muted-foreground mt-0.5">Configuración recomendada para operar</p>
          </div>
          {!progressCollapsed && (
            <div className="pt-2">
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
            </div>
          )}
        </div>
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
        <div className="flex h-[320px] min-h-[280px] w-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] dark:border-[#1F2937] animate-fade-in">
          <div className="shrink-0 p-6 pb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Artículos en tendencias
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Por ingreso (últimos {trendingProducts.data.periodDays} días)
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-6 pt-0">
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden pr-1">
              {trendingProducts.data.items.slice(0, 8).map((item, idx) => (
                <li
                  key={item.product.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50 dark:bg-muted/20"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {idx + 1}. {item.product.name}
                  </span>
                  <span className="shrink-0 text-sm font-medium text-primary tabular-nums">
                    {formatMoney(item.totalRevenue)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/reports?tab=trending"
              className="shrink-0 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ver todos los artículos en tendencias
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </div>
      )}

      {d && (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 animate-fade-in">
          {d.sales?.today?.total != null && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] dark:border-[#1F2937]">
              <div className="pb-1 pt-6 px-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Ventas hoy
                </p>
              </div>
              <div className="px-6 pb-6 pt-0">
                <p className="text-3xl font-light tracking-tight text-foreground">
                  {formatMoney(d.sales.today.total)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {d.sales.today.count ?? 0} ventas
                </p>
              </div>
            </div>
          )}
          {d.inventory?.lowStockCount != null && d.inventory.lowStockCount > 0 && (
            <div className="flex min-h-[280px] w-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] dark:border-[#1F2937] dark:border-l-primary/30 dark:border-l-4">
              <div className="shrink-0 pb-2 pt-6 px-6">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Stock bajo
                  </p>
                  <Badge variant="secondary" className="shrink-0 text-xs font-medium">
                    {d.inventory.lowStockCount}
                  </Badge>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-6 pt-0">
                {d.inventory.lowStockProducts && d.inventory.lowStockProducts.length > 0 ? (
                  <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                    {d.inventory.lowStockProducts.slice(0, 8).map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/60 dark:bg-muted/25"
                      >
                        <span className="truncate text-sm font-medium text-foreground">
                          {p.name}
                        </span>
                        <Badge
                          variant={p.stock === 0 ? 'destructive' : 'secondary'}
                          className="shrink-0 text-xs font-medium"
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
                    <p className="text-3xl font-light tracking-tight">{d.inventory.lowStockCount}</p>
                    <p className="mt-1 text-sm text-muted-foreground">productos</p>
                  </div>
                )}
                <Link
                  href={`/products?lowStock=true&lowStockThreshold=${d.inventory.lowStockThreshold ?? lowStockThreshold ?? 10}`}
                  className="shrink-0 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  Ver productos con stock bajo
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
          {d.cash?.openSessions != null && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] dark:border-[#1F2937]">
              <div className="pb-1 pt-6 px-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sesiones abiertas
                </p>
              </div>
              <div className="px-6 pb-6 pt-0">
                <p className="text-3xl font-light tracking-tight text-foreground">{d.cash.openSessions}</p>
                <p className="mt-2 text-sm text-muted-foreground">caja</p>
              </div>
            </div>
          )}
          {d.quotes?.pending != null && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] dark:border-[#1F2937]">
              <div className="pb-1 pt-6 px-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cotizaciones pendientes
                </p>
              </div>
              <div className="px-6 pb-6 pt-0">
                <p className="text-3xl font-light tracking-tight text-foreground">{d.quotes.pending}</p>
                <p className="mt-2 text-sm text-muted-foreground">pendientes</p>
              </div>
            </div>
          )}
        </div>
      )}

      {d && (d.inventory?.lowStockCount != null || d.cash?.openSessions != null || d.quotes?.pending != null) && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-visible dark:border-[#1F2937] animate-fade-in">
          <div className="pb-2 pt-6 px-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Indicadores
            </p>
            <p className="text-sm text-muted-foreground mt-1">Stock bajo, sesiones abiertas, cotizaciones pendientes</p>
          </div>
          <div className="overflow-visible px-6 pb-6 pt-0">
            <KpiBarChart className="h-56 w-full min-w-0" data={kpiChartData} />
          </div>
        </div>
      )}

      {dashboardSummary.isLoading && (
        <div className="rounded-2xl border border-border/50 bg-muted/20 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] border-l-4 border-l-primary/30 p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Resumen del día
          </p>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground animate-pulse">
              Cargando resumen…
            </p>
          </div>
        </div>
      )}
      {!dashboardSummary.isLoading && dashboardSummary.data?.summary && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937] animate-fade-in">
          <div className="pb-2 pt-6 px-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-foreground">
                Resumen del día
              </p>
              {dashboardSummary.data.source === 'llm' ? (
                <Badge variant="secondary" className="text-xs font-medium">IA</Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Resumen automático</Badge>
              )}
            </div>
          </div>
          <div className="space-y-2 px-6 pb-6 pt-0">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {dashboardSummary.data.summary}
            </p>
            {dashboardSummary.data.source === 'fallback' && (
              <p className="text-xs text-muted-foreground/80">
                Configura <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> en la API para un resumen generado con IA.
              </p>
            )}
          </div>
        </div>
      )}
      {!dashboardSummary.isLoading && dashboardSummary.isError && (
        <div className="rounded-2xl border border-border/50 bg-muted/20 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] border-l-4 border-l-muted p-6">
          <div className="flex min-h-[100px] flex-col justify-center items-start">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {(dashboardSummary.error as { status?: number })?.status === 403
                ? '¿Quieres tener el resumen del día con IA? Adquiere un plan Premium o Enterprise en Facturación.'
                : 'No se pudo cargar el resumen del día.'}
            </p>
            {(dashboardSummary.error as { status?: number })?.status === 403 && (
              <Link
                href="/settings/billing"
                className="inline-block mt-2 text-sm font-medium text-primary hover:underline"
              >
                Ver planes y facturación →
              </Link>
            )}
          </div>
        </div>
      )}

      {enabledModules.includes('advanced_reports') && actionable.data !== undefined && (
        <section className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 dark:bg-primary/10 animate-fade-in">
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
        {[
          { href: '/sales', icon: ShoppingCart, label: 'Ventas', desc: 'Listado y creación de ventas' },
          { href: '/products', icon: Package, label: 'Productos', desc: 'Catálogo y categorías' },
          { href: '/customers', icon: Users, label: 'Clientes', desc: 'Gestión de clientes' },
          { href: '/cash', icon: Wallet, label: 'Caja', desc: 'Sesiones y movimientos' },
          { href: '/quotes', icon: FileText, label: 'Cotizaciones', desc: 'Crear y convertir cotizaciones' },
          { href: '/inventory', icon: Boxes, label: 'Inventario', desc: 'Movimientos de stock' },
          { href: '/suppliers', icon: Truck, label: 'Proveedores', desc: 'Gestión de proveedores' },
          { href: '/supplier-invoices', icon: FileCheck, label: 'Facturas proveedor', desc: 'Cuentas por pagar' },
          { href: '/reports', icon: LayoutDashboard, label: 'Reportes', desc: 'Ventas, inventario, caja, clientes' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] hover:shadow-md transition-shadow duration-200 cursor-pointer h-full p-6 dark:border-[#1F2937] animate-fade-in-up"
                style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' } as React.CSSProperties}
              >
                <p className="flex items-center gap-2 text-base font-medium text-foreground">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
