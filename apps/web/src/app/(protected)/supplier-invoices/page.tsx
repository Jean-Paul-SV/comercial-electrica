'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
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
import { FileCheck, Plus, AlertTriangle, Info, Wallet, Search } from 'lucide-react';

const SEARCH_DEBOUNCE_MS = 300;
import { Select } from '@shared/components/ui/select';
import { useSupplierInvoicesList, useCreateSupplierInvoice, useCreateSupplierInvoicePayment, useUpdateSupplierInvoiceStatus } from '@features/supplier-invoices/hooks';
import { useSuppliersList } from '@features/suppliers/hooks';
import { usePurchasesList } from '@features/purchases/hooks';

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PARTIALLY_PAID: 'Abono',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

type StatusFilter = 'all' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

function getStatusFromUrl(searchParams: URLSearchParams): StatusFilter {
  const status = searchParams.get('status');
  if (status && ['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].includes(status)) {
    return status as StatusFilter;
  }
  const overdue = searchParams.get('overdue') === 'true';
  return overdue ? 'OVERDUE' : 'all';
}

export default function SupplierInvoicesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const statusFilter = getStatusFromUrl(searchParams);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(toDateInput(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [taxRate, setTaxRate] = useState('19');
  const [discountRate, setDiscountRate] = useState('0');
  const [abono, setAbono] = useState('');
  const [abonoPaymentMethod, setAbonoPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH');
  const [notes, setNotes] = useState('');

  const setStatusAndUrl = useCallback((status: StatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('overdue'); // Eliminar el parámetro antiguo
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const limit = 20;
  const listParams = useMemo(
    () => ({
      page,
      limit,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined,
    }),
    [page, limit, statusFilter, search]
  );
  const query = useSupplierInvoicesList(listParams);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);
  const createMutation = useCreateSupplierInvoice();
  const updateStatusMutation = useUpdateSupplierInvoiceStatus();
  const suppliersQuery = useSuppliersList({ page: 1, limit: 100, isActive: true });
  const purchasesQuery = usePurchasesList({ page: 1, limit: 100 });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;
  const suppliers = useMemo(() => suppliersQuery.data?.data ?? [], [suppliersQuery.data]);
  const purchases = useMemo(() => purchasesQuery.data?.data ?? [], [purchasesQuery.data]);

  const resetForm = () => {
    setSupplierId('');
    setPurchaseOrderId('');
    setInvoiceNumber('');
    setInvoiceDate(toDateInput(new Date()));
    setDueDate('');
    setSubtotal('');
    setTaxRate('19');
    setDiscountRate('0');
    setAbono('');
    setAbonoPaymentMethod('CASH');
    setNotes('');
  };

  const sub = Number(subtotal) || 0;
  const taxPct = Number(taxRate) || 0;
  const discountPct = Number(discountRate) || 0;
  const discountTotalVal = Math.round(sub * (discountPct / 100) * 100) / 100;
  const baseAfterDiscount = sub - discountTotalVal;
  const taxTotalVal = Math.round(baseAfterDiscount * (taxPct / 100) * 100) / 100;
  const totalVal = Math.round((baseAfterDiscount + taxTotalVal) * 100) / 100;
  const abonoVal = Number(abono) || 0;
  const canAddAbono = abonoVal > 0 && abonoVal <= totalVal;

  const submitNew = () => {
    if (!supplierId) {
      toast.error('Selecciona un proveedor');
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error('Indica el número de factura');
      return;
    }
    if (sub < 0 || taxPct < 0 || taxPct > 100 || discountPct < 0 || discountPct > 100) {
      toast.error('Subtotal ≥ 0; impuesto y descuento entre 0 y 100 %');
      return;
    }
    if (abonoVal > 0 && abonoVal > totalVal) {
      toast.error('El abono no puede ser mayor al total');
      return;
    }
    const invDate = invoiceDate ? `${invoiceDate}T12:00:00.000Z` : new Date().toISOString();
    let due = dueDate ? `${dueDate}T12:00:00.000Z` : invDate;
    if (dueDate && new Date(due) <= new Date(invDate)) {
      toast.error('La fecha de vencimiento debe ser posterior a la fecha de factura');
      return;
    }
    if (!dueDate) {
      const d = new Date(invDate);
      d.setDate(d.getDate() + 30);
      due = d.toISOString();
    }
    createMutation.mutate(
      {
        supplierId,
        purchaseOrderId: purchaseOrderId || undefined,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: invDate,
        dueDate: due,
        subtotal: sub,
        taxRate: taxPct,
        discountRate: discountPct > 0 ? discountPct : undefined,
        abono: canAddAbono ? abonoVal : undefined,
        abonoPaymentMethod: canAddAbono ? abonoPaymentMethod : undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Factura registrada');
          setOpenNew(false);
          resetForm();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo registrar la factura');
        },
      }
    );
  };

  const canSubmit =
    Boolean(supplierId) &&
    Boolean(invoiceNumber.trim()) &&
    sub >= 0 &&
    taxPct >= 0 &&
    taxPct <= 100;

  const [openPaymentModal, setOpenPaymentModal] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const createPaymentMutation = useCreateSupplierInvoicePayment();

  const invoiceToPay = useMemo(
    () => (openPaymentModal ? rows.find((inv) => inv.id === openPaymentModal) : null),
    [openPaymentModal, rows],
  );
  const remainingToPay = invoiceToPay
    ? Number(invoiceToPay.grandTotal) - Number(invoiceToPay.paidAmount)
    : 0;

  const canAddPayment = (inv: { status: string }) =>
    inv.status !== 'PAID' && inv.status !== 'CANCELLED';

  const submitPayment = () => {
    if (!openPaymentModal || !invoiceToPay) return;
    const amount = Number(paymentAmount) || 0;
    if (amount <= 0) {
      toast.error('Indica un monto mayor a 0');
      return;
    }
    if (amount > remainingToPay) {
      toast.error(`El monto no puede superar el saldo pendiente (${formatMoney(remainingToPay)})`);
      return;
    }
    createPaymentMutation.mutate(
      {
        invoiceId: openPaymentModal,
        payload: {
          amount,
          paymentMethod,
          reference: paymentReference.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Pago registrado. Se ha creado el gasto en Gastos.');
          setOpenPaymentModal(null);
          setPaymentAmount('');
          setPaymentReference('');
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo registrar el pago');
        },
      },
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Facturas de proveedores
        </h1>
        <p className="text-sm text-muted-foreground">
          Cuentas por pagar
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-foreground">
              Cada abono o pago (al crear la factura o después con «Registrar pago») se refleja automáticamente en{' '}
              <Link href="/expenses?type=compras" className="text-primary font-medium hover:underline underline-offset-2">
                Gastos
              </Link>
              {' '}(categoría Factura proveedor).
            </p>
          </div>
        </div>
      </div>

      {statusFilter !== 'all' && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                <span className="text-sm font-medium text-foreground">
                  Filtro activo:
                </span>
                <span className="text-sm text-muted-foreground">
                  {STATUS_LABELS[statusFilter] || 'Facturas filtradas'}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusAndUrl('all')}
              className="h-8 text-xs border-border hover:bg-accent"
            >
              Ver todas
            </Button>
          </div>
        </div>
      )}

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <FileCheck className="h-5 w-5 shrink-0 text-primary" />
                Listado
              </CardTitle>
              <CardDescription>
                Facturas de proveedores con estado y vencimiento
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-xs text-muted-foreground whitespace-nowrap">
                  Estado:
                </Label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusAndUrl(e.target.value as StatusFilter)}
                  className="flex h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="all">Todos</option>
                  <option value="PENDING">Pendiente</option>
                  <option value="PARTIALLY_PAID">Abono</option>
                  <option value="PAID">Pagada</option>
                  <option value="OVERDUE">Vencida</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>
              <Button
                size="sm"
                onClick={() => setOpenNew(true)}
                className="gap-2 w-full sm:w-fit shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Nueva factura
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Label htmlFor="search-invoices" className="text-xs text-muted-foreground whitespace-nowrap">
                Buscar:
              </Label>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                <Input
                  id="search-invoices"
                  type="text"
                  placeholder="Número de factura o nombre del proveedor"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 h-9 rounded-lg text-sm"
                  autoComplete="off"
                />
              </div>
            </div>
            {searchInput.trim() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchInput('')}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar búsqueda
              </Button>
            )}
          </div>
          <div className="rounded-lg bg-muted/20 border border-border/50 p-3">
            <Pagination meta={meta} onPageChange={setPage} label="Página" />
          </div>

          {query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-medium">Nº factura</TableHead>
                    <TableHead className="font-medium">Proveedor</TableHead>
                    <TableHead className="font-medium">Vencimiento</TableHead>
                    <TableHead className="text-right font-medium">Total</TableHead>
                    <TableHead className="text-right font-medium">Pagado</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="font-medium w-32">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-4">
              {(query.error as { message?: string })?.message ??
                'Error al cargar facturas'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-medium">Nº factura</TableHead>
                    <TableHead className="font-medium">Proveedor</TableHead>
                    <TableHead className="font-medium">Vencimiento</TableHead>
                    <TableHead className="text-right font-medium">Total</TableHead>
                    <TableHead className="text-right font-medium">Pagado</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="text-right font-medium w-32">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((inv) => (
                    <TableRow key={inv.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-mono text-muted-foreground text-sm">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell>{inv.supplier?.name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(inv.dueDate).toLocaleDateString('es-CO')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(inv.grandTotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatMoney(inv.paidAmount)}
                      </TableCell>
                      <TableCell>
                        <select
                          value={inv.status}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            if (newStatus === inv.status) return;
                            updateStatusMutation.mutate(
                              { invoiceId: inv.id, status: newStatus },
                              {
                                onSuccess: () => toast.success('Estado actualizado'),
                                onError: (err: { message?: string }) => toast.error(err?.message ?? 'No se pudo cambiar el estado'),
                              }
                            );
                          }}
                          disabled={updateStatusMutation.isPending && updateStatusMutation.variables?.invoiceId === inv.id}
                          className={`${selectClassName} min-h-9 h-9 py-1.5 text-sm leading-normal w-full max-w-[10rem]`}
                          aria-label="Cambiar estado"
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-right">
                        {canAddPayment(inv) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            onClick={() => {
                              setOpenPaymentModal(inv.id);
                              setPaymentAmount('');
                              setPaymentReference('');
                            }}
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Registrar pago
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay facturas de proveedores.
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
              <FileCheck className="h-4 w-4" />
              Nueva factura de proveedor
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Registra la factura del proveedor con número, fechas y montos. Opcionalmente vincula un pedido de compra y registra un abono inicial. Cada abono o pago se refleja automáticamente en Gastos (categoría Factura proveedor).
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
              Datos de la factura
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Proveedor <span className="text-destructive font-normal">*</span></Label>
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
                <p className="text-xs text-muted-foreground">
                  Proveedor que emitió la factura.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Pedido de compra (opcional)</Label>
                <select
                  value={purchaseOrderId}
                  onChange={(e) => setPurchaseOrderId(e.target.value)}
                  className={selectClassName}
                >
                  <option value="">Sin pedido</option>
                  {purchases.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.orderNumber} — {po.supplier?.name ?? ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Si la factura corresponde a un pedido, selecciónalo para vincularla.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Número de factura <span className="text-destructive font-normal">*</span></Label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ej. FAC-2026-001"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Número que aparece en la factura del proveedor.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Fecha de factura</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Fecha de emisión de la factura.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Fecha de vencimiento</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Fecha límite de pago según la factura.
                </p>
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5 pt-1">
              Montos y totales
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Subtotal</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  placeholder="0"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Monto antes de impuestos y descuento.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Impuesto (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="19"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Porcentaje de IVA (ej. 19).
                </p>
              </div>
              <div className="space-y-2">
                <Label>Descuento (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(e.target.value)}
                  placeholder="0"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Descuento aplicado sobre el subtotal (opcional).
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2 rounded-lg border border-border bg-muted/30 p-3" aria-label="Resumen de totales">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatMoney(sub)}</span>
                </div>
                {discountPct > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Descuento ({discountPct}%)</span>
                    <span className="tabular-nums">-{formatMoney(discountTotalVal)}</span>
                  </div>
                )}
                {taxPct > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impuesto ({taxPct}%)</span>
                    <span className="tabular-nums">{formatMoney(taxTotalVal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t border-border pt-2 mt-1">
                  <span>Total</span>
                  <span className="tabular-nums">{formatMoney(totalVal)}</span>
                </div>
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5 pt-1">
              Pago inicial (opcional)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 sm:col-span-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">Opciones de pago</p>
                <p className="text-xs text-muted-foreground">
                  Si pagas algo al registrar la factura, indica el monto y el método. Ese pago se registrará como gasto y reducirá el saldo pendiente de la factura.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="abono">Abono (monto)</Label>
                    <Input
                      id="abono"
                      type="number"
                      min={0}
                      step="0.01"
                      value={abono}
                      onChange={(e) => setAbono(e.target.value)}
                      placeholder="0"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="abono-method">Método de pago</Label>
                    <select
                      id="abono-method"
                      value={abonoPaymentMethod}
                      onChange={(e) => setAbonoPaymentMethod(e.target.value as typeof abonoPaymentMethod)}
                      className={selectClassName}
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="OTHER">Otro</option>
                    </select>
                    {abonoVal > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Se registrará un pago por {formatMoney(abonoVal)} con este método.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Notas (opcional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas de la factura"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Información adicional o referencia interna.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpenNew(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={submitNew} disabled={createMutation.isPending || !canSubmit}>
              {createMutation.isPending ? 'Guardando…' : 'Registrar factura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Registrar pago */}
      <Dialog open={openPaymentModal !== null} onOpenChange={(open) => !open && setOpenPaymentModal(null)}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Registrar pago
            </DialogTitle>
            {invoiceToPay && (
              <p className="text-sm text-muted-foreground pt-1">
                Factura {invoiceToPay.invoiceNumber} — {invoiceToPay.supplier?.name ?? 'Proveedor'}. Saldo pendiente: {formatMoney(remainingToPay)}. El pago se registrará como gasto en Gastos.
              </p>
            )}
          </DialogHeader>
          {invoiceToPay && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Monto</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={String(remainingToPay)}
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Máximo: {formatMoney(remainingToPay)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Método de pago</Label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                  className={selectClassName}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-reference">Referencia (opcional)</Label>
                <Input
                  id="payment-reference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej. Transferencia, cheque..."
                  className="rounded-lg"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenPaymentModal(null)}>
              Cancelar
            </Button>
            <Button
              onClick={submitPayment}
              disabled={createPaymentMutation.isPending || !paymentAmount || Number(paymentAmount) <= 0}
            >
              {createPaymentMutation.isPending ? 'Guardando…' : 'Registrar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
