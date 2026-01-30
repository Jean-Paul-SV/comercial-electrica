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

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';
import { Pagination } from '@shared/components/Pagination';
import { formatMoney, formatDateTime } from '@shared/utils/format';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { useSalesList, useCreateSale } from '@features/sales/hooks';
import { useCashSessionsList } from '@features/cash/hooks';
import { useCustomersList } from '@features/customers/hooks';
import { useProductsList } from '@features/products/hooks';
import type { CreateSaleItemPayload } from '@features/sales/types';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
] as const;

type SaleLine = { productId: string; qty: number; unitPrice?: number };

export default function SalesPage() {
  const [page, setPage] = useState(1);
  const [openNewSale, setOpenNewSale] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');
  const [cashSessionId, setCashSessionId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH');
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [productFilter, setProductFilter] = useState('');

  const limit = 20;
  const salesQuery = useSalesList({ page, limit });
  const createSaleMutation = useCreateSale();
  const cashSessionsQuery = useCashSessionsList({});
  const customersQuery = useCustomersList({ page: 1, limit: 100 });
  const productsQuery = useProductsList({ page: 1, limit: 100 });

  const rows = useMemo(() => salesQuery.data?.data ?? [], [salesQuery.data]);
  const meta = salesQuery.data?.meta;

  const openSessions = useMemo(
    () => (cashSessionsQuery.data?.data ?? []).filter((s) => !s.closedAt),
    [cashSessionsQuery.data]
  );
  const customers = useMemo(() => customersQuery.data?.data ?? [], [customersQuery.data]);
  const products = useMemo(
    () => (productsQuery.data?.data ?? []).filter((p) => p.isActive !== false),
    [productsQuery.data]
  );
  const filteredProducts = useMemo(() => {
    if (!productFilter.trim()) return products;
    const q = productFilter.trim().toLowerCase();
    return products.filter(
      (p) =>
        (p.name ?? '').toLowerCase().includes(q) ||
        (p.internalCode ?? '').toLowerCase().includes(q)
    );
  }, [products, productFilter]);
  const productsLoading = productsQuery.isLoading;
  const productsFetching = productsQuery.isFetching;
  const productsError = productsQuery.isError;

  useEffect(() => {
    if (openNewSale && productsError) {
      const err = productsQuery.error as { message?: string; status?: number } | Error | undefined;
      const msg =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Error al cargar';
      const status = typeof err === 'object' && err !== null && 'status' in err ? (err as { status?: number }).status : undefined;
      const hint =
        status === 401
          ? ' Verifica que hayas iniciado sesión.'
          : status === 404 || /fetch|red|connection/i.test(msg)
            ? ' Comprueba que la API esté en marcha (ej. npm run dev en apps/api) y que NEXT_PUBLIC_API_BASE_URL en apps/web apunte a la API (ej. http://localhost:3000).'
            : '';
      toast.error(`No se pudieron cargar los productos: ${msg}.${hint}`);
    }
  }, [openNewSale, productsError, productsQuery.error]);

  // Refrescar productos al abrir el modal para mostrar los que ya existen o se acaban de crear
  useEffect(() => {
    if (openNewSale) {
      productsQuery.refetch();
    }
  }, [openNewSale]);

  const addLine = () => {
    setLines((prev) => [...prev, { productId: '', qty: 1 }]);
  };

  const updateLine = (index: number, field: keyof SaleLine, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      (next[index] as Record<string, unknown>)[field] = value;
      if (field === 'productId') {
        const newProductId = value as string;
        const available = newProductId
          ? (() => {
              const p = products.find((x) => x.id === newProductId);
              const base = p?.stock?.qtyOnHand ?? 0;
              const used = prev.reduce(
                (sum, l, i) =>
                  i !== index && l.productId === newProductId ? sum + l.qty : sum,
                0
              );
              return Math.max(0, base - used);
            })()
          : 0;
        const currentQty = next[index].qty;
        (next[index] as SaleLine).qty =
          available > 0 ? Math.min(currentQty, available) : 1;
      }
      return next;
    });
  };

  const setLineQty = (index: number, value: number) => {
    setLines((prev) => {
      const next = [...prev];
      const line = next[index];
      const productId = line.productId;
      const available = productId
        ? (() => {
            const p = products.find((x) => x.id === productId);
            const base = p?.stock?.qtyOnHand ?? 0;
            const used = prev.reduce(
              (sum, l, i) =>
                i !== index && l.productId === productId ? sum + l.qty : sum,
              0
            );
            return Math.max(0, base - used);
          })()
        : 0;
      const capped = Math.max(1, Math.min(value, available || 1));
      (next[index] as SaleLine).qty = capped;
      return next;
    });
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const getProductPrice = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    return p ? Number(p.price) : 0;
  };

  const getAvailableStock = (productId: string, lineIndex: number) => {
    if (!productId) return 0;
    const p = products.find((x) => x.id === productId);
    const base = p?.stock?.qtyOnHand ?? 0;
    const usedInOtherLines = lines.reduce(
      (sum, l, idx) =>
        idx !== lineIndex && l.productId === productId ? sum + l.qty : sum,
      0
    );
    return Math.max(0, base - usedInOtherLines);
  };

  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const price = line.unitPrice ?? getProductPrice(line.productId);
      return sum + price * line.qty;
    }, 0);
  }, [lines, products]);

  const taxEstimate = Math.round(subtotal * 0.19);
  const grandTotal = subtotal + taxEstimate;

  const productIdsInCatalog = useMemo(
    () => new Set(products.map((p) => p.id)),
    [products]
  );
  const invalidLineIndices = useMemo(
    () =>
      lines
        .map((l, i) => (l.productId && !productIdsInCatalog.has(l.productId) ? i + 1 : null))
        .filter((n): n is number => n != null),
    [lines, productIdsInCatalog]
  );
  const hasInvalidProducts = invalidLineIndices.length > 0;
  const hasExceededStock = lines.some(
    (l, i) => l.productId && l.qty > getAvailableStock(l.productId, i)
  );

  const canSubmit =
    Boolean(cashSessionId) &&
    lines.length > 0 &&
    !lines.some((l) => !l.productId || l.qty < 1) &&
    !hasInvalidProducts &&
    !hasExceededStock;
  const missingSession = !cashSessionId;
  const missingLines =
    lines.length === 0 || lines.some((l) => !l.productId || l.qty < 1);

  const resetForm = () => {
    setCustomerId('');
    setCashSessionId('');
    setPaymentMethod('CASH');
    setLines([]);
  };

  const submitNewSale = () => {
    if (!cashSessionId) {
      toast.error('Selecciona una sesión de caja abierta');
      return;
    }
    if (lines.length === 0 || lines.some((l) => !l.productId || l.qty < 1)) {
      toast.error('Agrega al menos un producto con cantidad');
      return;
    }
    const items: CreateSaleItemPayload[] = lines
      .filter((l) => l.productId && l.qty >= 1)
      .map((l) => ({
        productId: l.productId,
        qty: l.qty,
        unitPrice: l.unitPrice ?? getProductPrice(l.productId),
      }));

    createSaleMutation.mutate(
      {
        customerId: customerId || undefined,
        cashSessionId,
        paymentMethod,
        items,
      },
      {
        onSuccess: () => {
          toast.success('Venta registrada');
          setOpenNewSale(false);
          resetForm();
        },
        onError: (e: { message?: string; missingProductIds?: string[] }) => {
          const missingIds = e?.missingProductIds;
          if (missingIds?.length) {
            const lineNumbers = lines
              .map((l, i) => (missingIds.includes(l.productId) ? i + 1 : null))
              .filter((n): n is number => n != null);
            const lineStr =
              lineNumbers.length > 0
                ? ` en las líneas ${lineNumbers.join(', ')}`
                : '';
            toast.error(
              `Productos no encontrados o inactivos${lineStr}. Elimine esas líneas o elija otro producto.`
            );
          } else {
            toast.error(e?.message ?? 'No se pudo registrar la venta');
          }
        },
      }
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Ventas</h1>
        <p className="text-sm text-muted-foreground">
          Registro y listado de ventas
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium">
                Listado de ventas
              </CardTitle>
              <CardDescription>
                Ventas paginadas
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNewSale(true)}
              className="gap-2 w-full sm:w-fit"
            >
              <Plus className="h-4 w-4" />
              Nueva venta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Pagination meta={meta} onPageChange={setPage} label="Página" />

          {salesQuery.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {salesQuery.isError && (
            <p className="text-sm text-destructive py-4">
              {(salesQuery.error as { message?: string })?.message ??
                'Error al cargar ventas'}
            </p>
          )}

          {!salesQuery.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(s.soldAt)}
                      </TableCell>
                      <TableCell>{s.customer?.name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.invoices?.[0]?.number ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(Number(s.grandTotal))}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay ventas. Registra una para comenzar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openNewSale} onOpenChange={setOpenNewSale}>
        <DialogContent showClose className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Nueva venta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {openSessions.length === 0 && (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200"
                role="alert"
              >
                No hay sesión de caja abierta. Ve a <strong>Caja</strong> y abre una sesión para poder registrar ventas.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sesión de caja</Label>
                <select
                  value={cashSessionId}
                  onChange={(e) => setCashSessionId(e.target.value)}
                  className={selectClassName}
                  required
                >
                  <option value="">Selecciona sesión abierta</option>
                  {openSessions.length === 0 && (
                    <option value="" disabled>
                      No hay sesiones abiertas. Abre una en Caja.
                    </option>
                  )}
                  {openSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sesión {new Date(s.openedAt).toLocaleDateString('es-CO')} — {formatMoney(Number(s.openingAmount))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cliente (opcional)</Label>
                <select
                  value={customerId || 'none'}
                  onChange={(e) => setCustomerId(e.target.value === 'none' ? '' : e.target.value)}
                  className={selectClassName}
                >
                  <option value="none">Sin cliente</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Método de pago</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                  className={selectClassName}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Líneas de venta</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Agregar línea
                </Button>
              </div>
              {products.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="product-filter" className="text-muted-foreground font-normal text-xs">
                    Buscar producto por nombre o código
                  </Label>
                  <Input
                    id="product-filter"
                    type="text"
                    placeholder="Ej. 000005 o nombre del producto"
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
              )}
              {!productsLoading && !productsFetching && products.length === 0 && (
                <div
                  className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200 flex flex-col gap-2"
                  role="alert"
                >
                  <span>
                    No hay productos disponibles. Ve a <strong>Productos</strong> para crear algunos o ejecuta el script de carga inicial (seed) de la base de datos.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
                    onClick={() => productsQuery.refetch()}
                    disabled={productsQuery.isFetching}
                  >
                    Reintentar cargar productos
                  </Button>
                </div>
              )}
              {productsFetching && products.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">
                  Actualizando lista de productos…
                </p>
              )}
              <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-auto">
                {lines.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">
                    Agrega al menos un producto.
                  </p>
                )}
                {lines.map((line, i) => {
                  const lineProductInvalid =
                    line.productId && !productIdsInCatalog.has(line.productId);
                  return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2 text-sm rounded-md ${lineProductInvalid ? 'border border-destructive/60 bg-destructive/5' : ''}`}
                  >
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(i, 'productId', e.target.value)}
                      className={`${selectClassName} flex-1 h-9 min-w-0`}
                      disabled={productsLoading || productsFetching}
                    >
                      <option value="">
                        {productsLoading
                          ? 'Cargando productos…'
                          : productsFetching && products.length === 0
                            ? 'Actualizando productos…'
                            : products.length === 0
                              ? 'No hay productos. Ve a Productos para crear algunos.'
                              : productFilter.trim() && filteredProducts.length === 0
                                ? 'Sin resultados. Cambie el filtro.'
                                : 'Producto'}
                      </option>
                      {filteredProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.internalCode ?? p.id} — {p.name} — {formatMoney(p.price)}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-col gap-0.5">
                      <Input
                        type="number"
                        min={1}
                        max={line.productId ? getAvailableStock(line.productId, i) : undefined}
                        value={line.qty}
                        onChange={(e) =>
                          setLineQty(i, Number(e.target.value) || 1)
                        }
                        className="w-20 h-9 rounded-md text-center"
                      />
                      {line.productId && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Disp.: {getAvailableStock(line.productId, i)}
                        </span>
                      )}
                    </div>
                    {lineProductInvalid && (
                      <span className="text-xs text-destructive whitespace-nowrap" title="Este producto ya no existe. Elija otro o elimine la línea.">
                        Producto no disponible
                      </span>
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
                  );
                })}
              </div>
            </div>

            {(lines.length > 0 && (subtotal > 0 || lines.some((l) => l.productId))) && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA (aprox.)</span>
                  <span className="tabular-nums">{formatMoney(taxEstimate)}</span>
                </div>
                <div className="flex justify-between font-medium pt-1 border-t border-border">
                  <span>Total</span>
                  <span className="tabular-nums">{formatMoney(grandTotal)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
            {!canSubmit && !createSaleMutation.isPending && (
              <p className="text-xs text-muted-foreground w-full sm:order-first sm:flex-1">
                {hasExceededStock
                  ? 'Hay líneas con cantidad mayor al stock disponible. Ajuste las cantidades (máx. según "Disp." en cada línea).'
                  : hasInvalidProducts
                    ? `Hay líneas con productos que ya no existen (líneas ${invalidLineIndices.join(', ')}). Elimine esas líneas o elija otro producto de la lista.`
                    : missingSession && missingLines
                    ? 'Selecciona una sesión de caja y agrega al menos un producto con cantidad.'
                    : missingSession
                      ? 'Selecciona una sesión de caja abierta.'
                      : 'Agrega al menos una línea y elige un producto con cantidad.'}
              </p>
            )}
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setOpenNewSale(false); resetForm(); }}
              >
                Cancelar
              </Button>
              <Button
                onClick={submitNewSale}
                disabled={createSaleMutation.isPending || !canSubmit}
              >
                {createSaleMutation.isPending ? 'Guardando…' : 'Registrar venta'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
