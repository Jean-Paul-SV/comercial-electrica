'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@shared/components/ui/button';
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, RotateCcw, FileText, Package } from 'lucide-react';
import { useReturn } from '@features/returns/hooks';
import { formatMoney, formatDate } from '@shared/utils/format';

export default function ReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: returnData, isLoading, isError, error } = useReturn(id);

  if (!id) {
    router.replace('/returns');
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-10">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
          <Skeleton className="h-5 w-full mt-4" />
          <Skeleton className="h-5 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !returnData) {
    return (
      <div className="space-y-10">
        <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
          <Link href="/returns">
            <ArrowLeft className="h-4 w-4" />
            Volver a devoluciones
          </Link>
        </Button>
        <div className="rounded-2xl border border-destructive/50 bg-card p-6">
          <p className="text-sm text-destructive">
            {(error as { message?: string })?.message ?? 'Devolución no encontrada.'}
          </p>
        </div>
      </div>
    );
  }

  const subtotal = Number(returnData.subtotal);
  const taxTotal = Number(returnData.taxTotal);
  const grandTotal = Number(returnData.grandTotal);

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <RotateCcw className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Devolución
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDate(returnData.returnedAt)}
            {returnData.sale?.customer && ` · Cliente: ${returnData.sale.customer.name}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
            <Link href="/returns">
              <ArrowLeft className="h-4 w-4" />
              Volver a devoluciones
            </Link>
          </Button>
          {returnData.sale && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/sales/${returnData.sale.id}`}>
                <FileText className="h-4 w-4" />
                Ver venta
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="pb-4 border-b border-border/60 px-6 pt-6">
          <h2 className="text-lg font-medium text-foreground">Detalle</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fecha: {formatDate(returnData.returnedAt)}
            {returnData.sale && (
              <> · Venta: <Link href={`/sales/${returnData.sale.id}`} className="text-primary hover:underline">{returnData.sale.id.slice(0, 8)}…</Link></>
            )}
          </p>
        </div>
        <div className="pt-6 px-6 pb-6 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Fecha devolución</dt>
              <dd className="text-sm text-foreground">{formatDate(returnData.returnedAt)}</dd>
            </div>
            {returnData.sale && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Venta</dt>
                <dd className="text-sm text-foreground">
                  <Link
                    href={`/sales/${returnData.sale.id}`}
                    className="text-primary hover:underline"
                  >
                    Ver venta #{returnData.sale.id.slice(0, 8)}
                  </Link>
                </dd>
              </div>
            )}
            {returnData.sale?.customer && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Cliente</dt>
                <dd className="text-sm text-foreground">
                  <Link
                    href={`/customers/${returnData.sale.customer.id}`}
                    className="text-primary hover:underline"
                  >
                    {returnData.sale.customer.name}
                  </Link>
                </dd>
              </div>
            )}
            {returnData.reason && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Motivo</dt>
                <dd className="text-sm text-foreground">{returnData.reason}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Subtotal</dt>
              <dd className="text-sm text-foreground">{formatMoney(subtotal)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Impuestos</dt>
              <dd className="text-sm text-foreground">{formatMoney(taxTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Total</dt>
              <dd className="text-sm font-semibold text-foreground">{formatMoney(grandTotal)}</dd>
            </div>
          </dl>

          {returnData.items && returnData.items.length > 0 && (
            <div className="pt-4 border-t border-border/60">
              <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Productos devueltos
              </h3>
              <ul className="space-y-2">
                {returnData.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-sm rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <span>{item.product?.name ?? `Producto ${item.productId.slice(0, 8)}`}</span>
                    <span className="text-muted-foreground">
                      {item.qty} u. × {formatMoney(item.unitPrice)} = {formatMoney(Number(item.lineTotal))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
