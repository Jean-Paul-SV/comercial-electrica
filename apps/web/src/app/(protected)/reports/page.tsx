'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import { Skeleton } from '@shared/components/ui/skeleton';
import { formatMoney, formatDate } from '@shared/utils/format';
import { KpiBarChart } from '@shared/components/charts/KpiBarChart';
import { SalesByDayChart } from '@shared/components/charts/SalesByDayChart';
import { TopCustomersChart } from '@shared/components/charts/TopCustomersChart';
import { CashInOutChart } from '@shared/components/charts/CashInOutChart';
import { FileText, BarChart3, Package, Wallet, Users, UserCircle, PieChart, PackageX, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import {
  useDashboard,
  useSalesReport,
  useInventoryReport,
  useCashReport,
  useCustomersReport,
  useCustomerClusters,
  useActionableIndicators,
  useTrendingProducts,
  useExportReportCsv,
} from '@features/reports/hooks';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

type TabId = 'dashboard' | 'sales' | 'inventory' | 'cash' | 'customers' | 'clusters' | 'sales-by-employee' | 'no-rotation' | 'trending';

const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'trending', label: 'Artículos en tendencias', icon: TrendingUp },
  { id: 'sales', label: 'Ventas', icon: FileText },
  { id: 'sales-by-employee', label: 'Ventas por empleado', icon: UserCircle },
  { id: 'no-rotation', label: 'Productos sin rotación', icon: PackageX },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'cash', label: 'Caja', icon: Wallet },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'clusters', label: 'Segmentos de clientes', icon: PieChart },
];

type TrendingPeriodKey = 'last_days' | 'current_month' | 'prev_month' | 'prev_month_2' | 'prev_month_3';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type KpiFormat = 'number' | 'money';

function getMonthRange(monthsAgo: number): { startDate: string; endDate: string; label: string } {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: `${MONTH_NAMES[m]} ${y}`,
  };
}

function getTrendingParams(period: TrendingPeriodKey, sortBy: 'revenue' | 'qty') {
  if (period === 'prev_month') {
    const { startDate, endDate } = getMonthRange(1);
    return { startDate, endDate, top: 20, sortBy };
  }
  if (period === 'prev_month_2') {
    const { startDate, endDate } = getMonthRange(2);
    return { startDate, endDate, top: 20, sortBy };
  }
  if (period === 'prev_month_3') {
    const { startDate, endDate } = getMonthRange(3);
    return { startDate, endDate, top: 20, sortBy };
  }
  return { days: 30, top: 20, period, sortBy };
}

type SalesPeriodKey = 'last_days' | 'current_month' | 'prev_month' | 'prev_month_2' | 'prev_month_3';

function getSalesReportParams(period: SalesPeriodKey): { startDate?: string; endDate?: string; limit?: number } {
  if (period === 'current_month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      limit: 500,
    };
  }
  if (period === 'prev_month') {
    const { startDate, endDate } = getMonthRange(1);
    return { startDate, endDate, limit: 500 };
  }
  if (period === 'prev_month_2') {
    const { startDate, endDate } = getMonthRange(2);
    return { startDate, endDate, limit: 500 };
  }
  if (period === 'prev_month_3') {
    const { startDate, endDate } = getMonthRange(3);
    return { startDate, endDate, limit: 500 };
  }
  return { limit: 200 };
}

function getSalesPeriodLabel(period: SalesPeriodKey): string {
  if (period === 'current_month') return `${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()} (este mes)`;
  if (period === 'prev_month') return getMonthRange(1).label + ' (mes anterior)';
  if (period === 'prev_month_2') return getMonthRange(2).label + ' (hace 2 meses)';
  if (period === 'prev_month_3') return getMonthRange(3).label + ' (hace 3 meses)';
  return 'Últimos 14 días con datos';
}

function getSalesByEmployeeParams(period: SalesPeriodKey): { days?: number; startDate?: string; endDate?: string; top: number } {
  if (period === 'current_month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), top: 50 };
  }
  if (period === 'prev_month') {
    const { startDate, endDate } = getMonthRange(1);
    return { startDate, endDate, top: 50 };
  }
  if (period === 'prev_month_2') {
    const { startDate, endDate } = getMonthRange(2);
    return { startDate, endDate, top: 50 };
  }
  if (period === 'prev_month_3') {
    const { startDate, endDate } = getMonthRange(3);
    return { startDate, endDate, top: 50 };
  }
  return { days: 30, top: 50 };
}

