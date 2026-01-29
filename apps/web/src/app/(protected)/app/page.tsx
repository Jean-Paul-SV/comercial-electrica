'use client';

import { useAuth } from '@shared/providers/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { LayoutDashboard, ShoppingCart, Package } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sesión: {user?.email} · {user?.role}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/sales">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                Ventas
              </CardTitle>
              <CardDescription>
                Listado paginado desde API
              </CardDescription>
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
              <CardDescription>
                Catálogo y categorías
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Card className="opacity-80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutDashboard className="h-4 w-4" />
              Más módulos
            </CardTitle>
            <CardDescription>
              Clientes, Caja, Reportes en el menú
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
