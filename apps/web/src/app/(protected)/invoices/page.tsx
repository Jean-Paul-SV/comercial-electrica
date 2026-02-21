'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Pagination } from '@shared/components/Pagination';
import { formatMoney, formatDate } from '@shared/utils/format';
import { FileText, Search, ExternalLink, Ban, RotateCw, ArrowLeft } from 'lucide-react';
import { useInvoicesList, useVoidInvoice } from '@features/invoices/hooks';
import { useRetryPendingDianDocuments } from '@features/dian/hooks';
import type { InvoiceStatus, InvoiceListItem } from '@features/invoices/types';

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Borrador',
  ISSUED: 'Emitida',
  VOIDED: 'Anulada',
};

/** Etiqueta y estilo según estado de factura + estado DIAN (en cola, rechazada, aceptada). */
function getInvoiceDisplayStatus(inv: InvoiceListItem): { label: string; className: string; title?: string } {
  if (inv.status === 'VOIDED') {
    return { label: 'Anulada', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
  }
  if (inv.status === 'DRAFT') {
    return { label: 'Borrador', className: 'bg-muted text-muted-foreground' };
  }
  
  // PRIORIDAD 1: Si la venta NO requiere factura electrónica, siempre es Local
  // (independientemente de si hay o no documento DIAN)
  // Verificar explícitamente que requireElectronicInvoice sea false (no undefined, null, ni true)
  if (inv.sale && inv.sale.requireElectronicInvoice === false) {
    return {
      label: 'Local',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      title: 'Documento interno (no requiere factura electrónica DIAN)',
    };
  }
  
  // PRIORIDAD 2: Si no hay documento DIAN pero la venta SÍ requería factura electrónica,
  // está pendiente de creación/envío (en cola)
  // También si no hay venta asociada o requireElectronicInvoice es undefined/null (asumimos true por defecto)
  if (!inv.dianDocument) {
    return {
      label: 'En cola DIAN',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      title: 'Pendiente de envío a DIAN',
    };
  }
  
  // PRIORIDAD 3: Si hay documento DIAN, mostrar estado según DIAN
  const dianStatus = inv.dianDocument.status;
  if (dianStatus === 'DRAFT') {
    return { label: 'En cola DIAN', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
  }
  if (dianStatus === 'REJECTED') {
    const err = inv.dianDocument.lastError ?? '';
    return {
      label: 'Rechazada por DIAN',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      title: err ? `DIAN: ${err}` : undefined,
    };
  }
  if (dianStatus === 'SENT') {
    return { label: 'Enviada a DIAN', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
  }
  if (dianStatus === 'ACCEPTED') {
    return { label: 'Emitida', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
  }
  // Por defecto, si tiene documento DIAN pero estado desconocido
  return { label: 'Emitida', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
}

type StatusFilter = 'all' | InvoiceStatus;

function getStatusFromUrl(searchParams: URLSearchParams): StatusFilter {
  const status = searchParams.get('status');
  if (status && ['DRAFT', 'ISSUED', 'VOIDED'].includes(status)) {
    return status as InvoiceStatus;
  }
  return 'all';
}

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const statusFilter = getStatusFromUrl(searchParams);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const setStatusAndUrl = useCallback(
    (status: StatusFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (status === 'all') {
        params.delete('status');
      } else {
        params.set('status', status);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [invoiceToVoid, setInvoiceToVoid] = useState<InvoiceListItem | null>(null);
  const voidMutation = useVoidInvoice();
  const retryDianMutation = useRetryPendingDianDocuments();

  const limit = 20;
  const listParams = useMemo(
    () => ({
      page,
      limit,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined,
    }),
    [page, limit, statusFilter, search],
  );
  const query = useInvoicesList(listParams);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleVoidConfirm = () => {
    if (!invoiceToVoid) return;
    voidMutation.mutate(invoiceToVoid.id, {
      onSuccess: () => {
        toast.success('Factura anulada');
        setInvoiceToVoid(null);
      },
      onError: (e: { message?: string }) => {
        toast.error(e?.message ?? 'No se pudo anular la factura');
      },
    });
  };

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-2 pb-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0 rounded-lg">
            <Link href="/app">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver al inicio</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <FileText className="h-7 w-7 shrink-0 text-primary" />
              Facturas
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Facturas generadas por ventas. Consulta número, cliente, total y estado.
            </p>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número o cliente..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'ISSUED', 'DRAFT', 'VOIDED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusAndUrl(s)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 ml-auto shrink-0"
              onClick={() => {
                retryDianMutation.mutate(undefined, {
                  onSuccess: (res) => {
                    toast.success(res.enqueued > 0 ? `Se encolaron ${res.enqueued} documento(s) para reenvío a DIAN.` : res.message);
                  },
                  onError: (e: { message?: string }) => {
                    toast.error(e?.message ?? 'Error al reintentar envíos DIAN');
                  },
                });
              }}
              disabled={retryDianMutation.isPending}
            >
              <RotateCw className={`h-4 w-4 ${retryDianMutation.isPending ? 'animate-spin' : ''}`} />
              Reintentar envíos DIAN pendientes
            </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm shadow-black/[0.03] dark:shadow-none overflow-x-auto">
          {query.isLoading ? (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-32 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No hay facturas que coincidan con los filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.number}</TableCell>
                        <TableCell>{formatDate(inv.issuedAt)}</TableCell>
                        <TableCell>{inv.customer?.name ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(inv.grandTotal)}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const { label, className, title } = getInvoiceDisplayStatus(inv);
                            return (
                              <span
                                title={title}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
                              >
                                {label}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inv.sale?.id && (
                              <Link
                                href={`/sales/${inv.sale.id}`}
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                Ver venta
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            {inv.status === 'ISSUED' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setInvoiceToVoid(inv)}
                                disabled={voidMutation.isPending}
                                title="Anular factura"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Anular
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}

          {meta && meta.totalPages > 1 && (
            <Pagination meta={meta} onPageChange={setPage} label="Facturas" />
          )}
      </div>

      <Dialog open={!!invoiceToVoid} onOpenChange={(open) => !open && setInvoiceToVoid(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular factura</DialogTitle>
            <DialogDescription>
              ¿Anular la factura {invoiceToVoid?.number}? Se actualizará el estado a Anulada, la venta
              asociada se cancelará, se devolverá el stock al inventario y se registrará el movimiento
              de caja de reversión. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceToVoid(null)} disabled={voidMutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoidConfirm}
              disabled={voidMutation.isPending}
            >
              {voidMutation.isPending ? 'Anulando…' : 'Anular factura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
