'use client';

import Link from 'next/link';
import { Button } from '@shared/components/ui/button';
import { ShoppingBag } from 'lucide-react';

export default function PurchasesPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <ShoppingBag className="h-7 w-7 shrink-0 text-primary" aria-hidden />
          Compras (pedidos)
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Módulo deshabilitado
        </p>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] max-w-xl p-6 dark:border-[#1F2937]">
        <p className="text-muted-foreground text-sm mb-4">
          El módulo de pedidos de compra está deshabilitado. Puedes registrar compras directamente con las facturas de proveedor en Facturas proveedor; los pagos se reflejan en Gastos.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default" size="sm" className="rounded-xl bg-primary hover:bg-primary/90">
            <Link href="/supplier-invoices">Ir a Facturas proveedor</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/app">Ir al Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
