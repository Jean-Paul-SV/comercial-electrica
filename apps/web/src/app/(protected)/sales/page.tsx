'use client';

import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { isNetworkError } from '@infrastructure/api/client';
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
import { getErrorMessage } from '@shared/utils/errors';
import { useHasPermission } from '@shared/hooks/useHasPermission';
import Link from 'next/link';
import { ShoppingCart, Plus, Trash2, Search, FileText, Printer, Layers, Eye } from 'lucide-react';
import { useSalesList, useCreateSale } from '@features/sales/hooks';
import { useCashSessionsList } from '@features/cash/hooks';
import { useCustomersList, useCustomerSalesStats } from '@features/customers/hooks';
import { useProductsList } from '@features/products/hooks';
import type { CreateSaleItemPayload, CreateSaleResponse } from '@features/sales/types';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
] as const;

type SaleLine = { productId: string; qty: number; unitPrice?: number };

export default function SalesPage() {
  const hasSalesCreate = useHasPermission('sales:create');
  const hasSalesUpdate = useHasPermission('sales:update');
  const [page, setPage] = useState(1);
  const [openNewSale, setOpenNewSale] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');
  const [cashSessionId, setCashSessionId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [lastCreatedSale, setLastCreatedSale] = useState<CreateSaleResponse | null>(null);
  const [openAddMultiple, setOpenAddMultiple] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [addMultipleSearch, setAddMultipleSearch] = useState('');
  const [saleProductSearch, setSaleProductSearch] = useState('');
  const [saleCustomerSearch, setSaleCustomerSearch] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [applyTax, setApplyTax] = useState<boolean>(true);

  const limit = 20;
  const salesQuery = useSalesList({
    page,
    limit,
    search: search || undefined,
  });
  const createSaleMutation = useCreateSale();
  const cashSessionsQuery = useCashSessionsList({});
  const customersQuery = useCustomersList({
    page: 1,
    limit: 100,
    search: openNewSale ? (saleCustomerSearch.trim() || undefined) : undefined,
  });
  const customerSalesStats = useCustomerSalesStats(customerId || null);
  const productsQuery = useProductsList({
    page: 1,
    limit: 100,
    search: openNewSale ? (saleProductSearch.trim() || undefined) : undefined,
  });

  const rows = useMemo(() => salesQuery.data?.data ?? [], [salesQuery.data]);
  const meta = salesQuery.data?.meta;

  const openSessions = useMemo(
    () => (cashSessionsQuery.data?.data ?? []).filter((s) => !s.closedAt),
    [cashSessionsQuery.data]
  );
  const customersRaw = useMemo(() => customersQuery.data?.data ?? [], [customersQuery.data]);
  const customers = useMemo(() => {
    const term = saleCustomerSearch.trim().toLowerCase();
    let list = customersRaw;
    if (term) {
      list = customersRaw.filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(term) ||
          (c.docNumber ?? '').toLowerCase().includes(term) ||
          (c.email ?? '').toLowerCase().includes(term),
      );
      list = [...list].sort((a, b) => {
        const nameA = (a.name ?? '').toLowerCase();
        const nameB = (b.name ?? '').toLowerCase();
        const docA = (a.docNumber ?? '').toLowerCase();
        const docB = (b.docNumber ?? '').toLowerCase();
        const score = (name: string, doc: string) => {
          if (name === term || doc === term) return 0;
          if (name.startsWith(term) || doc.startsWith(term)) return 1;
          if (name.includes(term) || doc.includes(term)) return 2;
          return 3;
        };
        return score(nameA, docA) - score(nameB, docB);
      });
    }
    return list;
  }, [customersRaw, saleCustomerSearch]);
  const productsRaw = useMemo(
    () => (productsQuery.data?.data ?? []).filter((p) => p.isActive !== false),
    [productsQuery.data]
  );
  const products = useMemo(() => {
    const term = saleProductSearch.trim().toLowerCase();
    let list = productsRaw;
    if (term) {
      list = productsRaw.filter(
        (p) =>
          (p.name ?? '').toLowerCase().includes(term) ||
          (p.internalCode ?? '').toLowerCase().includes(term),
      );
      list = [...list].sort((a, b) => {
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
    }
    return list;
  }, [productsRaw, saleProductSearch]);
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

  // Predeterminar la sesión de caja abierta al abrir el modal de nueva venta (siempre la primera abierta)
  useEffect(() => {
    if (!openNewSale) return;
    if (openSessions.length > 0) {
      setCashSessionId(openSessions[0].id);
    } else {
      setCashSessionId('');
    }
  }, [openNewSale, openSessions]);

  const SEARCH_DEBOUNCE_MS = 300;
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const addLine = () => {
    setLines((prev) => [...prev, { productId: '', qty: 1 }]);
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
    const newLines: SaleLine[] = toAdd.map((productId) => ({
      productId,
      qty: 1,
      unitPrice: getProductPrice(productId),
    }));
    setLines((prev) => [...prev, ...newLines]);
    setOpenAddMultiple(false);
    setSelectedProductIds(new Set());
    setAddMultipleSearch('');
  };

  const updateLine = (index: number, field: keyof SaleLine, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      (next[index] as Record<string, unknown>)[field] = value;
      if (field === 'productId') {
        const newProductId = value as string;
        (next[index] as SaleLine).unitPrice = newProductId ? getProductPrice(newProductId) : undefined;
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

  const taxEstimate = applyTax ? Math.round(subtotal * 0.19) : 0;
  const discountPercentCapped = Math.max(0, Math.min(Number(discountPercent) || 0, 100));
  const discountCapped = Math.round((subtotal + taxEstimate) * discountPercentCapped / 100);
  const grandTotal = Math.max(0, subtotal + taxEstimate - discountCapped);

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
    setCashReceived(0);
    setLines([]);
    setOpenAddMultiple(false);
    setSelectedProductIds(new Set());
    setAddMultipleSearch('');
    setSaleProductSearch('');
    setSaleCustomerSearch('');
    setDiscountPercent(0);
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

    const payload = {
      customerId: customerId || undefined,
      cashSessionId,
      paymentMethod,
      items,
      discountTotal: discountCapped > 0 ? discountCapped : undefined,
    };
    createSaleMutation.mutate(
      {
        payload,
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess: (data) => {
          toast.success('Venta registrada');
          setOpenNewSale(false);
          resetForm();
          setLastCreatedSale(data);
        },
        onError: (e: { message?: string; missingProductIds?: string[] }) => {
          if (isNetworkError(e)) {
            toast.info(
              'Venta guardada localmente. Se enviará al servidor cuando haya conexión.'
            );
            return;
          }
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
            toast.error(getErrorMessage(e, 'No se pudo registrar la venta'));
          }
        },
      }
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Ventas
        </h1>
        <p className="text-sm text-muted-foreground">
          Registro y listado de ventas
        </p>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 shrink-0 text-primary" />
                Listado de ventas
              </CardTitle>
              <CardDescription>
                Ventas paginadas. Busca por cliente, número de factura o vendedor.
              </CardDescription>
            </div>
            {hasSalesCreate && (
              <Button
                size="sm"
                onClick={() => setOpenNewSale(true)}
                className="gap-2 w-full sm:w-fit shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Nueva venta
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-muted/20 border border-border/50 p-3">
            <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                <Label htmlFor="search-sale" className="text-sm text-muted-foreground whitespace-nowrap">
                  Buscar:
                </Label>
                <Input
                  id="search-sale"
                  type="search"
                  placeholder="Buscar por cliente, factura o vendedor..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 rounded-lg bg-background border-border/80 text-sm flex-1 min-w-0"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setPage(1);
                }}
                disabled={!searchInput && !search}
                className="h-9 shrink-0 border-border bg-background text-foreground hover:bg-muted/50 disabled:opacity-50"
                aria-label="Limpiar filtros"
              >
                Limpiar filtros
              </Button>
            </div>
            <Pagination meta={meta} onPageChange={setPage} label="Página" />
          </div>

          {salesQuery.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
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
              {getErrorMessage(salesQuery.error, 'Error al cargar ventas')}
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
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-20 text-center">Acciones</TableHead>
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
                      <TableCell className="text-muted-foreground">
                        {s.createdBy?.email ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(Number(s.grandTotal))}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={`/sales/${s.id}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Ver detalle"
                            aria-label="Ver detalle"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {search
                          ? 'Ninguna venta coincide con la búsqueda.'
                          : 'No hay ventas. Registra una para comenzar.'}
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
        <DialogContent showClose className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden overflow-x-hidden p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0 border-b border-border/50 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Nueva venta
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Cliente (opcional), método de pago y productos. Puedes aplicar un descuento al total. En efectivo indica el monto recibido para el vuelto.
            </p>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pt-4">
            {openSessions.length === 0 && (
              <div
                className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground dark:text-warning"
                role="alert"
              >
                No hay sesión de caja abierta. Ve a <strong>Caja</strong> y abre una sesión para poder registrar ventas.
              </div>
            )}
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-4">
              <h3 className="text-sm font-medium text-foreground">Datos de la venta</h3>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="grid gap-2 min-w-0">
                  <Label className="text-muted-foreground text-sm">Sesión de caja</Label>
                  {openSessions.length > 0 ? (
                    <div className="flex h-10 items-center rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground font-medium">
                      Sesión {new Date(openSessions[0].openedAt).toLocaleDateString('es-CO')} — {formatMoney(Number(openSessions[0].openingAmount))}
                    </div>
                  ) : (
                    <div className="flex h-10 items-center rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      No hay sesión abierta
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground leading-snug">
                    La venta se registra en la sesión de caja abierta. Si no hay ninguna, ve a <strong>Caja</strong> y abre una.
                  </p>
                </div>
                <div className="grid gap-2 min-w-0 sm:col-span-2">
                  <Label htmlFor="new-sale-customer" className="text-muted-foreground text-sm">Cliente (opcional)</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Asocia la venta a un cliente para facturación y reportes.
                  </p>
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="new-sale-customer"
                        type="text"
                        placeholder="Buscar cliente por nombre o documento..."
                        value={saleCustomerSearch}
                        onChange={(e) => setSaleCustomerSearch(e.target.value)}
                        className="pl-9 h-9 rounded-lg"
                        autoComplete="off"
                      />
                    </div>
                    {saleCustomerSearch.trim() && (
                      <p className="text-xs text-muted-foreground">
                        Buscando «<span className="font-medium text-foreground">{saleCustomerSearch.trim()}</span>» — {customers.length} resultado{customers.length !== 1 ? 's' : ''} (ordenados por lo más parecido)
                      </p>
                    )}
                  </div>
                  {customerId ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex h-9 flex-1 min-w-0 items-center rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground">
                        <span className="truncate font-medium">
                          {customersRaw.find((c) => c.id === customerId)?.name ?? 'Cliente seleccionado'}
                        </span>
                        {customerSalesStats.data && (
                          <span className="text-muted-foreground text-xs ml-1.5 shrink-0">
                            ({customerSalesStats.data.totalPurchases} compra{customerSalesStats.data.totalPurchases !== 1 ? 's' : ''} · {formatMoney(customerSalesStats.data.totalAmount)})
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0"
                        onClick={() => setCustomerId('')}
                      >
                        Sin cliente
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden shadow-sm">
                      <div
                        className="grid gap-x-3 px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground tracking-tight"
                        style={{ gridTemplateColumns: '1fr 1fr' }}
                      >
                        <span>Cliente</span>
                        <span>Documento</span>
                      </div>
                      <div className="max-h-48 overflow-auto divide-y divide-border/80">
                        {customersQuery.isLoading ? (
                          <div className="px-4 py-4 text-sm text-muted-foreground">Cargando clientes…</div>
                        ) : customers.length === 0 ? (
                          <div className="px-4 py-6 text-center">
                            <p className="text-sm text-muted-foreground">
                              {saleCustomerSearch.trim() ? `Ningún cliente coincide con «${saleCustomerSearch.trim()}».` : 'No hay clientes. Escribe para buscar o deja sin cliente.'}
                            </p>
                          </div>
                        ) : (
                          customers.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left grid gap-x-3 px-4 py-2.5 text-sm hover:bg-muted/50 focus:bg-muted/50 focus:outline-none focus:ring-0 transition-colors"
                              style={{ gridTemplateColumns: '1fr 1fr' }}
                              onClick={() => {
                                setCustomerId(c.id);
                                setSaleCustomerSearch('');
                              }}
                            >
                              <span className="font-medium text-foreground truncate">{c.name}</span>
                              <span className="text-muted-foreground truncate">
                                {c.docNumber ? `${c.docType} ${c.docNumber}` : '—'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  {customerId && customerSalesStats.isLoading && !customerSalesStats.data && (
                    <p className="text-xs text-muted-foreground">Cargando historial del cliente…</p>
                  )}
                  {customerId && customerSalesStats.isError && (
                    <p className="text-xs text-muted-foreground">No se pudo cargar el historial.</p>
                  )}
                </div>
                <div className="grid gap-2 min-w-0 sm:col-span-2">
                  <Label htmlFor="new-sale-payment" className="text-muted-foreground text-sm">Método de pago</Label>
                  <select
                    id="new-sale-payment"
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
                  <p className="text-xs text-muted-foreground leading-snug">
                    Efectivo, tarjeta, transferencia u otro. En efectivo podrás indicar el monto recibido y el vuelto.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-foreground">Líneas de venta</h3>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1 h-8">
                    <Plus className="h-3 w-3" />
                    Agregar línea
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpenAddMultiple(true)} className="gap-1 h-8">
                    <Layers className="h-3 w-3" />
                    Agregar varias líneas
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Elige producto, cantidad y opcionalmente modifica el precio unitario.
              </p>
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Buscar producto por nombre o código..."
                    value={saleProductSearch}
                    onChange={(e) => setSaleProductSearch(e.target.value)}
                    className="pl-9 h-9 rounded-lg"
                    autoComplete="off"
                  />
                </div>
                {saleProductSearch.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Buscando «<span className="font-medium text-foreground">{saleProductSearch.trim()}</span>» — {products.length} resultado{products.length !== 1 ? 's' : ''} (ordenados por lo más parecido)
                  </p>
                )}
              </div>
              {!productsLoading && !productsFetching && products.length === 0 && (
                <div
                  className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground dark:text-warning flex flex-col gap-2"
                  role="alert"
                >
                  <span>
                    {saleProductSearch.trim()
                      ? `Ningún producto coincide con «${saleProductSearch.trim()}». Prueba con otra palabra o código.`
                      : 'No hay productos disponibles. Ve a Productos para crear algunos o ejecuta el script de carga inicial (seed) de la base de datos.'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit border-warning/40 text-warning-foreground hover:bg-warning/15 dark:text-warning dark:hover:bg-warning/20"
                    onClick={() => productsQuery.refetch()}
                    disabled={productsQuery.isFetching}
                  >
                    Reintentar
                  </Button>
                </div>
              )}
              {productsFetching && saleProductSearch.trim() && products.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">
                  Buscando «{saleProductSearch.trim()}»…
                </p>
              )}
              <div className="rounded-lg border border-border overflow-hidden shadow-sm">
                {/* Encabezados alineados con las filas (mismo grid y padding) */}
                <div
                  className="grid gap-x-3 px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground tracking-tight"
                  style={{ gridTemplateColumns: '1fr 5rem 6rem 6.5rem 2.5rem' }}
                >
                  <span>Producto</span>
                  <span className="text-center">Cant.</span>
                  <span className="text-right">Precio u.</span>
                  <span className="text-right">Total</span>
                  <span className="w-8 flex-shrink-0" aria-hidden />
                </div>
                <div className="max-h-48 overflow-auto divide-y divide-border/80">
                  {lines.length === 0 && (
                    <div className="py-8 px-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Agrega al menos un producto
                      </p>
                      <p className="text-xs text-muted-foreground/80 mt-1">
                        Usa «Agregar línea» o «Agregar varias líneas»
                      </p>
                    </div>
                  )}
                  {lines.map((line, i) => {
                    const lineProductInvalid =
                      line.productId && !productIdsInCatalog.has(line.productId);
                    const unitPrice = line.productId
                      ? (line.unitPrice ?? getProductPrice(line.productId))
                      : 0;
                    const lineTotal = unitPrice * line.qty;
                    return (
                    <div
                      key={i}
                      className={`grid gap-x-3 px-4 py-2.5 text-sm items-start min-h-[3.25rem] ${lineProductInvalid ? 'bg-destructive/5 border-l-2 border-l-destructive' : 'hover:bg-muted/15'}`}
                      style={{ gridTemplateColumns: '1fr 5rem 6rem 6.5rem 2.5rem' }}
                    >
                      <select
                        value={line.productId}
                        onChange={(e) => updateLine(i, 'productId', e.target.value)}
                        className={`${selectClassName} h-9 min-w-0 max-w-full text-foreground`}
                        disabled={productsLoading || productsFetching}
                        title={line.productId ? products.find((p) => p.id === line.productId)?.name : undefined}
                      >
                        <option value="">
                          {productsLoading
                            ? 'Cargando…'
                            : productsFetching && products.length === 0
                              ? 'Actualizando…'
                              : products.length === 0
                                ? 'No hay productos.'
                                : 'Selecciona producto'}
                        </option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.internalCode ?? p.id} — {p.name} — {formatMoney(p.price)}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-col gap-0.5 min-w-0 items-stretch">
                        <Input
                          type="number"
                          min={1}
                          max={line.productId ? getAvailableStock(line.productId, i) : undefined}
                          value={line.qty}
                          onChange={(e) =>
                            setLineQty(i, Number(e.target.value) || 1)
                          }
                          className="h-9 w-full rounded-lg text-center tabular-nums"
                        />
                        {line.productId && (
                          <span className="text-[10px] text-muted-foreground leading-tight">
                            Disp. {getAvailableStock(line.productId, i)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex justify-end">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={line.productId ? (line.unitPrice ?? getProductPrice(line.productId)) : ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? undefined : Number(e.target.value);
                            updateLine(i, 'unitPrice', v ?? 0);
                          }}
                          placeholder={line.productId ? String(getProductPrice(line.productId)) : ''}
                          className="h-9 w-full max-w-[6rem] rounded-lg text-right tabular-nums"
                          disabled={!line.productId}
                        />
                      </div>
                      <div className="text-right tabular-nums text-muted-foreground text-xs font-medium min-w-0">
                        {line.productId && line.qty >= 1 ? formatMoney(lineTotal) : '—'}
                      </div>
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 rounded-full"
                          onClick={() => removeLine(i)}
                          aria-label="Quitar línea"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {(lines.length > 0 && (subtotal > 0 || lines.some((l) => l.productId))) && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                <h3 className="text-sm font-medium text-foreground">Resumen</h3>
                <div className="grid gap-y-2 text-sm" style={{ gridTemplateColumns: '1fr auto' }}>
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums text-right text-foreground">{formatMoney(subtotal)}</span>
                  <span className="text-muted-foreground">IVA (aprox.)</span>
                  <span className="tabular-nums text-right text-foreground">{formatMoney(taxEstimate)}</span>
                  <div className="col-span-2 flex items-center justify-between text-xs text-muted-foreground">
                    <label htmlFor="apply-tax" className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        id="apply-tax"
                        type="checkbox"
                        checked={applyTax}
                        onChange={(e) => setApplyTax(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-input"
                      />
                      <span>Aplicar IVA del 19 % sobre el subtotal</span>
                    </label>
                  </div>
                  <Label htmlFor="sale-discount" className="text-muted-foreground font-normal pt-1">
                    Descuento %
                  </Label>
                  <div className="flex justify-end pt-1">
                    <Input
                      id="sale-discount"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={discountPercent > 0 ? discountPercent : ''}
                      onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      placeholder="0"
                      className="h-9 w-20 rounded-lg text-right tabular-nums"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground col-span-2 -mt-0.5">
                    Opcional: porcentaje (0–100) para descontar del total.
                  </p>
                  {discountCapped > 0 && (
                    <>
                      <span className="text-emerald-600 dark:text-emerald-400">Descuento aplicado ({discountPercentCapped}%)</span>
                      <span className="tabular-nums text-right text-emerald-600 dark:text-emerald-400">−{formatMoney(discountCapped)}</span>
                    </>
                  )}
                  <span className="font-semibold pt-2 border-t border-border">Total</span>
                  <span className="tabular-nums text-right font-semibold pt-2 border-t border-border">{formatMoney(grandTotal)}</span>
                </div>
                {paymentMethod === 'CASH' && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="grid gap-1" style={{ gridTemplateColumns: '1fr auto' }}>
                      <Label htmlFor="cash-received" className="text-muted-foreground font-normal text-sm">
                        Monto recibido (efectivo)
                      </Label>
                      <Input
                        id="cash-received"
                        type="number"
                        min={0}
                        step={100}
                        value={cashReceived > 0 ? cashReceived : ''}
                        onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                        placeholder={formatMoney(grandTotal)}
                        className="h-9 w-full min-w-[8rem] max-w-[10rem] justify-self-end rounded-lg text-right tabular-nums"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lo que entrega el cliente. El vuelto se calcula automáticamente.
                    </p>
                    <div className="flex justify-between items-center font-medium text-sm pt-1">
                      <span>Vuelto a devolver</span>
                      {cashReceived >= grandTotal ? (
                        <span className="tabular-nums text-primary">
                          {formatMoney(cashReceived - grandTotal)}
                        </span>
                      ) : cashReceived > 0 ? (
                        <span className="tabular-nums text-destructive">
                          Falta: {formatMoney(grandTotal - cashReceived)}
                        </span>
                      ) : (
                        <span className="tabular-nums text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 border-t border-border/50 pt-4 flex-col gap-2 sm:flex-row sm:items-center">
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

      {/* Modal Agregar varias líneas (venta) */}
      <Dialog open={openAddMultiple} onOpenChange={setOpenAddMultiple}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Agregar varias líneas
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Marca los productos que quieras agregar a la venta. Se añadirán con cantidad 1 y precio del catálogo.
            </p>
          </DialogHeader>
          <div className="space-y-1.5 mb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={addMultipleSearch}
                onChange={(e) => setAddMultipleSearch(e.target.value)}
                className="pl-9 rounded-lg"
                autoComplete="off"
              />
            </div>
            {addMultipleSearch.trim() && (
              <p className="text-xs text-muted-foreground">
                Buscando «<span className="font-medium text-foreground">{addMultipleSearch.trim()}</span>» — ordenado por lo más parecido
              </p>
            )}
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border border-border divide-y divide-border">
            {(() => {
              const term = addMultipleSearch.trim().toLowerCase();
              let filtered = term
                ? products.filter(
                    (p) =>
                      (p.id ?? '').toLowerCase().includes(term) ||
                      (p.name ?? '').toLowerCase().includes(term) ||
                      (p.internalCode ?? '').toLowerCase().includes(term),
                  )
                : products;
              if (term && filtered.length > 0) {
                filtered = [...filtered].sort((a, b) => {
                  const nameA = (a.name ?? '').toLowerCase();
                  const nameB = (b.name ?? '').toLowerCase();
                  const codeA = (a.internalCode ?? '').toLowerCase();
                  const codeB = (b.internalCode ?? '').toLowerCase();
                  const score = (name: string, code: string) => {
                    if (name === term || code === term) return 0;
                    if (name.startsWith(term) || code.startsWith(term)) return 1;
                    return 2;
                  };
                  return score(nameA, codeA) - score(nameB, codeB);
                });
              }
              if (filtered.length === 0) {
                return (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    {products.length === 0 ? 'No hay productos disponibles.' : 'Ningún producto coincide con la búsqueda.'}
                  </p>
                );
              }
              return filtered.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-2 hover:bg-muted/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedProductIds.has(p.id)}
                    onChange={() => toggleProductSelection(p.id)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="flex-1 text-sm truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatMoney(p.price)}</span>
                </label>
              ));
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

      {/* Diálogo Factura generada - Ver / Imprimir */}
      <Dialog open={!!lastCreatedSale} onOpenChange={(open) => { if (!open) setLastCreatedSale(null); }}>
        <DialogContent showClose className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Factura generada
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              La venta se registró correctamente. Puedes imprimir la factura o cerrar.
            </p>
          </DialogHeader>
          {lastCreatedSale && (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <div id="invoice-print-content" className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 min-w-0">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-muted-foreground">Factura N° </span>
                    <span className="font-semibold break-all">{lastCreatedSale.invoice.number}</span>
                  </div>
                  <div className="text-muted-foreground shrink-0">
                    {formatDateTime(lastCreatedSale.invoice.issuedAt)}
                  </div>
                </div>
                {(lastCreatedSale.sale.customer?.name ?? (lastCreatedSale.sale.customerId && customers.find((c) => c.id === lastCreatedSale.sale.customerId)?.name)) && (
                  <p className="text-sm break-words">
                    <span className="text-muted-foreground">Cliente: </span>
                    {lastCreatedSale.sale.customer?.name ?? customers.find((c) => c.id === lastCreatedSale.sale.customerId)?.name}
                  </p>
                )}
                <div className="overflow-x-auto -mx-1">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs min-w-0">Producto</TableHead>
                        <TableHead className="text-xs text-right w-14 shrink-0">Cant.</TableHead>
                        <TableHead className="text-xs text-right w-20 shrink-0">P. unit.</TableHead>
                        <TableHead className="text-xs text-right w-20 shrink-0">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lastCreatedSale.sale.items.map((item, idx) => {
                        const name = products.find((p) => p.id === item.productId)?.name ?? item.productId;
                        const unitPrice = Number(item.unitPrice ?? 0);
                        const lineTotal = item.lineTotal != null ? Number(item.lineTotal) : unitPrice * item.qty;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-sm py-1.5 min-w-0 max-w-[180px] truncate" title={String(name)}>{name}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums py-1.5 w-14 shrink-0">{item.qty}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums py-1.5 w-20 shrink-0">{formatMoney(unitPrice)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums py-1.5 w-20 shrink-0">{formatMoney(lineTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="text-sm space-y-1 border-t border-border pt-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums shrink-0">{formatMoney(lastCreatedSale.invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">IVA</span>
                    <span className="tabular-nums shrink-0">{formatMoney(lastCreatedSale.invoice.taxTotal)}</span>
                  </div>
                  <div className="flex justify-between gap-2 font-semibold text-base pt-1">
                    <span>Total</span>
                    <span className="tabular-nums shrink-0">{formatMoney(lastCreatedSale.invoice.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-shrink-0 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setLastCreatedSale(null)}>
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!lastCreatedSale) return;
                const el = document.getElementById('invoice-print-content');
                if (!el) return;
                const win = window.open('', '_blank');
                if (!win) {
                  toast.error('Permite ventanas emergentes para imprimir');
                  return;
                }
                win.document.write(`
                  <!DOCTYPE html><html><head><meta charset="utf-8"><title>Factura ${lastCreatedSale.invoice.number}</title>
                  <style>body{font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:0 auto}
                  table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
                  th{font-weight:600}.text-right{text-align:right}.total{font-weight:700;font-size:1.1em;margin-top:8px}
                  </style></head><body>${el.innerHTML}</body></html>`);
                win.document.close();
                win.focus();
                setTimeout(() => { win.print(); win.close(); }, 250);
              }}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
