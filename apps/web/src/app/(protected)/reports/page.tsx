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
import { FileText, BarChart3, Package, Wallet, Users, UserCircle, PieChart, PackageX } from 'lucide-react';
import Link from 'next/link';
import {
  useDashboard,
  useSalesReport,
  useInventoryReport,
  useCashReport,
  useCustomersReport,
  useCustomerClusters,
  useActionableIndicators,
} from '@features/reports/hooks';

type TabId = 'dashboard' | 'sales' | 'inventory' | 'cash' | 'customers' | 'clusters' | 'sales-by-employee' | 'no-rotation';

const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'sales', label: 'Ventas', icon: FileText },
  { id: 'sales-by-employee', label: 'Ventas por empleado', icon: UserCircle },
  { id: 'no-rotation', label: 'Productos sin rotación', icon: PackageX },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'cash', label: 'Caja', icon: Wallet },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'clusters', label: 'Clusters (K-means)', icon: PieChart },
];

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as TabId | null;
  const validTabs: TabId[] = ['dashboard', 'sales', 'inventory', 'cash', 'customers', 'clusters', 'sales-by-employee', 'no-rotation'];
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    return tabParam && validTabs.includes(tabParam) ? tabParam : 'dashboard';
  });

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
  const salesReport = useSalesReport({});
  const inventoryReport = useInventoryReport({});
  const cashReport = useCashReport({});
  const customersReport = useCustomersReport({ top: 20 });
  const customerClusters = useCustomerClusters({ days: 90, k: 3 });
  const actionableIndicators = useActionableIndicators({ days: 30, top: 50 });
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

          {activeTab === 'sales-by-employee' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ventas registradas por empleado en los últimos {actionableIndicators.data?.periodDays ?? 30} días.
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
                      Ventas totales por empleado (últimos {actionableIndicators.data?.periodDays ?? 30} días)
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {noRotationIndicator.items.map((item, index) => (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell className="text-muted-foreground tabular-nums w-10">{index + 1}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
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
                const chartData = Array.from(byDay.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .slice(-14)
                  .map(([date, { total, count }]) => ({ date, total, count }));
                return chartData.length > 0 ? (
                  <div className="rounded-xl border border-border/80 p-4 bg-muted/20 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">Ventas por día (últimos 14 días con datos)</p>
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
                <p className="text-sm text-muted-foreground">Cargando clusters de clientes (K-means)…</p>
              )}
              {customerClusters.isError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">
                    {(customerClusters.error as { message?: string })?.message ??
                      'Error cargando clusters'}
                  </p>
                </div>
              )}
              {customerClusters.data?.clusters && customerClusters.data.clusters.length === 0 && !customerClusters.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Se necesitan al menos {customerClusters.data.k} clientes con ventas en los últimos {customerClusters.data.periodDays} días para generar clusters.
                </p>
              )}
              {customerClusters.data?.clusters && customerClusters.data.clusters.length > 0 && !customerClusters.isLoading && (
                <div className="space-y-6">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground mb-1">¿Qué son estos segmentos?</p>
                    <p className="text-sm text-muted-foreground">
                      Agrupamos clientes por su comportamiento: monto total comprado, días desde la última compra y cantidad de compras (últimos {customerClusters.data.periodDays} días). Así puedes priorizar fidelización, ofertas o reactivación según el segmento.
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
                      className="h-72 w-full"
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
