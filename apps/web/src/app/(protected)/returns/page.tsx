'use client';

import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/components/ui/dialog';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Pagination } from '@shared/components/Pagination';
import { EmptyState } from '@shared/components/EmptyState';
import Link from 'next/link';
import { formatMoney, formatDateTime } from '@shared/utils/format';
import { RotateCcw, Plus, Search } from 'lucide-react';
import { useReturnsList, useCreateReturn } from '@features/returns/hooks';
import { useSalesList } from '@features/sales/hooks';

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

type SaleWithItems = {
  id: string;
  soldAt: string;
  grandTotal: number | string;
  customer?: { id: string; name: string } | null;
  items?: Array<{
    id: string;
    productId: string;
    qty: number;
    unitPrice: number | string;
    product?: { name: string };
  }>;
};

export default function ReturnsPage() {
  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [saleId, setSaleId] = useState('');
  const [saleSearch, setSaleSearch] = useState('');
  const [reason, setReason] = useState('');
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});

  const limit = 20;
  const query = useReturnsList({ page, limit });
  const createMutation = useCreateReturn();
  const salesQuery = useSalesList({ page: 1, limit: 100 });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;
  const sales = useMemo(() => (salesQuery.data?.data ?? []) as SaleWithItems[], [salesQuery.data]);

  const selectedSale = useMemo(
    () => (saleId ? sales.find((s) => s.id === saleId) : null),
    [saleId, sales]
  );

  const filteredSales = useMemo(() => {
    if (!saleSearch.trim()) return sales;
    const q = saleSearch.trim().toLowerCase();
    const matches = sales.filter(
      (s) =>
        (s.customer?.name ?? '').toLowerCase().includes(q) ||
        formatDateTime(s.soldAt).toLowerCase().includes(q) ||
        formatMoney(s.grandTotal).toLowerCase().includes(q)
    );
    const selected = saleId ? sales.find((s) => s.id === saleId) : null;
    if (selected && !matches.some((s) => s.id === selected.id)) {
      return [selected, ...matches];
    }
    return matches;
  }, [sales, saleSearch, saleId]);

  useEffect(() => {
    if (openNew) salesQuery.refetch();
  }, [openNew]);

  useEffect(() => {
    if (selectedSale?.items) {
      const next: Record<string, number> = {};
      selectedSale.items.forEach((it) => {
        next[it.productId] = 0;
      });
      setReturnQty(next);
    } else {
      setReturnQty({});
    }
  }, [selectedSale?.id]);

  const resetForm = () => {
    setSaleId('');
    setSaleSearch('');
    setReason('');
    setReturnQty({});
  };

  const setQty = (productId: string, qty: number) => {
    setReturnQty((prev) => ({ ...prev, [productId]: Math.max(0, qty) }));
  };

  const submitNew = () => {
    if (!saleId || !selectedSale) {
      toast.error('Selecciona una venta');
      return;
    }
    const items =
      selectedSale.items
        ?.map((it) => ({
          productId: it.productId,
          qty: Math.min(returnQty[it.productId] ?? 0, it.qty),
        }))
        .filter((i) => i.qty > 0) ?? [];
    if (items.length === 0) {
      toast.error('Indica al menos una cantidad a devolver');
      return;
    }
    createMutation.mutate(
      {
        saleId,
        reason: reason.trim() || undefined,
        items,
      },
      {
        onSuccess: () => {
          toast.success('Devolución registrada');
          setOpenNew(false);
          resetForm();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo registrar la devolución');
        },
      }
    );
  };

  const canSubmit =
    Boolean(saleId && selectedSale) &&
    selectedSale?.items?.some((it) => (returnQty[it.productId] ?? 0) > 0);

  const totalReturns = meta?.total ?? 0;
  const hasData = rows.length > 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-2 pb-2">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <RotateCcw className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Devoluciones
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            {hasData
              ? `${totalReturns} devolución${totalReturns !== 1 ? 'es' : ''} registrada${totalReturns !== 1 ? 's' : ''}`
              : 'Devoluciones de ventas'}
          </p>
        </div>
        <Button
          size="default"
          onClick={() => setOpenNew(true)}
          className="gap-2 shrink-0 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Nueva devolución
        </Button>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm shadow-black/[0.03] dark:shadow-none overflow-x-auto">
          {query.isLoading && (
            <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-muted-foreground">Venta / Fecha</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32 rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-8 px-6">
              {(query.error as { message?: string })?.message ?? 'Error al cargar devoluciones'}
            </p>
          )}

          {!query.isLoading && !query.isError && (
            <>
              <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="font-medium text-muted-foreground">Venta / Fecha</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.id}
                        className="transition-colors hover:bg-muted/40"
                      >
                        <TableCell className="font-medium text-foreground">
                          <Link
                            href={`/returns/${r.id}`}
                            className="text-primary hover:underline"
                          >
                            {formatDateTime(r.returnedAt)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.sale?.customer?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-foreground">
                          {formatMoney(r.grandTotal)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {r.reason ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={4} className="p-0 align-top">
                          <EmptyState
                            message="No hay devoluciones"
                            description="Registra una devolución desde una venta existente para llevar el control."
                            icon={RotateCcw}
                            action={
                              <Button
                                size="sm"
                                onClick={() => setOpenNew(true)}
                                className="gap-2"
                              >
                                <Plus className="h-4 w-4" />
                                Nueva devolución
                              </Button>
                            }
                            className="py-16"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              {meta && (meta.total > 0 || meta.totalPages > 1) && (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {meta.total > 0
                      ? `Mostrando ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}`
                      : '0 resultados'}
                  </p>
                  <Pagination meta={meta} onPageChange={setPage} label="Página" />
                </div>
              )}
            </>
          )}
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent showClose className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Nueva devolución
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Elige la venta a la que corresponde la devolución, indica qué productos y cantidades se devuelven y, si quieres, un motivo.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="return-sale">Venta</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Buscar por cliente, fecha o total..."
                  value={saleSearch ?? ''}
                  onChange={(e) => setSaleSearch(e.target.value)}
                  autoComplete="off"
                  className="pl-9 rounded-lg mb-2"
                />
              </div>
              <select
                id="return-sale"
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
                className={selectClassName}
              >
                <option value="">Selecciona una venta (fecha, cliente, total)</option>
                {filteredSales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDateTime(s.soldAt)} — {s.customer?.name ?? 'Sin cliente'} — {formatMoney(s.grandTotal)}
                  </option>
                ))}
              </select>
              {filteredSales.length === 0 && sales.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay ventas que coincidan con la búsqueda. Prueba con otro texto.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Filtra arriba por cliente, fecha o total. Luego indica las cantidades a devolver por producto.
              </p>
              {selectedSale && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-medium">Venta seleccionada:</span>{' '}
                  {selectedSale.customer?.name ?? 'Sin cliente'} · {formatDateTime(selectedSale.soldAt)} · Total {formatMoney(selectedSale.grandTotal)}
                </div>
              )}
            </div>

            {selectedSale?.items && selectedSale.items.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Productos a devolver</Label>
                  <p className="text-xs text-muted-foreground">
                    Indica cuántas unidades de cada producto se devuelven. No puede superar la cantidad vendida.
                  </p>
                  <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-auto">
                    <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
                      <span>Producto</span>
                      <span className="text-center">Vendido</span>
                      <span className="text-center">Devolver</span>
                    </div>
                    {selectedSale.items.map((it) => (
                      <div
                        key={it.id}
                        className="grid grid-cols-[1fr_80px_80px] gap-2 items-center px-2 py-2 text-sm"
                      >
                        <span className="truncate">{it.product?.name ?? it.productId}</span>
                        <span className="text-center tabular-nums">{it.qty}</span>
                        <Input
                          type="number"
                          min={0}
                          max={it.qty}
                          value={returnQty[it.productId] ?? 0}
                          onChange={(e) => setQty(it.productId, Number(e.target.value) || 0)}
                          className="h-9 rounded-md text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="return-reason">Motivo (opcional)</Label>
                  <Input
                    id="return-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej. Producto defectuoso, cliente no conforme"
                    className="rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sirve para trazabilidad. Ej.: producto defectuoso, cambio de opinión del cliente.
                  </p>
                </div>
              </>
            )}

            {saleId && (!selectedSale?.items || selectedSale.items.length === 0) && (
              <p className="text-sm text-muted-foreground">
                Cargando ítems de la venta…
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpenNew(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitNew}
              disabled={createMutation.isPending || !canSubmit}
            >
              {createMutation.isPending ? 'Guardando…' : 'Registrar devolución'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
