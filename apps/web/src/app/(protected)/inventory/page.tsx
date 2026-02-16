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
import { formatDateTime, formatMoney } from '@shared/utils/format';
import { Boxes, Plus, Trash2, ChevronUp, ChevronDown, Search, Layers, DollarSign, AlertTriangle } from 'lucide-react';
import { useMovementsList, useCreateMovement, useInventoryTotalValue } from '@features/inventory/hooks';
import { useProductsList } from '@features/products/hooks';
import { useSuppliersList } from '@features/suppliers/hooks';
import { useLowStockThreshold } from '@shared/hooks/useLowStockThreshold';
import type { MovementType } from '@features/inventory/types';

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

const TYPE_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  ADJUST: 'Ajuste',
};

type MovementLine = { productId: string; qty: number; unitCost?: number };

const numberFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatNumberEs(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return numberFormatter.format(value);
}

function parseNumberEs(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = Number(normalized);
  return Number.isNaN(n) ? undefined : n;
}

/** Tarjeta de stock actual por producto (código, nombre, categoría, cantidad). */
function StockActualCard() {
  const [stockPage, setStockPage] = useState(1);
  const [stockSearch, setStockSearch] = useState('');
  const [stockSort, setStockSort] = useState<'asc' | 'desc' | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useLowStockThreshold();
  const [thresholdInput, setThresholdInput] = useState<string>('');
  const limit = 20;
  const stockParams = useMemo(
    () => ({
      page: stockPage,
      limit,
      search: stockSearch.trim() || undefined,
      sortByStock: stockSort ?? undefined,
    }),
    [stockPage, limit, stockSearch, stockSort]
  );
  const stockQuery = useProductsList(stockParams);
  const stockRows = useMemo(() => stockQuery.data?.data ?? [], [stockQuery.data]);
  const stockMeta = stockQuery.data?.meta;
  const totalValueQuery = useInventoryTotalValue();
  const totalValueAll = totalValueQuery.data?.totalValue ?? 0;

  useEffect(() => {
    setStockPage(1);
  }, [stockSearch, stockSort]);

  return (
    <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/60">
        <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
          <Layers className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          Stock actual
        </CardTitle>
        <CardDescription>
          Cantidad en mano por producto. Para modificar stock, registra un movimiento (entrada, salida o ajuste) más abajo.
        </CardDescription>
        {!stockQuery.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <DollarSign className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Valor total del inventario</p>
                <p className="text-lg font-semibold tabular-nums text-foreground mt-0.5">
                  {totalValueQuery.isLoading || totalValueQuery.isFetching ? '…' : formatMoney(totalValueAll)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Suma de (stock × costo) de todos los productos</p>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Label htmlFor="low-stock-threshold" className="text-xs font-medium text-muted-foreground">
                  Stock mínimo por defecto
                </Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="low-stock-threshold"
                    type="number"
                    min={0}
                    value={thresholdInput !== '' ? thresholdInput : String(lowStockThreshold)}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    onBlur={() => {
                      const n = parseInt(thresholdInput, 10);
                      if (!Number.isNaN(n) && n >= 0) {
                        setLowStockThreshold(n);
                        setThresholdInput('');
                      } else {
                        setThresholdInput('');
                      }
                    }}
                    className="h-9 w-20 tabular-nums rounded-lg"
                  />
                  <span className="text-xs text-muted-foreground">unidades</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Se usa cuando el producto no tiene stock mínimo propio. Stock ≤ mínimo se considera en alerta.</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3 pt-4 mt-2 border-t border-border/60">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <Label htmlFor="search-stock" className="text-xs font-medium text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="search-stock"
                type="search"
                placeholder="Nombre o código del producto"
                value={stockSearch}
                onChange={(e) => {
                  setStockSearch(e.target.value);
                  setStockPage(1);
                }}
                className="h-9 rounded-lg pl-8 text-sm flex-1 min-w-0"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Ordenar por stock</Label>
            <div className="flex items-center gap-1 border border-input rounded-lg p-0.5 bg-background">
              <button
                type="button"
                onClick={() => {
                  if (stockSort === 'desc') setStockSort(null);
                  else setStockSort('desc');
                  setStockPage(1);
                }}
                className={`h-8 px-2.5 flex items-center gap-1 rounded-md text-xs font-medium transition-colors ${
                  stockSort === 'desc' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
                title="Mayor a menor"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                Mayor
              </button>
              <button
                type="button"
                onClick={() => {
                  if (stockSort === 'asc') setStockSort(null);
                  else setStockSort('asc');
                  setStockPage(1);
                }}
                className={`h-8 px-2.5 flex items-center gap-1 rounded-md text-xs font-medium transition-colors ${
                  stockSort === 'asc' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
                title="Menor a mayor"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Menor
              </button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStockSearch('');
              setStockSort(null);
              setStockPage(1);
            }}
            className="h-9 text-xs rounded-lg"
          >
            Limpiar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Pagination meta={stockMeta} onPageChange={setStockPage} label="Página" />
        </div>
        {stockQuery.isLoading && (
          <div className="rounded-lg border border-border/80 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/80">
                  <TableHead className="font-medium text-muted-foreground">Código</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Nombre</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Categoría</TableHead>
                  <TableHead className="font-medium text-right text-muted-foreground">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto rounded" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {stockQuery.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive font-medium">
              {(stockQuery.error as { message?: string })?.message ?? 'Error al cargar stock'}
            </p>
          </div>
        )}
        {!stockQuery.isLoading && !stockQuery.isError && (
          <div className="rounded-lg border border-border/80 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/80">
                  <TableHead className="font-medium text-muted-foreground">Código</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Nombre</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Categoría</TableHead>
                  <TableHead className="font-medium text-right text-muted-foreground">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockRows.map((p) => (
                  <TableRow key={p.id} className="transition-colors hover:bg-muted/40">
                    <TableCell className="font-mono text-sm text-muted-foreground">{p.internalCode}</TableCell>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.category?.name ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-foreground">
                      {p.stock?.qtyOnHand ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
                {stockRows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">
                      No hay productos. Crea productos en Catálogo → Productos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [type, setType] = useState<MovementType>('IN');
  const [reason, setReason] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<MovementLine[]>([]);
  const [openAddMultiple, setOpenAddMultiple] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [addMultipleSearch, setAddMultipleSearch] = useState('');
  const [lineProductSearch, setLineProductSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const limit = 20;
  const query = useMovementsList({
    page,
    limit,
    search: searchTerm.trim() || undefined,
    sortOrder: sortOrder ?? undefined,
  });
  const createMutation = useCreateMovement();
  const productsQuery = useProductsList({ page: 1, limit: 100 });
  const suppliersQuery = useSuppliersList({ page: 1, limit: 100, isActive: true });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;
  const products = useMemo(() => (productsQuery.data?.data ?? []).filter((p) => p.isActive !== false), [productsQuery.data]);
  const suppliers = useMemo(() => suppliersQuery.data?.data ?? [], [suppliersQuery.data]);
  const productsFilteredForLines = useMemo(() => {
    const term = lineProductSearch.trim().toLowerCase();
    if (!term) return products;
    const filtered = products.filter(
      (p) =>
        (p.name ?? '').toLowerCase().includes(term) ||
        (p.internalCode ?? '').toLowerCase().includes(term),
    );
    return [...filtered].sort((a, b) => {
      const nameA = (a.name ?? '').toLowerCase();
      const nameB = (b.name ?? '').toLowerCase();
      const codeA = (a.internalCode ?? '').toLowerCase();
      const codeB = (b.internalCode ?? '').toLowerCase();
      const score = (name: string, code: string) => {
        if (name === term || code === term) return 0;
        if (name.startsWith(term) || code.startsWith(term)) return 1;
        if (name.includes(term) || code.includes(term)) return 2;
        return 3;
      };
      return score(nameA, codeA) - score(nameB, codeB);
    });
  }, [products, lineProductSearch]);

  const addLine = () => setLines((prev) => [...prev, { productId: '', qty: 1 }]);
  const addLineWithProduct = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    const unitCost = type === 'IN' && p ? Number(p.cost) || undefined : undefined;
    setLines((prev) => [...prev, { productId, qty: 1, unitCost }]);
    setLineProductSearch('');
  };
  const updateLine = (index: number, field: keyof MovementLine, value: string | number | undefined) => {
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
    setOpenAddMultiple(false);
    setSelectedProductIds(new Set());
    setAddMultipleSearch('');
    setLineProductSearch('');
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmAddMultiple = () => {
    if (selectedProductIds.size === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }
    const existingIds = new Set(lines.map((l) => l.productId));
    const toAdd = [...selectedProductIds].filter((id) => !existingIds.has(id));
    if (toAdd.length === 0) {
      toast.info('Esos productos ya están en las líneas');
      setOpenAddMultiple(false);
      setSelectedProductIds(new Set());
      setAddMultipleSearch('');
      return;
    }
    const costByProduct = Object.fromEntries(products.map((p) => [p.id, Number(p.cost)]));
    const newLines: MovementLine[] = toAdd.map((productId) => ({
      productId,
      qty: 1,
      ...(type === 'IN' && costByProduct[productId] ? { unitCost: costByProduct[productId] } : {}),
    }));
    setLines((prev) => [...prev, ...newLines]);
    setOpenAddMultiple(false);
    setSelectedProductIds(new Set());
    setAddMultipleSearch('');
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <Layers className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            Inventario
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stock actual por producto y movimientos (entradas, salidas, ajustes)
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setOpenNew(true)}
          className="gap-2 rounded-xl font-medium shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

      <StockActualCard />

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
                <Boxes className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                Movimientos
              </CardTitle>
              <CardDescription>
                {meta ? `${meta.total} movimiento${meta.total !== 1 ? 's' : ''}` : 'Listado paginado'} · Entradas, salidas y ajustes
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 pt-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px] max-w-sm">
              <Label htmlFor="search-movement" className="text-xs font-medium text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="search-movement"
                  type="search"
                  placeholder="Nombre o código del producto"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-lg pl-8 text-sm flex-1 min-w-0"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Ordenar por fecha</Label>
              <div className="flex items-center gap-1 border border-input rounded-lg p-0.5 bg-background">
                <button
                  type="button"
                  onClick={() => {
                    if (sortOrder === 'desc') setSortOrder(null);
                    else setSortOrder('desc');
                    setPage(1);
                  }}
                  className={`h-8 px-2.5 flex items-center gap-1 rounded-md text-xs font-medium transition-colors ${
                    sortOrder === 'desc' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                  }`}
                  title="Más reciente primero"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Mayor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sortOrder === 'asc') setSortOrder(null);
                    else setSortOrder('asc');
                    setPage(1);
                  }}
                  className={`h-8 px-2.5 flex items-center gap-1 rounded-md text-xs font-medium transition-colors ${
                    sortOrder === 'asc' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                  }`}
                  title="Más antiguo primero"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Menor
                </button>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setSortOrder(null);
                setPage(1);
              }}
              disabled={!searchTerm.trim() && sortOrder === null}
              className="h-9 rounded-lg"
              aria-label="Limpiar filtros"
            >
              Limpiar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pagination meta={meta} onPageChange={setPage} label="Página" />
          </div>

          {query.isLoading && (
            <div className="rounded-lg border border-border/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Tipo</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Motivo</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Proveedor</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Productos</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive font-medium">
                {(query.error as { message?: string })?.message ?? 'Error al cargar movimientos'}
              </p>
            </div>
          )}

          {!query.isLoading && !query.isError && (
            <div className="rounded-lg border border-border/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Tipo</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Motivo</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Proveedor</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Productos</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => (
                    <TableRow key={m.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground">
                          {TYPE_LABELS[m.type] ?? m.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.reason ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.supplier?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top">
                        <div className="flex flex-col gap-0.5 max-h-24 overflow-y-auto">
                          {m.items?.length ? (
                            m.items.map((it) => (
                              <span key={it.id} className="text-sm">
                                {it.product?.name ?? it.productId}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top tabular-nums">
                        <div className="flex flex-col gap-0.5 max-h-24 overflow-y-auto">
                          {m.items?.length ? (
                            m.items.map((it) => (
                              <span key={it.id} className="text-sm">
                                {it.qty}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
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
                <p className="text-xs text-muted-foreground">
                  {type === 'IN' && 'Ingreso de stock (ej. compra a proveedor, devolución).'}
                  {type === 'OUT' && 'Egreso de stock (ej. venta, merma, uso interno).'}
                  {type === 'ADJUST' && 'Corrección por conteo o inventario físico.'}
                </p>
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
                  <p className="text-xs text-muted-foreground">
                    Indica el proveedor si este ingreso viene de una compra.
                  </p>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>Motivo (opcional)</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. Ajuste por conteo, Recepción pedido PO-001"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Descripción breve para trazabilidad (conteo, pedido, devolución, etc.).
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <Label>Líneas</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Productos y cantidades que {type === 'IN' ? 'entran' : type === 'OUT' ? 'salen' : 'ajustas'}. En entradas puedes indicar costo unitario.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1 shrink-0">
                    <Plus className="h-3 w-3" />
                    Agregar línea
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpenAddMultiple(true)} className="gap-1 shrink-0">
                    <Layers className="h-3 w-3" />
                    Agregar varios
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Buscar producto por nombre o código..."
                    value={lineProductSearch}
                    onChange={(e) => setLineProductSearch(e.target.value)}
                    className="pl-9 h-9 rounded-lg"
                    autoComplete="off"
                  />
                </div>
                {lineProductSearch.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Buscando «<span className="font-medium text-foreground">{lineProductSearch.trim()}</span>» — {productsFilteredForLines.length} resultado{productsFilteredForLines.length !== 1 ? 's' : ''} (ordenados por lo más parecido)
                  </p>
                )}
                {lineProductSearch.trim() && (
                  <div className="rounded-lg border border-input bg-background shadow-sm overflow-hidden max-h-52 overflow-y-auto">
                    {productsFilteredForLines.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        {products.length === 0 ? 'No hay productos disponibles.' : `Ningún producto coincide con «${lineProductSearch.trim()}». Prueba con otra palabra o código.`}
                      </p>
                    ) : (
                      <ul className="py-1">
                          {productsFilteredForLines.map((p) => {
                            const stockQty = p.stock?.qtyOnHand ?? 0;
                            const alreadyInLines = lines.some((l) => l.productId === p.id);
                            const term = lineProductSearch.trim().toLowerCase();
                            const name = p.name ?? '';
                            const highlightName = term
                              ? (() => {
                                  const i = name.toLowerCase().indexOf(term);
                                  if (i === -1) return name;
                                  return (
                                    <>
                                      {name.slice(0, i)}
                                      <mark className="bg-primary/20 text-primary font-medium rounded px-0.5">{name.slice(i, i + term.length)}</mark>
                                      {name.slice(i + term.length)}
                                    </>
                                  );
                                })()
                              : name;
                            return (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  onClick={() => !alreadyInLines && addLineWithProduct(p.id)}
                                  disabled={alreadyInLines}
                                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                                    alreadyInLines
                                      ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                                      : 'hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary'
                                  }`}
                                >
                                  <span className="font-medium truncate">{highlightName}</span>
                                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                    Stock: {stockQty}
                                    {type === 'IN' && p.cost != null && ` · $${Number(p.cost).toFixed(2)}`}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-auto">
                {lines.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">Agrega al menos un producto con cantidad.</p>
                )}
                {lines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 text-sm">
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(i, 'productId', e.target.value)}
                      className={`${selectClassName} flex-1 h-9`}
                    >
                      <option value="">Producto</option>
                      {productsFilteredForLines.map((p) => {
                        const stockQty = p.stock?.qtyOnHand ?? 0;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {stockQty})
                          </option>
                        );
                      })}
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
                        type="text"
                        inputMode="decimal"
                        placeholder="Costo"
                        value={formatNumberEs(line.unitCost)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = parseNumberEs(raw);
                          updateLine(i, 'unitCost', parsed);
                        }}
                        className="w-28 h-9 rounded-md tabular-nums"
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

      {/* Modal Agregar varios productos */}
      <Dialog open={openAddMultiple} onOpenChange={setOpenAddMultiple}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Agregar varios productos
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Marca los productos que quieras agregar al movimiento. Se añadirán con cantidad 1{type === 'IN' ? ' y costo del catálogo' : ''}.
            </p>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar por nombre o código..."
              value={addMultipleSearch}
              onChange={(e) => setAddMultipleSearch(e.target.value)}
              className="pl-9 rounded-lg mb-2"
              autoComplete="off"
            />
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            {(() => {
              const term = addMultipleSearch.trim().toLowerCase();
              const filtered = term
                ? products.filter(
                    (p) =>
                      p.name.toLowerCase().includes(term) ||
                      (p.internalCode && p.internalCode.toLowerCase().includes(term)),
                  )
                : products;
              if (filtered.length === 0) {
                return (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    {products.length === 0 ? 'No hay productos disponibles.' : 'Ningún producto coincide con la búsqueda.'}
                  </p>
                );
              }
              return (
                <>
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border sticky top-0 bg-background">
                    <span className="w-4" />
                    <span>Producto</span>
                    <span className="tabular-nums text-right w-14">Stock</span>
                    {type === 'IN' && (
                      <span className="tabular-nums text-right w-16">Costo</span>
                    )}
                  </div>
                  {filtered.map((p) => {
                    const stockQty = p.stock?.qtyOnHand ?? 0;
                    return (
                      <label
                        key={p.id}
                        className={`grid gap-2 items-center p-2 hover:bg-muted/30 cursor-pointer border-b border-border last:border-b-0 ${
                          type === 'IN'
                            ? 'grid-cols-[auto_1fr_auto_auto]'
                            : 'grid-cols-[auto_1fr_auto]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(p.id)}
                          onChange={() => toggleProductSelection(p.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="text-sm truncate min-w-0">{p.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums text-right w-14">
                          {stockQty}
                        </span>
                        {type === 'IN' && (
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
                            {formatMoney(p.cost)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpenAddMultiple(false); setSelectedProductIds(new Set()); setAddMultipleSearch(''); }}>
              Cancelar
            </Button>
            <Button onClick={confirmAddMultiple} disabled={selectedProductIds.size === 0}>
              Agregar {selectedProductIds.size > 0 ? selectedProductIds.size : ''} producto(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
