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
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import { ArrowLeft, FileText, User, Calendar, Hash } from 'lucide-react';
import { useQuote } from '@features/quotes/hooks';
import { formatMoney } from '@shared/utils/format';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  EXPIRED: 'Expirada',
  CONVERTED: 'Convertida a venta',
  CANCELLED: 'Cancelada',
};

const STATUS_BADGE_VARIANT: Record<string, 'secondary' | 'default' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  SENT: 'outline',
  EXPIRED: 'warning',
  CONVERTED: 'success',
  CANCELLED: 'destructive',
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
        <Skeleton className="h-6 w-32 rounded" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
        <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/60">
            <Skeleton className="h-6 w-40 rounded" />
            <Skeleton className="h-4 w-72 rounded mt-2" />
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-20 w-48 ml-auto rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="space-y-6">
        <Link href="/quotes" className="inline-flex">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver a cotizaciones
          </Button>
        </Link>
        <Card className="border border-destructive/40 shadow-sm rounded-xl overflow-hidden bg-destructive/5">
          <CardContent className="pt-6 pb-6">
            <p className="text-sm text-destructive font-medium">
              {(error as { message?: string })?.message ?? 'Cotización no encontrada.'}
            </p>
            <Link href="/quotes" className="inline-block mt-3">
              <Button variant="outline" size="sm">Ver listado</Button>
            </Link>
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

  const statusLabel = STATUS_LABELS[quote.status] ?? quote.status;
  const badgeVariant = STATUS_BADGE_VARIANT[quote.status] ?? 'outline';
  const createdStr = quote.createdAt ? new Date(quote.createdAt).toLocaleString() : null;
  const validUntilStr = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : null;

  return (
    <div className="space-y-6">
      <Link href="/quotes" className="inline-flex">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Volver a cotizaciones
        </Button>
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl flex items-center gap-2 flex-wrap">
            <span>Cotización #{quote.id.slice(0, 8)}</span>
            <Badge variant={badgeVariant} className="font-medium">
              {statusLabel}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {quote.customer ? quote.customer.name : 'Sin cliente'}
          </p>
        </div>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Detalle de la cotización
          </CardTitle>
          <CardDescription>
            {createdStr && <span>Creada: {createdStr}</span>}
            {validUntilStr && <span>{createdStr ? ' · ' : ''}Válida hasta: {validUntilStr}</span>}
            {!createdStr && !validUntilStr && '—'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Hash className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Estado</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{statusLabel}</p>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Cliente</p>
                <p className="text-sm font-medium text-foreground mt-0.5 truncate" title={quote.customer?.name ?? undefined}>
                  {quote.customer?.name ?? '—'}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calendar className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Válida hasta</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{validUntilStr ?? '—'}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Ítems</h3>
            {items.length > 0 ? (
              <div className="rounded-lg border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="font-medium text-muted-foreground">Producto</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground w-20">Cant.</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">P. unit.</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="transition-colors hover:bg-muted/40">
                        <TableCell className="font-medium text-foreground">
                          {item.product?.name ?? item.productId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{item.qty}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatMoney(Number(item.unitPrice ?? 0))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-foreground">
                          {formatMoney(Number(item.lineTotal ?? 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 py-8 text-center">
                <p className="text-sm text-muted-foreground">No hay ítems en esta cotización.</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5 flex flex-col items-end gap-2 sm:max-w-sm sm:ml-auto">
            <div className="flex justify-between gap-6 w-full text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums font-medium">{formatMoney(subtotal)}</span>
            </div>
            {taxTotal > 0 && (
              <div className="flex justify-between gap-6 w-full text-sm">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">{formatMoney(taxTotal)}</span>
              </div>
            )}
            {discountTotal > 0 && (
              <div className="flex justify-between gap-6 w-full text-sm">
                <span className="text-muted-foreground">Descuento</span>
                <span className="tabular-nums">-{formatMoney(discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between gap-6 w-full text-base font-semibold pt-2 mt-1 border-t border-border/60">
              <span className="text-foreground">Total</span>
              <span className="tabular-nums text-foreground">{formatMoney(grandTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
