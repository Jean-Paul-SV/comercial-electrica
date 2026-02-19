'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { formatMoney, formatDate } from '@shared/utils/format';
import { downloadQuotePdf } from '@shared/utils/quotePdf';
import Link from 'next/link';
import { FileSignature, Plus, Trash2, ShoppingCart, FileDown, Search, Layers, Info, UserPlus } from 'lucide-react';
import { useQuotesList, useCreateQuote, useConvertQuote, useUpdateQuoteStatus } from '@features/quotes/hooks';
import { useProductsList } from '@features/products/hooks';
import { useCustomersList, useCreateCustomer } from '@features/customers/hooks';
import { useCashSessionsList } from '@features/cash/hooks';
import type { CustomerDocType } from '@features/customers/types';

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  EXPIRED: 'Vencida',
  CONVERTED: 'Convertida',
  CANCELLED: 'Cancelada',
};

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
] as const;

// IVA por defecto (porcentaje) cuando el producto no tiene tasa configurada.
const DEFAULT_TAX_RATE_PERCENT = 19;

const DOC_TYPES: { value: CustomerDocType; label: string }[] = [
  { value: 'CC', label: 'Cédula' },
  { value: 'CE', label: 'Cédula ext.' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro' },
];

const customerSchema = z.object({
  docType: z.enum(['CC', 'CE', 'NIT', 'PASSPORT', 'OTHER']),
  docNumber: z.string().min(3, 'Mínimo 3 caracteres'),
  name: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
});
type CustomerFormValues = z.infer<typeof customerSchema>;

type QuoteLine = { productId: string; qty: number; unitPrice?: number };

export default function QuotesPage() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status') ?? '';

  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [openConvert, setOpenConvert] = useState<string | null>(null);
  const [quoteToCancel, setQuoteToCancel] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [openAddMultiple, setOpenAddMultiple] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [addMultipleSearch, setAddMultipleSearch] = useState('');
  const [convertCashSessionId, setConvertCashSessionId] = useState('');
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [openNewCustomer, setOpenNewCustomer] = useState(false);

  const limit = 20;
  const query = useQuotesList({
    page,
    limit,
    status: statusFilter || undefined,
    search: search || undefined,
  });
  const createMutation = useCreateQuote();
  const convertMutation = useConvertQuote();
  const updateStatusMutation = useUpdateQuoteStatus();
  const createCustomerMutation = useCreateCustomer();
  const productsQuery = useProductsList({ page: 1, limit: 100 });
  const customersQuery = useCustomersList({ page: 1, limit: 100 });
  const cashSessionsQuery = useCashSessionsList({});

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      docType: 'CC',
      docNumber: '',
      name: '',
      email: '',
      phone: '',
    },
  });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;
  const products = useMemo(() => (productsQuery.data?.data ?? []).filter((p) => p.isActive !== false), [productsQuery.data]);
  const customers = useMemo(() => customersQuery.data?.data ?? [], [customersQuery.data]);
  const openSessions = useMemo(
    () => (cashSessionsQuery.data?.data ?? []).filter((s) => !s.closedAt),
    [cashSessionsQuery.data]
  );

  const SEARCH_DEBOUNCE_MS = 300;
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (openNew) productsQuery.refetch();
  }, [openNew]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // Predeterminar la sesión de caja abierta al abrir el modal "Convertir a factura"
  useEffect(() => {
    if (!openConvert) return;
    if (openSessions.length > 0) {
      setConvertCashSessionId(openSessions[0].id);
    } else {
      setConvertCashSessionId('');
    }
  }, [openConvert, openSessions]);

  const addLine = () => setLines((prev) => [...prev, { productId: '', qty: 1 }]);

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
    const priceByProduct = Object.fromEntries(products.map((p) => [p.id, Number(p.price)]));
    const newLines: QuoteLine[] = toAdd.map((productId) => ({
      productId,
      qty: 1,
      unitPrice: priceByProduct[productId],
    }));
    setLines((prev) => [...prev, ...newLines]);
    setOpenAddMultiple(false);
    setSelectedProductIds(new Set());
    setAddMultipleSearch('');
  };

  const updateLine = (index: number, field: keyof QuoteLine, value: string | number | undefined) => {
    setLines((prev) => {
      const next = [...prev];
      (next[index] as Record<string, unknown>)[field] = value;
      return next;
    });
  };
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const lineTotal = (line: QuoteLine) => {
    if (!line.productId || line.qty < 1) return 0;
    const product = products.find((p) => p.id === line.productId);
    const unitPrice = line.unitPrice ?? (product ? Number(product.price) : 0);
    return line.qty * unitPrice;
  };

  const subtotalCotizacion = useMemo(
    () => lines.reduce((sum, line) => sum + lineTotal(line), 0),
    [lines, products]
  );

  const taxEstimateQuote = useMemo(() => {
    return lines.reduce((sum, line) => {
      if (!line.productId || line.qty < 1) return sum;
      const product = products.find((p) => p.id === line.productId);
      const unitPrice = line.unitPrice ?? (product ? Number(product.price) : 0);
      const lineSubtotal = unitPrice * line.qty;
      const rawRate = product?.taxRate;
      const taxRate =
        rawRate == null
          ? DEFAULT_TAX_RATE_PERCENT
          : Number(rawRate);
      return sum + (lineSubtotal * taxRate) / 100;
    }, 0);
  }, [lines, products]);

  const discountPercentCapped = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const totalAntesDescuento = subtotalCotizacion + taxEstimateQuote;
  const discountAmountQuote = Math.round((totalAntesDescuento * discountPercentCapped) / 100);
  const totalCotizacion = Math.max(0, totalAntesDescuento - discountAmountQuote);

  const resetForm = () => {
    setCustomerId('');
    setValidUntil('');
    setLines([]);
    setOpenAddMultiple(false);
    setSelectedProductIds(new Set());
    setAddMultipleSearch('');
    setDiscountPercent(0);
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
        unitPrice: l.unitPrice,
      }));
    createMutation.mutate(
      {
        customerId: customerId || undefined,
        validUntil: validUntil || undefined,
        items,
        discountPercent: discountPercentCapped > 0 ? discountPercentCapped : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Cotización creada');
          setOpenNew(false);
          resetForm();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear la cotización');
        },
      }
    );
  };

  const canConvert = (q: { status: string }) => q.status === 'DRAFT' || q.status === 'SENT';
  const canCancel = (q: { status: string }) => q.status === 'DRAFT' || q.status === 'SENT';

  const submitConvert = () => {
    if (!openConvert || !convertCashSessionId) return;
    convertMutation.mutate(
      {
        id: openConvert,
        payload: { cashSessionId: convertCashSessionId, paymentMethod: convertPaymentMethod },
      },
      {
        onSuccess: () => {
          toast.success('Cotización convertida a factura');
          setOpenConvert(null);
          setConvertCashSessionId('');
          setConvertPaymentMethod('CASH');
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo convertir');
        },
      }
    );
  };

  const handleCancelQuote = () => {
    if (!quoteToCancel) return;
    updateStatusMutation.mutate(
      { id: quoteToCancel, status: 'CANCELLED' },
      {
        onSuccess: () => {
          toast.success('Cotización cancelada');
          setQuoteToCancel(null);
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo cancelar la cotización');
        },
      }
    );
  };

  const handleCreateCustomer = (values: CustomerFormValues) => {
    createCustomerMutation.mutate(
      {
        docType: values.docType,
        docNumber: values.docNumber.trim(),
        name: values.name.trim(),
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
      },
      {
        onSuccess: (newCustomer) => {
          toast.success('Cliente creado exitosamente');
          setOpenNewCustomer(false);
          customerForm.reset();
          // Refrescar la lista de clientes y seleccionar el nuevo cliente
          customersQuery.refetch().then(() => {
            setCustomerId(newCustomer.id);
          });
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear el cliente');
        },
      }
    );
  };

  const canSubmitNew = lines.some((l) => l.productId && l.qty >= 1);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cotizaciones</h1>
        <p className="text-sm text-muted-foreground">Listado de cotizaciones</p>
      </div>

      {statusFilter === 'EXPIRED' && (
        <p className="text-sm text-muted-foreground rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          Filtro desde alerta: cotizaciones vencidas.
          <a href="/quotes" className="ml-2 text-primary font-medium hover:underline">Ver todas</a>
        </p>
      )}

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <FileSignature className="h-5 w-5 shrink-0 text-primary" />
                Listado
              </CardTitle>
              <CardDescription>
                Cotizaciones paginadas. Busca por cliente (nombre o número).
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNew(true)}
              className="gap-2 w-full sm:w-fit shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nueva cotización
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-muted/20 border border-border/50 p-3">
            <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                <Label htmlFor="search-quote" className="text-sm text-muted-foreground whitespace-nowrap">
                  Buscar:
                </Label>
                <Input
                  id="search-quote"
                  type="search"
                  placeholder="Buscar por cliente (nombre o número)"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-lg bg-background border-border/80 text-sm flex-1 min-w-0"
                  autoComplete="off"
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

          {openSessions.length === 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3 text-sm text-amber-800 dark:text-amber-200 dark:bg-amber-500/15 dark:border-amber-500/30">
              <Info className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="flex-1 min-w-0">
                Para convertir una cotización a factura (venta) debes tener al menos una <strong>sesión de caja abierta</strong>. Ve a{' '}
                <Link href="/cash" className="font-medium text-primary hover:underline">
                  Caja
                </Link>{' '}
                y abre una sesión para habilitar el botón &quot;Convertir a factura&quot;.
              </p>
            </div>
          )}

          {query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-medium">Cliente</TableHead>
                    <TableHead className="font-medium">Validez</TableHead>
                    <TableHead className="text-right font-medium">Total</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
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
                'Error al cargar cotizaciones'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-medium">Cliente</TableHead>
                    <TableHead className="font-medium">Validez</TableHead>
                    <TableHead className="text-right font-medium">Total</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="w-40 text-right font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((q) => (
                    <TableRow key={q.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {q.customer?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {q.validUntil ? formatDate(q.validUntil) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(q.grandTotal)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {STATUS_LABELS[q.status] ?? q.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Link href={`/quotes/${q.id}`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              title="Ver detalle"
                            >
                              <Info className="h-3 w-3" />
                              Ver
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => downloadQuotePdf(q)}
                            title="Descargar PDF"
                          >
                            <FileDown className="h-3 w-3" />
                            PDF
                          </Button>
                          {canConvert(q) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => setOpenConvert(q.id)}
                              disabled={openSessions.length === 0}
                              title={
                                openSessions.length === 0
                                  ? 'Abre una sesión de caja en Caja para poder convertir esta cotización a factura.'
                                  : 'Convertir esta cotización en una venta (factura)'
                              }
                            >
                              <ShoppingCart className="h-3 w-3" />
                              Convertir a factura
                            </Button>
                          )}
                          {canCancel(q) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => setQuoteToCancel(q.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {search
                          ? 'Ninguna cotización coincide con la búsqueda.'
                          : 'No hay cotizaciones. Crea una para comenzar.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Nueva cotización */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent showClose className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              Nueva cotización
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Elige el cliente (opcional), fecha de validez y agrega los productos con cantidad y precio. El total se calcula automáticamente.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
              Datos generales
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Cliente (opcional)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenNewCustomer(true)}
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Crear cliente
                  </Button>
                </div>
                <select
                  value={customerId || 'none'}
                  onChange={(e) => setCustomerId(e.target.value === 'none' ? '' : e.target.value)}
                  className={selectClassName}
                >
                  <option value="none">Sin cliente</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Asocia la cotización a un cliente para facturación.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Validez hasta (opcional)</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Fecha límite para aceptar la cotización. Por defecto 30 días.
                </p>
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
              Productos (requerido)
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Líneas</Label>
                {lines.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
                    <Plus className="h-3 w-3" />
                    Agregar línea
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Agrega productos, cantidad y precio unitario. Puedes dejar el precio en blanco para usar el del catálogo.
              </p>
              <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-auto">
                {lines.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="text-sm text-muted-foreground">Sin productos. Agrega al menos una línea para continuar.</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Agregar primera línea
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setOpenAddMultiple(true)} className="gap-1.5">
                        <Layers className="h-4 w-4" />
                        Agregar varias líneas
                      </Button>
                    </div>
                  </div>
                )}
                {lines.length > 0 && (
                  <div className="grid grid-cols-[1fr_80px_90px_80px_auto] gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
                    <span>Producto</span>
                    <span className="text-center">Cant.</span>
                    <span className="text-right">Precio u.</span>
                    <span className="text-right">Total</span>
                    <span className="w-9" />
                  </div>
                )}
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_90px_80px_auto] gap-2 items-center p-2 text-sm">
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(i, 'productId', e.target.value)}
                      className={`${selectClassName} h-9 min-w-0`}
                    >
                      <option value="">Producto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatMoney(p.price)}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) => updateLine(i, 'qty', Number(e.target.value) || 1)}
                      className="w-full h-9 rounded-md text-center"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Precio"
                      value={line.unitPrice ?? ''}
                      onChange={(e) => updateLine(i, 'unitPrice', e.target.value === '' ? undefined : Number(e.target.value))}
                      className="w-full h-9 rounded-md text-right"
                    />
                    <span className="text-right tabular-nums font-medium">
                      {line.productId && line.qty >= 1 ? formatMoney(lineTotal(line)) : '—'}
                    </span>
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
              {lines.length > 0 && (
                <div className="rounded-lg border border-border/80 bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatMoney(subtotalCotizacion)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA (aprox.)</span>
                    <span className="tabular-nums">{formatMoney(Math.round(taxEstimateQuote))}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <Label htmlFor="quote-discount-pct" className="text-muted-foreground font-normal text-sm">
                      Descuento %
                    </Label>
                    <Input
                      id="quote-discount-pct"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={discountPercent > 0 ? discountPercent : ''}
                      onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                      placeholder="0"
                      className="h-9 w-24 rounded-lg text-right tabular-nums"
                    />
                  </div>
                  {discountPercentCapped > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-sm">
                      <span>Descuento aplicado</span>
                      <span className="tabular-nums">−{formatMoney(discountAmountQuote)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-1 border-t border-border">
                    <span>Total cotización</span>
                    <span className="tabular-nums font-semibold text-base">{formatMoney(totalCotizacion)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Opcional: ingresa un porcentaje (0-100) para descontar del total.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpenNew(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={submitNew} disabled={createMutation.isPending || !canSubmitNew}>
              {createMutation.isPending ? 'Guardando…' : 'Crear cotización'}
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
              Agregar varias líneas
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Marca los productos que quieras agregar a la cotización. Se añadirán con cantidad 1 y precio del catálogo.
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
          <div className="max-h-64 overflow-auto rounded-lg border border-border divide-y divide-border">
            {(() => {
              const term = addMultipleSearch.trim().toLowerCase();
              const filtered = term
                ? products.filter(
                    (p) =>
                      (p.name ?? '').toLowerCase().includes(term) ||
                      (p.internalCode ?? '').toLowerCase().includes(term),
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
                    <span className="tabular-nums text-right w-16">Precio</span>
                  </div>
                  {filtered.map((p) => {
                    const stockQty = p.stock?.qtyOnHand ?? 0;
                    return (
                      <label
                        key={p.id}
                        className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center p-2 hover:bg-muted/30 cursor-pointer"
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
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
                          {formatMoney(p.price)}
                        </span>
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

      {/* Modal Convertir a factura */}
      <Dialog open={!!openConvert} onOpenChange={(open) => { if (!open) setOpenConvert(null); }}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Convertir cotización a factura
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {openSessions.length === 0 && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground dark:text-warning">
                No hay sesión de caja abierta. Ve a Caja y abre una sesión para poder convertir.
              </p>
            )}
            <div className="space-y-2">
              <Label>Sesión de caja</Label>
              {openSessions.length > 0 ? (
                <p className="flex h-10 items-center rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                  Sesión {new Date(openSessions[0].openedAt).toLocaleDateString('es-CO')} — {formatMoney(Number(openSessions[0].openingAmount))}
                </p>
              ) : (
                <p className="flex h-10 items-center rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  No hay sesión abierta
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                La venta se registrará en la sesión de caja abierta.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <select
                value={convertPaymentMethod}
                onChange={(e) => setConvertPaymentMethod(e.target.value as typeof convertPaymentMethod)}
                className={selectClassName}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenConvert(null)}>
              Cancelar
            </Button>
            <Button
              onClick={submitConvert}
              disabled={convertMutation.isPending || openSessions.length === 0}
            >
              {convertMutation.isPending ? 'Convirtiendo…' : 'Convertir a factura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar cancelación */}
      <Dialog open={quoteToCancel !== null} onOpenChange={(open) => !open && setQuoteToCancel(null)}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Cancelar cotización
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Estás seguro de que deseas cancelar esta cotización? Esta acción no se puede deshacer.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuoteToCancel(null)}
            >
              No cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelQuote}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? 'Cancelando…' : 'Sí, cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear Cliente */}
      <Dialog
        open={openNewCustomer}
        onOpenChange={(open) => {
          setOpenNewCustomer(open);
          if (!open) {
            customerForm.reset();
          }
        }}
      >
        <DialogContent showClose className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Nuevo cliente
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Crea un nuevo cliente para asociarlo a esta cotización.
            </p>
          </DialogHeader>
          <form
            onSubmit={customerForm.handleSubmit(handleCreateCustomer)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-customer-docType">Tipo documento</Label>
                <select
                  id="new-customer-docType"
                  {...customerForm.register('docType')}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-docNumber">Nº documento</Label>
                <Input
                  id="new-customer-docNumber"
                  {...customerForm.register('docNumber')}
                  placeholder="Ej: 1234567890"
                  className="rounded-lg"
                />
                {customerForm.formState.errors.docNumber && (
                  <p className="text-sm text-destructive">
                    {customerForm.formState.errors.docNumber.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="new-customer-name">Nombre / Razón social</Label>
                <Input
                  id="new-customer-name"
                  {...customerForm.register('name')}
                  placeholder="Ej: Juan Pérez o Empresa S.A.S."
                  className="rounded-lg"
                />
                {customerForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {customerForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-email">Email</Label>
                <Input
                  id="new-customer-email"
                  type="email"
                  {...customerForm.register('email')}
                  placeholder="Ej: cliente@correo.com"
                  className="rounded-lg"
                />
                {customerForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {customerForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-phone">Teléfono</Label>
                <Input
                  id="new-customer-phone"
                  {...customerForm.register('phone')}
                  placeholder="Ej: 300 123 4567"
                  className="rounded-lg"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenNewCustomer(false);
                  customerForm.reset();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createCustomerMutation.isPending}>
                {createCustomerMutation.isPending ? 'Guardando…' : 'Crear cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
