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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import { ArrowLeft, FileText } from 'lucide-react';
import { useQuote } from '@features/quotes/hooks';
import { formatMoney } from '@shared/utils/format';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  EXPIRED: 'Expirada',
  CONVERTED: 'Convertida a venta',
  CANCELLED: 'Cancelada',
};

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: quote, isLoading, isError, error } = useQuote(id);

  if (!id) {
    router.replace('/quotes');
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
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="space-y-6">
        <Link href="/quotes">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a cotizaciones
          </Button>
        </Link>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {(error as { message?: string })?.message ?? 'Cotización no encontrada.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subtotal = Number(quote.subtotal ?? 0);
  const taxTotal = Number(quote.taxTotal ?? 0);
  const discountTotal = Number(quote.discountTotal ?? 0);
  const grandTotal = Number(quote.grandTotal ?? 0);
  const items = quote.items ?? [];

  return (
    <div className="space-y-6">
      <Link href="/quotes">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver a cotizaciones
        </Button>
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Cotización #{quote.id.slice(0, 8)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Estado: {STATUS_LABELS[quote.status] ?? quote.status}
          {quote.customer ? ` · ${quote.customer.name}` : ''}
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Detalle de la cotización
          </CardTitle>
          <CardDescription>
            Creada: {quote.createdAt ? new Date(quote.createdAt).toLocaleString() : '—'}
            {quote.validUntil ? ` · Válida hasta: ${new Date(quote.validUntil).toLocaleDateString()}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Estado</dt>
              <dd className="text-sm text-foreground">{STATUS_LABELS[quote.status] ?? quote.status}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Cliente</dt>
              <dd className="text-sm text-foreground">{quote.customer?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Válida hasta</dt>
              <dd className="text-sm text-foreground">
                {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '—'}
              </dd>
            </div>
          </dl>

          {items.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-foreground">Ítems</h3>
              <div className="rounded-lg border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="font-medium text-muted-foreground">Producto</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">Cant.</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">P. unit.</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/40">
                        <TableCell className="text-foreground">
                          {item.product?.name ?? item.productId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.qty}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(Number(item.unitPrice ?? 0))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatMoney(Number(item.lineTotal ?? 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <div className="flex flex-col items-end gap-1 pt-2 border-t border-border/60">
            <div className="flex justify-end gap-4 text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
            {taxTotal > 0 && (
              <div className="flex justify-end gap-4 text-sm">
                <span className="text-muted-foreground">IVA:</span>
                <span className="tabular-nums">{formatMoney(taxTotal)}</span>
              </div>
            )}
            {discountTotal > 0 && (
              <div className="flex justify-end gap-4 text-sm">
                <span className="text-muted-foreground">Descuento:</span>
                <span className="tabular-nums">-{formatMoney(discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-end gap-4 text-sm font-medium">
              <span className="text-foreground">Total:</span>
              <span className="tabular-nums text-foreground">{formatMoney(grandTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
