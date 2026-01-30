'use client';

import { useState } from 'react';
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
import { FileText, BarChart3, Package, Wallet, Users } from 'lucide-react';
import {
  useDashboard,
  useSalesReport,
  useInventoryReport,
  useCashReport,
  useCustomersReport,
} from '@features/reports/hooks';

type TabId = 'dashboard' | 'sales' | 'inventory' | 'cash' | 'customers';

const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'sales', label: 'Ventas', icon: FileText },
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'cash', label: 'Caja', icon: Wallet },
  { id: 'customers', label: 'Clientes', icon: Users },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const dashboard = useDashboard();
  const salesReport = useSalesReport({});
  const inventoryReport = useInventoryReport({});
  const cashReport = useCashReport({});
  const customersReport = useCustomersReport({ top: 20 });

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Reportes
        </h1>
        <p className="text-sm text-muted-foreground">
          Ventas, inventario, caja, clientes y KPIs
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0" />
            Reportes y dashboard
          </CardTitle>
          <CardDescription>
            Ventas, inventario, caja, clientes desde GET /reports/*
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-border pb-3">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  activeTab === id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
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
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
              )}
              {dashboard.isError && (
                <p className="text-sm text-destructive">
                  {(dashboard.error as { message?: string })?.message ??
                    'Error cargando dashboard'}
                </p>
              )}
              {dashboard.data && !dashboard.isLoading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {dashboard.data.sales?.today?.total != null && (
                    <div className="p-4 rounded-xl border border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Ventas hoy
                      </p>
                      <p className="text-xl font-semibold mt-1">
                        {formatMoney(dashboard.data.sales.today.total)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dashboard.data.sales.today.count ?? 0} ventas
                      </p>
                    </div>
                  )}
                  {dashboard.data.inventory?.lowStockCount != null && (
                    <div className="p-4 rounded-xl border border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Productos con stock bajo
                      </p>
                      <p className="text-xl font-semibold mt-1">
                        {dashboard.data.inventory.lowStockCount}
                      </p>
                    </div>
                  )}
                  {dashboard.data.cash?.openSessions != null && (
                    <div className="p-4 rounded-xl border border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Sesiones abiertas
                      </p>
                      <p className="text-xl font-semibold mt-1">
                        {dashboard.data.cash.openSessions}
                      </p>
                    </div>
                  )}
                  {dashboard.data.quotes?.pending != null && (
                    <div className="p-4 rounded-xl border border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Cotizaciones pendientes
                      </p>
                      <p className="text-xl font-semibold mt-1">
                        {dashboard.data.quotes.pending}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {dashboard.data && !dashboard.isLoading && (dashboard.data.inventory?.lowStockCount != null || dashboard.data.cash?.openSessions != null || dashboard.data.quotes?.pending != null) && (
                <div className="rounded-xl border border-border p-4 bg-muted/20">
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

          {activeTab === 'sales' && (
            <div className="space-y-4">
              {salesReport.isLoading && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {salesReport.isError && (
                <p className="text-sm text-destructive">
                  {(salesReport.error as { message?: string })?.message ??
                    'Error cargando reporte'}
                </p>
              )}
              {salesReport.data?.summary && !salesReport.isLoading && (
                <div className="p-4 rounded-xl border border-border bg-muted/30">
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
                  <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">Ventas por día (últimos 14 días con datos)</p>
                    <SalesByDayChart data={chartData} className="h-72 w-full" />
                  </div>
                ) : null;
              })()}
              {salesReport.data?.sales && salesReport.data.sales.length > 0 && !salesReport.isLoading && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReport.data.sales.slice(0, 15).map((item: { id: string; soldAt?: string; grandTotal?: string | number; customer?: { name: string } }) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.soldAt ? formatDate(item.soldAt) : '—'}
                          </TableCell>
                          <TableCell>{item.customer?.name ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">
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
                <p className="text-sm text-destructive">
                  {(inventoryReport.error as { message?: string })?.message ??
                    'Error cargando reporte'}
                </p>
              )}
              {inventoryReport.data?.statistics && !inventoryReport.isLoading && (
                <div className="p-4 rounded-xl border border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Productos: {inventoryReport.data.statistics.totalProducts ?? '—'} · Con stock bajo:{' '}
                    {inventoryReport.data.statistics.productsLowStock ?? '—'} · Valor total:{' '}
                    {formatMoney(Number(inventoryReport.data.statistics.totalStockValue ?? 0))}
                  </p>
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
                <p className="text-sm text-destructive">
                  {(customersReport.error as { message?: string })?.message ??
                    'Error cargando reporte'}
                </p>
              )}
              {customersReport.data?.topCustomers && customersReport.data.topCustomers.length > 0 && !customersReport.isLoading && (
                <>
                  <div className="rounded-xl border border-border p-4 bg-muted/20">
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
                  <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">Monto total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customersReport.data.topCustomers.map((item) => (
                        <TableRow key={item.customer.id}>
                          <TableCell className="font-medium">{item.customer.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.statistics.totalSales}</TableCell>
                          <TableCell className="text-right tabular-nums">
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
                <p className="text-sm text-destructive">
                  {(cashReport.error as { message?: string })?.message ??
                    'Error cargando reporte'}
                </p>
              )}
              {(cashReport.data?.summary || cashReport.data?.sessions) && !cashReport.isLoading && (
                <>
                  {cashReport.data?.summary && (Number(cashReport.data.summary.totalIn ?? 0) > 0 || Number(cashReport.data.summary.totalOut ?? 0) > 0 || Number(cashReport.data.summary.totalAdjust ?? 0) > 0) && (
                    <div className="rounded-xl border border-border p-4 bg-muted/20">
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
                  <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1">
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
