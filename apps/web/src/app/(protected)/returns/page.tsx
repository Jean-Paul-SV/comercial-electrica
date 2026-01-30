'use client';

import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
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
import { formatMoney, formatDateTime } from '@shared/utils/format';
import { RotateCcw, Plus } from 'lucide-react';
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

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Devoluciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Devoluciones de ventas
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <RotateCcw className="h-5 w-5 shrink-0" />
                Listado
              </CardTitle>
              <CardDescription>
                Devoluciones registradas
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNew(true)}
              className="gap-2 w-full sm:w-fit"
            >
              <Plus className="h-4 w-4" />
              Nueva devolución
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Pagination meta={meta} onPageChange={setPage} label="Página" />

          {query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venta / Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-4">
              {(query.error as { message?: string })?.message ?? 'Error al cargar devoluciones'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venta / Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {formatDateTime(r.returnedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.sale?.customer?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(r.grandTotal)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {r.reason ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay devoluciones.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent showClose className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Nueva devolución
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Venta</Label>
              <select
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
                className={selectClassName}
              >
                <option value="">Selecciona una venta</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDateTime(s.soldAt)} — {s.customer?.name ?? 'Sin cliente'} — {formatMoney(s.grandTotal)}
                  </option>
                ))}
              </select>
            </div>

            {selectedSale?.items && selectedSale.items.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Productos a devolver</Label>
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
                  <Label>Motivo (opcional)</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej. Producto defectuoso, cliente no conforme"
                    className="rounded-lg"
                  />
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
