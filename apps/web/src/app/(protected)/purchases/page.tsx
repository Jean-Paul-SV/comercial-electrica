'use client';

import { useMemo, useState } from 'react';
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
import { formatMoney } from '@shared/utils/format';
import { formatDate } from '@shared/utils/format';
import { ShoppingBag, Plus, Trash2 } from 'lucide-react';
import { usePurchasesList, useCreatePurchaseOrder } from '@features/purchases/hooks';
import { useSuppliersList } from '@features/suppliers/hooks';
import { useProductsList } from '@features/products/hooks';

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviado',
  RECEIVED: 'Recibido',
  PARTIALLY_RECEIVED: 'Parcial',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

type OrderLine = { productId: string; qty: number; unitCost: number };

export default function PurchasesPage() {
  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([]);

  const limit = 20;
  const query = usePurchasesList({ page, limit });
  const createMutation = useCreatePurchaseOrder();
  const suppliersQuery = useSuppliersList({ page: 1, limit: 100 });
  const productsQuery = useProductsList({ page: 1, limit: 100 });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;
  const suppliers = useMemo(() => suppliersQuery.data?.data ?? [], [suppliersQuery.data]);
  const products = useMemo(() => (productsQuery.data?.data ?? []).filter((p) => p.isActive !== false), [productsQuery.data]);

  const addLine = () => setLines((prev) => [...prev, { productId: '', qty: 1, unitCost: 0 }]);
  const updateLine = (index: number, field: keyof OrderLine, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      (next[index] as Record<string, unknown>)[field] = field === 'qty' || field === 'unitCost' ? Number(value) || 0 : value;
      return next;
    });
  };
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const getProductCost = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    return p ? Number(p.cost) : 0;
  };

  const resetForm = () => {
    setSupplierId('');
    setExpectedDate('');
    setNotes('');
    setLines([]);
  };

  const submitNew = () => {
    if (!supplierId) {
      toast.error('Selecciona un proveedor');
      return;
    }
    if (lines.length === 0 || lines.some((l) => !l.productId || l.qty < 1 || l.unitCost < 0)) {
      toast.error('Agrega al menos un producto con cantidad y costo');
      return;
    }
    const items = lines
      .filter((l) => l.productId && l.qty >= 1)
      .map((l) => ({
        productId: l.productId,
        qty: l.qty,
        unitCost: l.unitCost > 0 ? l.unitCost : getProductCost(l.productId) || 0,
      }));
    createMutation.mutate(
      {
        supplierId,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
        items,
      },
      {
        onSuccess: () => {
          toast.success('Pedido creado');
          setOpenNew(false);
          resetForm();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear el pedido');
        },
      }
    );
  };

  const canSubmit =
    Boolean(supplierId) &&
    lines.length > 0 &&
    !lines.some((l) => !l.productId || l.qty < 1);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Compras
        </h1>
        <p className="text-sm text-muted-foreground">
          Pedidos de compra
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 shrink-0" />
                Pedidos
              </CardTitle>
              <CardDescription>
                Listado de pedidos de compra paginado
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNew(true)}
              className="gap-2 w-full sm:w-fit"
            >
              <Plus className="h-4 w-4" />
              Nuevo pedido
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
                    <TableHead>Nº pedido</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-4">
              {(query.error as { message?: string })?.message ??
                'Error al cargar pedidos'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº pedido</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-muted-foreground text-sm">
                        {p.orderNumber}
                      </TableCell>
                      <TableCell>{p.supplier?.name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(p.orderDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(p.grandTotal)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay pedidos de compra.
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
        <DialogContent showClose className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Nuevo pedido de compra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className={selectClassName}
                  required
                >
                  <option value="">Selecciona proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Fecha esperada (opcional)</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notas (opcional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas del pedido"
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Líneas</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Agregar línea
                </Button>
              </div>
              <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-auto">
                {lines.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">Agrega al menos un producto.</p>
                )}
                {lines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 text-sm">
                    <select
                      value={line.productId}
                      onChange={(e) => {
                        const id = e.target.value;
                        updateLine(i, 'productId', id);
                        if (!line.unitCost || line.unitCost === 0) updateLine(i, 'unitCost', getProductCost(id));
                      }}
                      className={`${selectClassName} flex-1 h-9`}
                    >
                      <option value="">Producto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatMoney(p.cost)}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) => updateLine(i, 'qty', Number(e.target.value) || 1)}
                      className="w-20 h-9 rounded-md text-center"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Costo"
                      value={line.unitCost || ''}
                      onChange={(e) => updateLine(i, 'unitCost', Number(e.target.value) || 0)}
                      className="w-24 h-9 rounded-md"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLine(i)}
                      aria-label="Quitar línea"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpenNew(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={submitNew} disabled={createMutation.isPending || !canSubmit}>
              {createMutation.isPending ? 'Guardando…' : 'Crear pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
