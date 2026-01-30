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
import { formatMoney, formatDate } from '@shared/utils/format';
import { FileSignature, Plus, Trash2, ShoppingCart, FileDown } from 'lucide-react';
import { downloadQuotePdf } from '@shared/utils/quotePdf';
import { useQuotesList, useCreateQuote, useConvertQuote } from '@features/quotes/hooks';
import { useProductsList } from '@features/products/hooks';
import { useCustomersList } from '@features/customers/hooks';
import { useCashSessionsList } from '@features/cash/hooks';
import type { QuoteStatus } from '@features/quotes/types';

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

type QuoteLine = { productId: string; qty: number; unitPrice?: number };

export default function QuotesPage() {
  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [openConvert, setOpenConvert] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [convertCashSessionId, setConvertCashSessionId] = useState('');
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH');

  const limit = 20;
  const query = useQuotesList({ page, limit });
  const createMutation = useCreateQuote();
  const convertMutation = useConvertQuote();
  const productsQuery = useProductsList({ page: 1, limit: 100 });
  const customersQuery = useCustomersList({ page: 1, limit: 100 });
  const cashSessionsQuery = useCashSessionsList({});

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;
  const products = useMemo(() => (productsQuery.data?.data ?? []).filter((p) => p.isActive !== false), [productsQuery.data]);
  const customers = useMemo(() => customersQuery.data?.data ?? [], [customersQuery.data]);
  const openSessions = useMemo(
    () => (cashSessionsQuery.data?.data ?? []).filter((s) => !s.closedAt),
    [cashSessionsQuery.data]
  );

  useEffect(() => {
    if (openNew) productsQuery.refetch();
  }, [openNew]);

  const addLine = () => setLines((prev) => [...prev, { productId: '', qty: 1 }]);
  const updateLine = (index: number, field: keyof QuoteLine, value: string | number | undefined) => {
    setLines((prev) => {
      const next = [...prev];
      (next[index] as Record<string, unknown>)[field] = value;
      return next;
    });
  };
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  /** Total por línea: cantidad × (precio unitario o precio del producto) */
  const lineTotal = (line: QuoteLine) => {
    if (!line.productId || line.qty < 1) return 0;
    const product = products.find((p) => p.id === line.productId);
    const unitPrice = line.unitPrice ?? (product ? Number(product.price) : 0);
    return line.qty * unitPrice;
  };

  /** Suma total de todas las líneas */
  const totalCotizacion = useMemo(
    () => lines.reduce((sum, line) => sum + lineTotal(line), 0),
    [lines, products]
  );

  const resetForm = () => {
    setCustomerId('');
    setValidUntil('');
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
        unitPrice: l.unitPrice,
      }));
    createMutation.mutate(
      {
        customerId: customerId || undefined,
        validUntil: validUntil || undefined,
        items,
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

  const submitConvert = () => {
    const quoteId = openConvert;
    if (!quoteId || !convertCashSessionId) {
      toast.error('Selecciona una sesión de caja abierta');
      return;
    }
    convertMutation.mutate(
      {
        id: quoteId,
        payload: {
          cashSessionId: convertCashSessionId,
          paymentMethod: convertPaymentMethod,
        },
      },
      {
        onSuccess: (data) => {
          const invoiceNumber = data?.invoice?.number;
          toast.success(
            invoiceNumber
              ? `Factura generada: ${invoiceNumber}`
              : 'Cotización convertida a venta y factura'
          );
          setOpenConvert(null);
          setConvertCashSessionId('');
          setConvertPaymentMethod('CASH');
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo convertir la cotización');
        },
      }
    );
  };

  const canSubmitNew =
    lines.length > 0 && !lines.some((l) => !l.productId || l.qty < 1);

  const canConvert = (q: { status: QuoteStatus; validUntil: string | null }) => {
    if (q.status === 'CONVERTED' || q.status === 'CANCELLED') return false;
    if (q.status === 'EXPIRED') return false;
    if (q.validUntil && new Date(q.validUntil) < new Date()) return false;
    return true;
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Cotizaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Listado de cotizaciones
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <FileSignature className="h-5 w-5 shrink-0" />
                Listado
              </CardTitle>
              <CardDescription>
                Cotizaciones paginadas
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNew(true)}
              className="gap-2 w-full sm:w-fit"
            >
              <Plus className="h-4 w-4" />
              Nueva cotización
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
                    <TableHead>Cliente</TableHead>
                    <TableHead>Validez</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
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
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Validez</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-40 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((q) => (
                    <TableRow key={q.id}>
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
                            >
                              <ShoppingCart className="h-3 w-3" />
                              Convertir a factura
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
                        No hay cotizaciones.
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
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente (opcional)</Label>
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
              </div>
              <div className="space-y-2">
                <Label>Validez hasta (opcional)</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
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
                <div className="rounded-lg bg-muted/50 px-3 py-2 flex justify-between items-center text-sm">
                  <span className="font-medium">Total cotización</span>
                  <span className="tabular-nums font-semibold text-base">{formatMoney(totalCotizacion)}</span>
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

      {/* Modal Convertir a factura (venta + factura) */}
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
              <p className="text-sm text-amber-600 dark:text-amber-400">
                No hay sesión de caja abierta. Ve a Caja y abre una sesión.
              </p>
            )}
            <div className="space-y-2">
              <Label>Sesión de caja</Label>
              <select
                value={convertCashSessionId}
                onChange={(e) => setConvertCashSessionId(e.target.value)}
                className={selectClassName}
              >
                <option value="">Selecciona sesión abierta</option>
                {openSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    Sesión {new Date(s.openedAt).toLocaleDateString('es-CO')} — {formatMoney(Number(s.openingAmount))}
                  </option>
                ))}
              </select>
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
              disabled={convertMutation.isPending || !convertCashSessionId}
            >
              {convertMutation.isPending ? 'Convirtiendo…' : 'Convertir a factura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
