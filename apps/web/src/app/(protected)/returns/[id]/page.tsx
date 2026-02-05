'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
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
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !returnData) {
    return (
      <div className="space-y-6">
        <Link href="/returns">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a devoluciones
          </Button>
        </Link>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {(error as { message?: string })?.message ?? 'Devolución no encontrada.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subtotal = Number(returnData.subtotal);
  const taxTotal = Number(returnData.taxTotal);
  const grandTotal = Number(returnData.grandTotal);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/returns">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a devoluciones
          </Button>
        </Link>
        {returnData.sale && (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/sales/${returnData.sale.id}`}>
              <FileText className="h-4 w-4" />
              Ver venta
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Detalle de la devolución
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(returnData.returnedAt)}
          {returnData.sale?.customer && ` · Cliente: ${returnData.sale.customer.name}`}
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
            <RotateCcw className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Devolución
          </CardTitle>
          <CardDescription>
            Fecha: {formatDate(returnData.returnedAt)}
            {returnData.sale && (
              <> · Venta: <Link href={`/sales/${returnData.sale.id}`} className="text-primary hover:underline">{returnData.sale.id.slice(0, 8)}…</Link></>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
