'use client';

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
} from 'lucide-react';
import Link from 'next/link';
import { useDashboard } from '@features/reports/hooks';
import { formatMoney } from '@shared/utils/format';
import { KpiBarChart } from '@shared/components/charts/KpiBarChart';

export default function DashboardPage() {
  const { user } = useAuth();
  const dashboard = useDashboard();

  const d = dashboard.data;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Sesión: {user?.email} · {user?.role}
        </p>
      </div>

      {dashboard.isLoading && (
        <p className="text-sm text-muted-foreground">Cargando KPIs…</p>
      )}
      {dashboard.isError && (
        <p className="text-sm text-destructive">
          {(dashboard.error as { message?: string })?.message ??
            'Error cargando dashboard'}
        </p>
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
          {d.inventory?.lowStockCount != null && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Stock bajo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{d.inventory.lowStockCount}</p>
                <p className="text-xs text-muted-foreground mt-1">productos</p>
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
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Indicadores
            </CardTitle>
            <CardDescription>Stock bajo, sesiones abiertas, cotizaciones pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            <KpiBarChart
              className="h-56 w-full"
              data={[
                ...(d.inventory?.lowStockCount != null ? [{ name: 'Stock bajo', value: d.inventory.lowStockCount, format: 'number' as const }] : []),
                ...(d.cash?.openSessions != null ? [{ name: 'Sesiones abiertas', value: d.cash.openSessions, format: 'number' as const }] : []),
                ...(d.quotes?.pending != null ? [{ name: 'Cotizaciones pendientes', value: d.quotes.pending, format: 'number' as const }] : []),
              ]}
            />
          </CardContent>
        </Card>
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
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
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
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
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
        <Link href="/purchases">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-4 w-4" />
                Compras
              </CardTitle>
              <CardDescription>Pedidos de compra</CardDescription>
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
