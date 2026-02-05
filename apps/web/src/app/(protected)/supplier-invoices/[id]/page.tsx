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
import { ArrowLeft, FileText, Truck } from 'lucide-react';
import { useSupplierInvoice } from '@features/supplier-invoices/hooks';
import { formatMoney, formatDate } from '@shared/utils/format';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PARTIALLY_PAID: 'Abono',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

export default function SupplierInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: invoice, isLoading, isError, error } = useSupplierInvoice(id);

  if (!id) {
    router.replace('/supplier-invoices');
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

  if (isError || !invoice) {
    return (
      <div className="space-y-6">
        <Link href="/supplier-invoices">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a facturas proveedor
          </Button>
        </Link>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {(error as { message?: string })?.message ?? 'Factura no encontrada.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subtotal = Number(invoice.subtotal);
  const taxTotal = Number(invoice.taxTotal);
  const discountTotal = Number(invoice.discountTotal ?? 0);
  const grandTotal = Number(invoice.grandTotal);
  const paidAmount = Number(invoice.paidAmount ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/supplier-invoices">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a facturas proveedor
          </Button>
        </Link>
        {invoice.supplier && (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/suppliers/${invoice.supplier.id}`}>
              <Truck className="h-4 w-4" />
              Ver proveedor
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Factura de proveedor
        </h1>
        <p className="text-sm text-muted-foreground">
          {invoice.invoiceNumber}
          {invoice.supplier && ` · ${invoice.supplier.name}`}
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
              <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              {invoice.invoiceNumber}
            </CardTitle>
            <Badge variant="secondary">
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </Badge>
          </div>
          <CardDescription>
            {invoice.supplier
              ? `${invoice.supplier.name} · NIT ${invoice.supplier.nit}`
              : `Proveedor ID: ${invoice.supplierId}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Nº factura</dt>
              <dd className="text-sm font-mono text-foreground">{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Fecha factura</dt>
              <dd className="text-sm text-foreground">{formatDate(invoice.invoiceDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Vencimiento</dt>
              <dd className="text-sm text-foreground">{formatDate(invoice.dueDate)}</dd>
            </div>
            {invoice.supplier && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Proveedor</dt>
                <dd className="text-sm text-foreground">
                  <Link
                    href={`/suppliers/${invoice.supplier.id}`}
                    className="text-primary hover:underline"
                  >
                    {invoice.supplier.name}
                  </Link>
                </dd>
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
            {discountTotal > 0 && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Descuento</dt>
                <dd className="text-sm text-foreground">-{formatMoney(discountTotal)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Total</dt>
              <dd className="text-sm font-semibold text-foreground">{formatMoney(grandTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Pagado</dt>
              <dd className="text-sm text-foreground">{formatMoney(paidAmount)}</dd>
            </div>
          </dl>

          {invoice.payments && invoice.payments.length > 0 && (
            <div className="pt-4 border-t border-border/60">
              <h3 className="text-sm font-medium text-foreground mb-2">Pagos registrados</h3>
              <ul className="space-y-2">
                {invoice.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 text-sm rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <span>{formatDate(p.paymentDate)} · {p.paymentMethod}</span>
                    <span className="font-medium">{formatMoney(Number(p.amount))}</span>
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
