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
import { FileCheck, Plus } from 'lucide-react';
import { useSupplierInvoicesList, useCreateSupplierInvoice, useUpdateSupplierInvoiceStatus } from '@features/supplier-invoices/hooks';
import { useSuppliersList } from '@features/suppliers/hooks';
import { usePurchasesList } from '@features/purchases/hooks';

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PARTIALLY_PAID: 'Pago parcial',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function SupplierInvoicesPage() {
  const [page, setPage] = useState(1);
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

  const limit = 20;
  const query = useSupplierInvoicesList({ page, limit });
  const createMutation = useCreateSupplierInvoice();
  const updateStatusMutation = useUpdateSupplierInvoiceStatus();
  const suppliersQuery = useSuppliersList({ page: 1, limit: 100 });
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

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <FileCheck className="h-5 w-5 shrink-0" />
                Listado
              </CardTitle>
              <CardDescription>
                Facturas de proveedores con estado y vencimiento
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNew(true)}
              className="gap-2 w-full sm:w-fit"
            >
              <Plus className="h-4 w-4" />
              Nueva factura
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
                    <TableHead>Nº factura</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead>Estado</TableHead>
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
                  <TableRow>
                    <TableHead>Nº factura</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((inv) => (
                    <TableRow key={inv.id}>
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
                          className={`${selectClassName} h-8 min-h-8 py-1 text-sm w-full max-w-[10rem]`}
                          aria-label="Cambiar estado"
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
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
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Número de factura</Label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ej. FAC-2026-001"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de factura</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de vencimiento</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-lg"
                />
              </div>
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
              </div>
              <div className="space-y-2 sm:col-span-2 rounded-lg border border-border bg-muted/30 p-3">
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
              <div className="space-y-3 sm:col-span-2 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">Opciones de pago</p>
                <p className="text-xs text-muted-foreground">
                  Pago inicial al registrar la factura (opcional). Quedará registrado como gasto.
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
              <div className="space-y-2 sm:col-span-2">
                <Label>Notas (opcional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas de la factura"
                  className="rounded-lg"
                />
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
    </div>
  );
}
