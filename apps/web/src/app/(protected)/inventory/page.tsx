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
import { formatDateTime } from '@shared/utils/format';
import { Boxes, Plus, Trash2 } from 'lucide-react';
import { useMovementsList, useCreateMovement } from '@features/inventory/hooks';
import { useProductsList } from '@features/products/hooks';
import { useSuppliersList } from '@features/suppliers/hooks';
import type { MovementType } from '@features/inventory/types';

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

const TYPE_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  ADJUST: 'Ajuste',
};

type MovementLine = { productId: string; qty: number; unitCost?: number };

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [type, setType] = useState<MovementType>('IN');
  const [reason, setReason] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<MovementLine[]>([]);

  const limit = 20;
  const query = useMovementsList({ page, limit });
  const createMutation = useCreateMovement();
  const productsQuery = useProductsList({ page: 1, limit: 100 });
  const suppliersQuery = useSuppliersList({ page: 1, limit: 100 });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;
  const products = useMemo(() => (productsQuery.data?.data ?? []).filter((p) => p.isActive !== false), [productsQuery.data]);
  const suppliers = useMemo(() => suppliersQuery.data?.data ?? [], [suppliersQuery.data]);

  const addLine = () => setLines((prev) => [...prev, { productId: '', qty: 1 }]);
  const updateLine = (index: number, field: keyof MovementLine, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      (next[index] as Record<string, unknown>)[field] = value;
      return next;
    });
  };
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const resetForm = () => {
    setType('IN');
    setReason('');
    setSupplierId('');
    setLines([]);
  };

  const submitNew = () => {
    if (lines.length === 0 || lines.some((l) => !l.productId || l.qty < 1)) {
      toast.error('Agrega al menos un producto con cantidad');
      return;
    }
    const items = lines
      .filter((l) => l.productId && l.qty >= 1)
      .map((l) => ({
        productId: l.productId,
        qty: l.qty,
        ...(l.unitCost != null && l.unitCost > 0 ? { unitCost: l.unitCost } : {}),
      }));
    createMutation.mutate(
      {
        type,
        reason: reason.trim() || undefined,
        supplierId: type === 'IN' && supplierId ? supplierId : undefined,
        items,
      },
      {
        onSuccess: () => {
          toast.success('Movimiento registrado');
          setOpenNew(false);
          resetForm();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo registrar el movimiento');
        },
      }
    );
  };

  const canSubmit =
    lines.length > 0 && !lines.some((l) => !l.productId || l.qty < 1);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Inventario
        </h1>
        <p className="text-sm text-muted-foreground">
          Movimientos de inventario
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Boxes className="h-5 w-5 shrink-0" />
                Movimientos
              </CardTitle>
              <CardDescription>
                Listado de movimientos paginado
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNew(true)}
              className="gap-2 w-full sm:w-fit"
            >
              <Plus className="h-4 w-4" />
              Nuevo movimiento
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
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-4">
              {(query.error as { message?: string })?.message ??
                'Error al cargar movimientos'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {TYPE_LABELS[m.type] ?? m.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.reason ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {m.items?.length ?? 0} ítem(s)
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay movimientos.
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
              <Boxes className="h-4 w-4" />
              Nuevo movimiento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MovementType)}
                  className={selectClassName}
                >
                  <option value="IN">Entrada</option>
                  <option value="OUT">Salida</option>
                  <option value="ADJUST">Ajuste</option>
                </select>
              </div>
              {type === 'IN' && (
                <div className="space-y-2">
                  <Label>Proveedor (opcional)</Label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className={selectClassName}
                  >
                    <option value="">Sin proveedor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>Motivo (opcional)</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. Ajuste por conteo"
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
                      onChange={(e) => updateLine(i, 'productId', e.target.value)}
                      className={`${selectClassName} flex-1 h-9`}
                    >
                      <option value="">Producto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
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
                    {type === 'IN' && (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Costo"
                        value={line.unitCost ?? ''}
                        onChange={(e) => updateLine(i, 'unitCost', e.target.value ? Number(e.target.value) : 0)}
                        className="w-24 h-9 rounded-md"
                      />
                    )}
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
              {createMutation.isPending ? 'Guardando…' : 'Registrar movimiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
