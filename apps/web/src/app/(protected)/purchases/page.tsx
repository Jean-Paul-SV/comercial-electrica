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
import { ShoppingBag } from 'lucide-react';

export default function PurchasesPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Compras (pedidos)
        </h1>
        <p className="text-sm text-muted-foreground">
          Módulo deshabilitado
        </p>
      </div>

      <Card className="border-0 shadow-sm max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
            Pedidos de compra deshabilitados
          </CardTitle>
          <CardDescription>
            El módulo de pedidos de compra está deshabilitado. Puedes registrar compras directamente con las facturas de proveedor en Facturas proveedor; los pagos se reflejan en Gastos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="secondary" size="sm">
            <Link href="/app">Ir al Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
