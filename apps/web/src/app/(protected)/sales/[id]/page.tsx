'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { Badge } from '@shared/components/ui/badge';
import { ArrowLeft, FileCheck, ShoppingCart } from 'lucide-react';
import { useSale } from '@features/sales/hooks';
import { useDianDocumentStatus } from '@features/dian/hooks';
import { formatMoney } from '@shared/utils/format';

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: sale, isLoading, isError, error } = useSale(id);

  // Calcular dianDocumentId ANTES de cualquier return condicional
  // para que el hook siempre se llame en el mismo orden
  const soldAt = sale?.soldAt ? new Date(sale.soldAt).toLocaleString() : '—';
  const items = sale?.items ?? [];
  type InvoiceLike = { id?: string; number?: string; dianDocument?: { id: string } | null } | string;
  const invoices: InvoiceLike[] = (sale?.invoices ?? []) as InvoiceLike[];
  const firstInvoiceWithDian = invoices.find(
    (inv): inv is { id: string; number: string; dianDocument?: { id: string } | null } =>
      typeof inv === 'object' && inv !== null && 'dianDocument' in inv && inv.dianDocument?.id != null,
  );
  const dianDocumentId = firstInvoiceWithDian?.dianDocument?.id ?? null;
  
  // Hook siempre se llama, pero la query solo se ejecuta si hay dianDocumentId
  const { data: dianStatus } = useDianDocumentStatus(dianDocumentId);

  if (!id) {
    router.replace('/sales');
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
        </div>
      </div>
    );
  }

  if (isError || !sale) {
    return (
      <div className="space-y-10">
        <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
          <Link href="/sales">
            <ArrowLeft className="h-4 w-4" />
            Volver a ventas
          </Link>
        </Button>
        <div className="rounded-2xl border border-destructive/50 bg-card p-6 dark:border-[#1F2937]">
            <p className="text-sm text-destructive">
              {(error as { message?: string })?.message ?? 'Venta no encontrada.'}
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Venta #{sale.id.slice(0, 8)}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {soldAt}
            {sale.customer ? ` · ${sale.customer.name}` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-2 shrink-0 rounded-xl">
          <Link href="/sales">
            <ArrowLeft className="h-4 w-4" />
            Volver a ventas
          </Link>
        </Button>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="pb-4 border-b border-border/60 px-6 pt-6">
          <h2 className="text-lg font-medium text-foreground">Detalle de la venta</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cliente: {sale.customer?.name ?? '—'}
            {sale.createdBy ? ` · Registrada por: ${sale.createdBy.email}` : ''}
          </p>
        </div>
        <div className="pt-6 px-6 pb-6 space-y-6">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Fecha</dt>
              <dd className="text-sm text-foreground">{soldAt}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Cliente</dt>
              <dd className="text-sm text-foreground">{sale.customer?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Estado</dt>
              <dd className="text-sm text-foreground">{sale.status ?? '—'}</dd>
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
                          {formatMoney(Number(item.qty) * Number(item.unitPrice ?? 0))}
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
              <span className="tabular-nums">{formatMoney(Number(sale.subtotal ?? 0))}</span>
            </div>
            <div className="flex justify-end gap-4 text-sm">
              <span className="text-muted-foreground">IVA:</span>
              <span className="tabular-nums">{formatMoney(Number(sale.taxTotal ?? 0))}</span>
            </div>
            {Number(sale.discountTotal ?? 0) > 0 && (
              <div className="flex justify-end gap-4 text-sm">
                <span className="text-muted-foreground">Descuento:</span>
                <span className="tabular-nums">-{formatMoney(Number(sale.discountTotal))}</span>
              </div>
            )}
            <div className="flex justify-end gap-4 text-sm font-medium">
              <span className="text-foreground">Total:</span>
              <span className="tabular-nums text-foreground">{formatMoney(Number(sale.grandTotal ?? 0))}</span>
            </div>
          </div>

          {invoices.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-foreground">Factura(s)</h3>
              <ul className="text-sm space-y-1">
                {invoices.map((inv, index) => {
                  if (typeof inv === 'object' && inv !== null) {
                    if ('number' in inv && typeof inv.number === 'string') {
                      return (
                        <li key={inv.id ?? `invoice-${index}`}>
                          {`Factura ${inv.number}`}
                        </li>
                      );
                    }
                    if ('id' in inv && typeof inv.id === 'string') {
                      return <li key={inv.id}>{inv.id}</li>;
                    }
                  }
                  return <li key={`invoice-${index}`}>{String(inv)}</li>;
                })}
              </ul>
            </>
          )}

          {dianDocumentId && (
            <>
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
                Facturación electrónica (DIAN)
              </h3>
              <div className="rounded-lg border border-border/80 bg-muted/30 p-4 space-y-2">
                <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Estado</dt>
                    <dd>
                      {dianStatus ? (
                        <Badge
                          variant={
                            dianStatus.status === 'ACCEPTED'
                              ? 'default'
                              : dianStatus.status === 'REJECTED'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {dianStatus.status === 'DRAFT'
                            ? 'En cola'
                            : dianStatus.status === 'SIGNED'
                              ? 'Firmado'
                              : dianStatus.status === 'SENT'
                                ? 'Enviado'
                                : dianStatus.status === 'ACCEPTED'
                                  ? 'Aceptado por DIAN'
                                  : dianStatus.status === 'REJECTED'
                                    ? 'Rechazado por DIAN'
                                    : dianStatus.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </dd>
                  </div>
                  {dianStatus?.sentAt && (
                    <div>
                      <dt className="text-muted-foreground">Enviado</dt>
                      <dd>{new Date(dianStatus.sentAt).toLocaleString('es-CO')}</dd>
                    </div>
                  )}
                </dl>
                {dianStatus?.status === 'REJECTED' && dianStatus?.lastError && (
                  <p className="text-sm text-destructive mt-2">
                    Error DIAN: {dianStatus.lastError}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