function getSalesByEmployeePeriodLabel(period: SalesPeriodKey): string {
  if (period === 'current_month') return `${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()} (este mes)`;
  if (period === 'prev_month') return getMonthRange(1).label + ' (mes anterior)';
  if (period === 'prev_month_2') return getMonthRange(2).label + ' (hace 2 meses)';
  if (period === 'prev_month_3') return getMonthRange(3).label + ' (hace 3 meses)';
  return 'Últimos 30 días';
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as TabId | null;
  const validTabs: TabId[] = ['dashboard', 'sales', 'inventory', 'cash', 'customers', 'clusters', 'sales-by-employee', 'no-rotation', 'trending'];
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    return tabParam && validTabs.includes(tabParam) ? tabParam : 'dashboard';
  });
  const [trendingSortOrder, setTrendingSortOrder] = useState<'desc' | 'asc'>('desc');
  const [trendingPeriod, setTrendingPeriod] = useState<TrendingPeriodKey>('current_month');
  const [trendingSortBy, setTrendingSortBy] = useState<'revenue' | 'qty'>('revenue');
  const [salesByEmployeePeriod, setSalesByEmployeePeriod] = useState<SalesPeriodKey>('current_month');

  useEffect(() => {
    if (tabParam && tabParam !== activeTab && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const setTab = (id: TabId) => {
    setActiveTab(id);
    router.replace(`/reports?tab=${id}`, { scroll: false });
  };

  const dashboard = useDashboard();
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriodKey>('current_month');
  const salesReport = useSalesReport(getSalesReportParams(salesPeriod));
  const inventoryReport = useInventoryReport({});
  const cashReport = useCashReport({});
  const customersReport = useCustomersReport({ top: 20 });
  const customerClusters = useCustomerClusters({ days: 90, k: 3 });
  const actionableIndicators = useActionableIndicators(
    activeTab === 'sales-by-employee'
      ? getSalesByEmployeeParams(salesByEmployeePeriod)
      : { days: 30, top: 50 }
  );
  const trendingProducts = useTrendingProducts(
    getTrendingParams(trendingPeriod, trendingSortBy)
  );
  const exportCsv = useExportReportCsv();
  const salesByEmployeeIndicator = actionableIndicators.data?.indicators?.find(
    (i) => i.code === 'SALES_BY_EMPLOYEE'
  );
  const noRotationIndicator = actionableIndicators.data?.indicators?.find(
    (i) => i.code === 'PRODUCTS_NO_ROTATION'
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Reportes
        </h1>
        <p className="text-sm text-muted-foreground">
          Ventas, inventario, caja, clientes y KPIs
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Reportes y dashboard
          </CardTitle>
          <CardDescription>
            Ventas, inventario, caja, clientes desde GET /reports/*
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground mr-1">Exportar CSV:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={exportCsv.isPending}
              onClick={() => {
                exportCsv.mutate(
                  { entity: 'sales' },
                  {
                    onSuccess: () => toast.success('Descarga de ventas iniciada'),
                    onError: (e) =>
                      toast.error((e as Error)?.message ?? 'Error al exportar ventas'),
                  }
                );
              }}
            >
              <Download className="h-4 w-4" />
              {exportCsv.isPending ? 'Exportando…' : 'Ventas'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={exportCsv.isPending}
              onClick={() => {
                exportCsv.mutate(
                  { entity: 'customers' },
                  {
                    onSuccess: () => toast.success('Descarga de clientes iniciada'),
                    onError: (e) =>
                      toast.error((e as Error)?.message ?? 'Error al exportar clientes'),
                  }
                );
              }}
            >
              <Download className="h-4 w-4" />
              Clientes
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  activeTab === id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border/80 bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              {dashboard.isLoading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl border border-border/60" />
                  ))}
                </div>
              )}
              {dashboard.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(dashboard.error as { message?: string })?.message ??
                      'Error cargando dashboard'}
                  </p>
                </div>
              )}
              {dashboard.data && !dashboard.isLoading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {dashboard.data.sales?.today?.total != null && (
                    <div className="p-4 rounded-xl border border-border/80 bg-card">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        Ventas hoy
                      </p>
                      <p className="text-xl font-semibold mt-1 text-foreground">
                        {formatMoney(dashboard.data.sales.today.total)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dashboard.data.sales.today.count ?? 0} ventas
                      </p>
                    </div>
                  )}
                  {dashboard.data.inventory?.lowStockCount != null && (
                    <div className="p-4 rounded-xl border border-border/80 bg-card">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        Productos con stock bajo
                      </p>
                      <p className="text-xl font-semibold mt-1 text-foreground">
                        {dashboard.data.inventory.lowStockCount}
                      </p>
                    </div>
                  )}
                  {dashboard.data.cash?.openSessions != null && (
                    <div className="p-4 rounded-xl border border-border/80 bg-card">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        Sesiones abiertas
                      </p>
                      <p className="text-xl font-semibold mt-1 text-foreground">
                        {dashboard.data.cash.openSessions}
                      </p>
                    </div>
                  )}
                  {dashboard.data.quotes?.pending != null && (
                    <div className="p-4 rounded-xl border border-border/80 bg-card">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        Cotizaciones pendientes
                      </p>
                      <p className="text-xl font-semibold mt-1 text-foreground">
                        {dashboard.data.quotes.pending}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {dashboard.data && !dashboard.isLoading && (dashboard.data.inventory?.lowStockCount != null || dashboard.data.cash?.openSessions != null || dashboard.data.quotes?.pending != null) && (
                <div className="rounded-xl border border-border/80 p-4 bg-muted/20">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Indicadores</p>
                  <KpiBarChart
                    className="h-56 w-full"
                    data={[
                      ...(dashboard.data.inventory?.lowStockCount != null ? [{ name: 'Stock bajo', value: dashboard.data.inventory.lowStockCount, format: 'number' as const }] : []),
                      ...(dashboard.data.cash?.openSessions != null ? [{ name: 'Sesiones abiertas', value: dashboard.data.cash.openSessions, format: 'number' as const }] : []),
                      ...(dashboard.data.quotes?.pending != null ? [{ name: 'Cotizaciones pendientes', value: dashboard.data.quotes.pending, format: 'number' as const }] : []),
                    ]}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'trending' && (
            <div className="space-y-4">
              {(() => {
                const isMonthRange = trendingPeriod === 'prev_month' || trendingPeriod === 'prev_month_2' || trendingPeriod === 'prev_month_3';
                const monthLabel = trendingPeriod === 'prev_month' ? getMonthRange(1).label : trendingPeriod === 'prev_month_2' ? getMonthRange(2).label : trendingPeriod === 'prev_month_3' ? getMonthRange(3).label : null;
                return (
                  <p className="text-sm text-muted-foreground">
                    {trendingSortBy === 'qty'
                      ? isMonthRange && monthLabel
                        ? `Productos más vendidos (unidades) en ${monthLabel}. Solo ventas pagadas.`
                        : trendingPeriod === 'current_month'
                          ? 'Productos más vendidos (unidades) en el mes actual. Solo ventas pagadas.'
                          : `Productos más vendidos (unidades) en los últimos ${trendingProducts.data?.periodDays ?? 30} días.`
                      : isMonthRange && monthLabel
                        ? `Ingreso por producto en ${monthLabel}. Ventas pagadas.`
                        : trendingPeriod === 'current_month'
                          ? `Ingreso por producto en el mes actual (${trendingProducts.data?.periodDays ?? 0} días). Ventas pagadas.`
                          : `Productos ordenados por ingreso total (ventas pagadas) en los últimos ${trendingProducts.data?.periodDays ?? 30} días.`}
                  </p>
                );
              })()}
              {trendingProducts.isLoading && (
                <div className="rounded-lg border border-border/80 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-medium text-muted-foreground">#</TableHead>
                        <TableHead className="font-medium text-muted-foreground">Producto</TableHead>
                        <TableHead className="font-medium text-muted-foreground">Categoría</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground">Ingreso</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground">Unid.</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground">Ventas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-8 rounded" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-40 rounded" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 ml-auto rounded" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-12 ml-auto rounded" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-12 ml-auto rounded" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {trendingProducts.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(trendingProducts.error as { message?: string })?.message ??
                      'Error cargando artículos en tendencias'}
                  </p>
                </div>
              )}
              {trendingProducts.data && !trendingProducts.isLoading && (
                <>
                  <div className="flex flex-wrap items-center gap-4 py-2 border-b border-border/60" id="trending-filters">
                    <span className="text-sm text-muted-foreground font-medium">Período y orden</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="trending-period" className="text-sm text-muted-foreground whitespace-nowrap">
                        Período:
                      </Label>
                      <select
                        id="trending-period"
                        value={trendingPeriod}
                        onChange={(e) => setTrendingPeriod(e.target.value as TrendingPeriodKey)}
                        className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="current_month">Este mes</option>
                        <option value="prev_month">{getMonthRange(1).label} (mes anterior)</option>
                        <option value="prev_month_2">{getMonthRange(2).label} (hace 2 meses)</option>
                        <option value="prev_month_3">{getMonthRange(3).label} (hace 3 meses)</option>
                        <option value="last_days">Últimos 30 días</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="trending-sort-by" className="text-sm text-muted-foreground whitespace-nowrap">
                        Ordenar por:
                      </Label>
                      <select
                        id="trending-sort-by"
                        value={trendingSortBy}
                        onChange={(e) => setTrendingSortBy(e.target.value as 'revenue' | 'qty')}
                        className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="revenue">Por ingreso</option>
                        <option value="qty">Más vendidos (unidades)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="trending-sort-table" className="text-sm text-muted-foreground whitespace-nowrap">
                        Orden:
                      </Label>
                      <select
                        id="trending-sort-table"
                        value={trendingSortOrder}
                        onChange={(e) => setTrendingSortOrder(e.target.value as 'desc' | 'asc')}
                        className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="desc">Mayor a menor</option>
                        <option value="asc">Menor a mayor</option>
                      </select>
                    </div>
                  </div>

                  {trendingProducts.data.items && trendingProducts.data.items.length > 0 ? (() => {
                    const sortByQty = trendingProducts.data!.sortBy === 'qty';
                    const items = [...trendingProducts.data!.items].sort((a, b) => {
                      const desc = trendingSortOrder === 'desc';
                      if (sortByQty) return desc ? b.totalQty - a.totalQty : a.totalQty - b.totalQty;
                      return desc ? b.totalRevenue - a.totalRevenue : a.totalRevenue - b.totalRevenue;
                    });
                    const maxLabelLen = 22;
                    const chartValueKey = sortByQty ? 'totalQty' : 'totalRevenue';
                    const chartData = items.map((item) => {
                      const name = item.product.name?.trim() || item.product.internalCode || '—';
                      const shortName = name.length > maxLabelLen ? `${name.slice(0, maxLabelLen - 1)}…` : name;
                      const fullName = item.product.internalCode ? `${name} (${item.product.internalCode})` : name;
                      const format: KpiFormat =
                        chartValueKey === 'totalQty' ? 'number' : 'money';
                      return {
                        name: shortName,
                        fullName,
                        value: chartValueKey === 'totalQty' ? item.totalQty : item.totalRevenue,
                        format,
                      };
                    });
                    return (
                      <>
                        <div className="rounded-xl border border-border/80 p-4 bg-muted/20">
                          <p className="text-sm font-medium text-muted-foreground mb-3">
                            {trendingProducts.data!.sortBy === 'qty'
                              ? (trendingPeriod === 'prev_month' || trendingPeriod === 'prev_month_2' || trendingPeriod === 'prev_month_3')
                                ? `Unidades vendidas por artículo (${getMonthRange(trendingPeriod === 'prev_month' ? 1 : trendingPeriod === 'prev_month_2' ? 2 : 3).label})`
                                : trendingProducts.data!.period === 'current_month'
                                  ? 'Unidades vendidas por artículo (este mes)'
                                  : `Unidades vendidas por artículo (últimos ${trendingProducts.data!.periodDays} días)`
                              : (trendingPeriod === 'prev_month' || trendingPeriod === 'prev_month_2' || trendingPeriod === 'prev_month_3')
                                ? `Ingreso por artículo (${getMonthRange(trendingPeriod === 'prev_month' ? 1 : trendingPeriod === 'prev_month_2' ? 2 : 3).label})`
                                : `Ingreso por artículo (últimos ${trendingProducts.data!.periodDays} días)`}
                          </p>
                          <KpiBarChart
                            className="min-h-[280px] h-80 w-full"
                            data={chartData}
                          />
                        </div>
                        <div className="rounded-lg border border-border/80 overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="font-medium w-10">#</TableHead>
                                <TableHead className="font-medium">Producto</TableHead>
                                <TableHead className="font-medium text-muted-foreground">Categoría</TableHead>
                                <TableHead className="text-right font-medium">Ingreso</TableHead>
                                <TableHead className="text-right font-medium text-muted-foreground">Unid.</TableHead>
                                <TableHead className="text-right font-medium text-muted-foreground">Ventas</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item, index) => (
                                <TableRow key={item.product.id} className="hover:bg-muted/30">
                                  <TableCell className="tabular-nums text-muted-foreground w-10">{index + 1}</TableCell>
                                  <TableCell className="font-medium">
                                    <Link href={`/products/${item.product.id}`} className="text-primary hover:underline">
                                      {item.product.name || item.product.internalCode}
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{item.product.category?.name ?? '—'}</TableCell>
                                  <TableCell className="text-right tabular-nums font-medium">
                                    {formatMoney(item.totalRevenue)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">{item.totalQty}</TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">{item.salesCount}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    );
                  })() : (
                    <div className="flex flex-col gap-2 py-6">
                      <p className="text-sm text-muted-foreground">
                        No hay ventas en el período. Los artículos en tendencias se calculan a partir de ventas pagadas.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Elige otro período arriba (Este mes, Mes anterior, etc.) para ver datos de otro mes.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'sales-by-employee' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="sales-by-employee-period" className="text-sm font-medium text-muted-foreground">
                  Período:
                </Label>
                <select
                  id="sales-by-employee-period"
                  value={salesByEmployeePeriod}
                  onChange={(e) => setSalesByEmployeePeriod(e.target.value as SalesPeriodKey)}
                  className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="current_month">{getSalesByEmployeePeriodLabel('current_month')}</option>
                  <option value="prev_month">{getSalesByEmployeePeriodLabel('prev_month')}</option>
                  <option value="prev_month_2">{getSalesByEmployeePeriodLabel('prev_month_2')}</option>
                  <option value="prev_month_3">{getSalesByEmployeePeriodLabel('prev_month_3')}</option>
                  <option value="last_days">{getSalesByEmployeePeriodLabel('last_days')}</option>
                </select>
              </div>
              <p className="text-sm text-muted-foreground">
                {salesByEmployeePeriod === 'last_days'
                  ? `Ventas registradas por empleado en los últimos ${actionableIndicators.data?.periodDays ?? 30} días.`
                  : `Ventas registradas por empleado en ${salesByEmployeePeriod === 'current_month' ? MONTH_NAMES[new Date().getMonth()] + ' ' + new Date().getFullYear() : getMonthRange(salesByEmployeePeriod === 'prev_month' ? 1 : salesByEmployeePeriod === 'prev_month_2' ? 2 : 3).label}.`}
              </p>
              {actionableIndicators.isLoading && (
                <div className="rounded-lg border border-border/80 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-medium text-muted-foreground">Empleado</TableHead>
                        <TableHead className="font-medium text-muted-foreground">Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-40 rounded" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-48 rounded" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {actionableIndicators.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(actionableIndicators.error as { message?: string })?.message ??
                      'Error cargando ventas por empleado'}
                  </p>
                </div>
              )}
              {salesByEmployeeIndicator && salesByEmployeeIndicator.items.length > 0 && !actionableIndicators.isLoading && (
                <>
                  <div className="rounded-xl border border-border/80 p-4 bg-muted/20 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      {salesByEmployeePeriod === 'last_days'
                        ? `Ventas totales por empleado (últimos ${actionableIndicators.data?.periodDays ?? 30} días)`
                        : `Ventas totales por empleado (${salesByEmployeePeriod === 'current_month' ? MONTH_NAMES[new Date().getMonth()] + ' ' + new Date().getFullYear() : getMonthRange(salesByEmployeePeriod === 'prev_month' ? 1 : salesByEmployeePeriod === 'prev_month_2' ? 2 : 3).label})`}
                    </p>
                    <KpiBarChart
                      className="h-72 w-full"
                      data={salesByEmployeeIndicator.items.map((item) => ({
                        name: item.name,
                        value: typeof item.totalSales === 'number' ? item.totalSales : 0,
                        format: 'money' as const,
                      }))}
                    />
                  </div>
                  <div className="rounded-lg border border-border/80 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="font-medium">Empleado</TableHead>
                          <TableHead className="font-medium">Ventas · Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesByEmployeeIndicator.items.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.value ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
              {salesByEmployeeIndicator && salesByEmployeeIndicator.items.length === 0 && !actionableIndicators.isLoading && (
                <p className="text-sm text-muted-foreground py-4">
                  No hay ventas por empleado en el período. Las ventas se asocian al usuario que las registra.
                </p>
              )}
            </div>
          )}

          {activeTab === 'no-rotation' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Productos activos que no tuvieron ventas en los últimos {actionableIndicators.data?.periodDays ?? 30} días. Puedes promocionarlos, ajustar precios o descontinuarlos desde Catálogo → Productos.
              </p>
              {actionableIndicators.isLoading && (
                <div className="rounded-lg border border-border/80 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-medium text-muted-foreground">Producto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-56 rounded" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {actionableIndicators.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(actionableIndicators.error as { message?: string })?.message ??
                      'Error cargando productos sin rotación'}
                  </p>
                </div>
              )}
              {!actionableIndicators.isLoading && !actionableIndicators.isError && noRotationIndicator && noRotationIndicator.items.length > 0 && (
                <>
                  <p className="text-sm font-medium text-foreground">
                    {noRotationIndicator.items.length} producto(s) sin ventas en el período:
                  </p>
                  <div className="rounded-lg border border-border/80 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="font-medium">#</TableHead>
                          <TableHead className="font-medium">Producto</TableHead>
                          <TableHead className="font-medium text-right">Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {noRotationIndicator.items.map((item, index) => (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell className="text-muted-foreground tabular-nums w-10">{index + 1}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{typeof item.stock === 'number' ? item.stock : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
              {!actionableIndicators.isLoading && !actionableIndicators.isError && (!noRotationIndicator || noRotationIndicator.items.length === 0) && (
                <p className="text-sm text-muted-foreground py-4">
                  No hay productos sin rotación en el período. Todos los productos activos tuvieron al menos una venta.
                </p>
              )}
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="sales-period" className="text-sm font-medium text-muted-foreground">
                  Período:
                </Label>
                <select
                  id="sales-period"
                  value={salesPeriod}
                  onChange={(e) => setSalesPeriod(e.target.value as SalesPeriodKey)}
                  className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="current_month">{getSalesPeriodLabel('current_month')}</option>
                  <option value="prev_month">{getSalesPeriodLabel('prev_month')}</option>
                  <option value="prev_month_2">{getSalesPeriodLabel('prev_month_2')}</option>
                  <option value="prev_month_3">{getSalesPeriodLabel('prev_month_3')}</option>
                  <option value="last_days">{getSalesPeriodLabel('last_days')}</option>
                </select>
              </div>
              {salesReport.isLoading && (
                <div className="rounded-lg border border-border/80 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                        <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-28 rounded" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 ml-auto rounded" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {salesReport.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(salesReport.error as { message?: string })?.message ??
                      'Error cargando reporte'}
                  </p>
                </div>
              )}
              {salesReport.data?.summary && !salesReport.isLoading && (
                <div className="p-4 rounded-xl border border-border/80 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Total ventas: {salesReport.data.summary.totalSales ?? 0} · Monto:{' '}
                    {formatMoney(salesReport.data.summary.totalAmount ?? 0)}
                  </p>
                </div>
              )}
              {salesReport.data?.sales && salesReport.data.sales.length > 0 && !salesReport.isLoading && (() => {
                const byDay = new Map<string, { total: number; count: number }>();
                salesReport.data!.sales!.forEach((s: { soldAt?: string; grandTotal?: string | number }) => {
                  const day = s.soldAt ? new Date(s.soldAt).toISOString().slice(0, 10) : '';
                  if (!day) return;
                  const cur = byDay.get(day) ?? { total: 0, count: 0 };
                  cur.total += Number(s.grandTotal ?? 0);
                  cur.count += 1;
                  byDay.set(day, cur);
                });
                const isMonthPeriod = salesPeriod !== 'last_days';
                const sorted = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
                const chartData = (isMonthPeriod ? sorted : sorted.slice(-14)).map(([date, { total, count }]) => ({ date, total, count }));
                const chartTitle = isMonthPeriod
                  ? `Ventas por día (${salesPeriod === 'current_month' ? MONTH_NAMES[new Date().getMonth()] + ' ' + new Date().getFullYear() : getMonthRange(salesPeriod === 'prev_month' ? 1 : salesPeriod === 'prev_month_2' ? 2 : 3).label})`
                  : 'Ventas por día (últimos 14 días con datos)';
                return chartData.length > 0 ? (
                  <div className="rounded-xl border border-border/80 p-4 bg-muted/20 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">{chartTitle}</p>
                    <SalesByDayChart data={chartData} className="h-72 w-full" />
                  </div>
                ) : null;
              })()}
              {salesReport.data?.sales && salesReport.data.sales.length > 0 && !salesReport.isLoading && (
                <div className="rounded-lg border border-border/80 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-border/80">
                        <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                        <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReport.data.sales.slice(0, 15).map((item: { id: string; soldAt?: string; grandTotal?: string | number; customer?: { name: string } }) => (
                        <TableRow key={item.id} className="transition-colors hover:bg-muted/40">
                          <TableCell className="text-sm text-foreground">
                            {item.soldAt ? formatDate(item.soldAt) : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.customer?.name ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-foreground">
                            {formatMoney(Number(item.grandTotal ?? 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              {inventoryReport.isLoading && (
                <p className="text-sm text-muted-foreground">Cargando reporte de inventario…</p>
              )}
              {inventoryReport.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(inventoryReport.error as { message?: string })?.message ??
                      'Error cargando reporte'}
                  </p>
                </div>
              )}
              {inventoryReport.data?.statistics && !inventoryReport.isLoading && (
                <div className="p-4 rounded-xl border border-border/80 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Productos: {inventoryReport.data.statistics.totalProducts ?? '—'} · Con stock bajo:{' '}
                    {inventoryReport.data.statistics.productsLowStock ?? '—'} · Valor total:{' '}
                    {formatMoney(Number(inventoryReport.data.statistics.totalStockValue ?? 0))}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'clusters' && (
            <div className="space-y-4">
              {customerClusters.isLoading && (
                <p className="text-sm text-muted-foreground">Cargando segmentos de clientes…</p>
              )}
              {customerClusters.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(customerClusters.error as { message?: string })?.message ??
                      'Error cargando segmentos de clientes'}
                  </p>
                </div>
              )}
              {customerClusters.data?.clusters && customerClusters.data.clusters.length === 0 && !customerClusters.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Se necesitan al menos {customerClusters.data.k} clientes con ventas en los últimos {customerClusters.data.periodDays} días para ver los segmentos.
                </p>
              )}
              {customerClusters.data?.clusters && customerClusters.data.clusters.length > 0 && !customerClusters.isLoading && (
                <div className="space-y-6">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground mb-1">¿Para qué sirve esto?</p>
                    <p className="text-sm text-muted-foreground">
                      Agrupamos a tus clientes según cuánto compran, hace cuánto compraron y con qué frecuencia (últimos {customerClusters.data.periodDays} días). Así puedes ver de un vistazo quiénes son tus clientes más valiosos, quiénes compran poco y quiénes hace tiempo no compran, para decidir a quién dar ofertas, recordatorios o atención prioritaria.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                    {customerClusters.data.clusters.map((cluster, rank) => (
                      <div
                        key={cluster.clusterIndex}
                        className="rounded-xl border border-border/80 p-4 bg-card shadow-sm space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-semibold text-foreground">
                              {cluster.suggestedLabel ?? `Segmento ${rank + 1}`}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {cluster.customers.length} clientes · promedio {typeof cluster.avgAmount === 'number' ? formatMoney(cluster.avgAmount) : '—'}
                              {typeof cluster.avgDaysAgo === 'number' && (
                                <> · {Math.round(cluster.avgDaysAgo)} días desde última compra</>
                              )}
                            </p>
                          </div>
                        </div>
                        {cluster.description && (
                          <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
                            {cluster.description}
                          </p>
                        )}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Clientes en este segmento</p>
                          <ul className="space-y-1">
                            {cluster.customers.slice(0, 10).map((c) => (
                              <li key={c.id}>
                                <Link href={`/customers?id=${c.id}`} className="text-sm text-primary hover:underline">
                                  {c.name}
                                </Link>
                              </li>
                            ))}
                            {cluster.customers.length > 10 && (
                              <li className="text-xs text-muted-foreground">+ {cluster.customers.length - 10} más</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-4">
              {customersReport.isLoading && (
                <p className="text-sm text-muted-foreground">Cargando reporte de clientes…</p>
              )}
              {customersReport.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(customersReport.error as { message?: string })?.message ??
                      'Error cargando reporte'}
                  </p>
                </div>
              )}
              {customersReport.data?.topCustomers && customersReport.data.topCustomers.length > 0 && !customersReport.isLoading && (
                <>
                  <div className="rounded-xl border border-border/80 p-4 bg-muted/20">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Top 10 clientes por monto</p>
                    <TopCustomersChart
                      data={customersReport.data.topCustomers.map((item) => ({
                        name: item.customer.name,
                        amount: Number(item.statistics.totalAmount),
                        sales: item.statistics.totalSales,
                      }))}
                      maxBars={10}
                      className="min-h-[300px] h-80 w-full"
                    />
                  </div>
                  <div className="rounded-lg border border-border/80 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-border/80">
                          <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                          <TableHead className="text-right font-medium text-muted-foreground">Ventas</TableHead>
                          <TableHead className="text-right font-medium text-muted-foreground">Monto total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customersReport.data.topCustomers.map((item) => (
                          <TableRow key={item.customer.id} className="transition-colors hover:bg-muted/40">
                            <TableCell className="font-medium text-foreground">{item.customer.name}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{item.statistics.totalSales}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-foreground">
                              {formatMoney(Number(item.statistics.totalAmount))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'cash' && (
            <div className="space-y-4">
              {cashReport.isLoading && (
                <p className="text-sm text-muted-foreground">Cargando reporte de caja…</p>
              )}
              {cashReport.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(cashReport.error as { message?: string })?.message ??
                      'Error cargando reporte'}
                  </p>
                </div>
              )}
              {(cashReport.data?.summary || cashReport.data?.sessions) && !cashReport.isLoading && (
                <>
                  {cashReport.data?.summary && (Number(cashReport.data.summary.totalIn ?? 0) > 0 || Number(cashReport.data.summary.totalOut ?? 0) > 0 || Number(cashReport.data.summary.totalAdjust ?? 0) > 0) && (
                    <div className="rounded-xl border border-border/80 p-4 bg-muted/20">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Entradas vs salidas vs ajustes</p>
                      <CashInOutChart
                        data={[
                          {
                            name: 'Caja',
                            entradas: Number(cashReport.data.summary.totalIn ?? 0),
                            salidas: Number(cashReport.data.summary.totalOut ?? 0),
                            ajustes: Number(cashReport.data.summary.totalAdjust ?? 0),
                          },
                        ]}
                        className="h-56 w-full"
                      />
                    </div>
                  )}
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-1">
                    {cashReport.data?.summary && (
                      <p className="text-sm text-muted-foreground">
                        Sesiones: {cashReport.data.summary.totalSessions ?? 0} · Abiertas: {cashReport.data.summary.openSessions ?? 0} · Entradas: {formatMoney(Number(cashReport.data.summary.totalIn ?? 0))} · Salidas: {formatMoney(Number(cashReport.data.summary.totalOut ?? 0))}{Number(cashReport.data.summary.totalAdjust ?? 0) > 0 ? ` · Ajustes: ${formatMoney(Number(cashReport.data.summary.totalAdjust ?? 0))}` : ''}
                      </p>
                    )}
                    {cashReport.data?.sessions && cashReport.data.sessions.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Detalle: {cashReport.data.sessions.length} sesión(es) en el período.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
