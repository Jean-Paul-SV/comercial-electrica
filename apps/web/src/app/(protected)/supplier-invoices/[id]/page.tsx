'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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

  if (isError || !invoice) {
    return (
      <div className="space-y-10">
        <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
          <Link href="/supplier-invoices">
            <ArrowLeft className="h-4 w-4" />
            Volver a facturas proveedor
          </Link>
        </Button>
        <div className="rounded-2xl border border-destructive/50 bg-card p-6">
          <p className="text-sm text-destructive">
            {(error as { message?: string })?.message ?? 'Factura no encontrada.'}
          </p>
        </div>
      </div>
    );
  }

  const subtotal = Number(invoice.subtotal);
  const taxTotal = Number(invoice.taxTotal);
  const discountTotal = Number(invoice.discountTotal ?? 0);
  const grandTotal = Number(invoice.grandTotal);
  const paidAmount = Number(invoice.paidAmount ?? 0);

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <FileText className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            {invoice.invoiceNumber}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {invoice.supplier ? `${invoice.supplier.name} · NIT ${invoice.supplier.nit}` : `Proveedor ID: ${invoice.supplierId}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
            <Link href="/supplier-invoices">
              <ArrowLeft className="h-4 w-4" />
              Volver a facturas proveedor
            </Link>
          </Button>
          {invoice.supplier && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/suppliers/${invoice.supplier.id}`}>
                <Truck className="h-4 w-4" />
                Ver proveedor
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="pb-4 border-b border-border/60 px-6 pt-6 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-medium text-foreground">Detalle</h2>
          <Badge variant="secondary">
            {STATUS_LABELS[invoice.status] ?? invoice.status}
          </Badge>
        </div>
        <div className="pt-6 px-6 pb-6 space-y-4">
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
        </div>
      </div>
    </div>
  );
}
