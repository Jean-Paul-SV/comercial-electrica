'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { formatMoney, formatDate, formatDateTime } from '@shared/utils/format';
import { Receipt, Plus, Wallet, Trash2, FileCheck, ExternalLink } from 'lucide-react';
import { useExpensesList, useCreateExpense, useDeleteExpense } from '@features/expenses/hooks';
import { useCashSessionsList } from '@features/cash/hooks';
import Link from 'next/link';

const createExpenseSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Monto mayor a 0'),
  description: z.string().min(1, 'Descripción requerida'),
  category: z.string().optional(),
  kind: z.enum(['FIXED', 'VARIABLE', 'OTHER']).optional().or(z.literal('')),
  expenseDate: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  cashSessionId: z.string().uuid().optional().or(z.literal('')),
  reference: z.string().optional(),
});
type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>;

const EXPENSE_KIND_OPTIONS: { value: '' | 'FIXED' | 'VARIABLE' | 'OTHER'; label: string }[] = [
  { value: '', label: 'Sin clasificar' },
  { value: 'FIXED', label: 'Gasto fijo' },
  { value: 'VARIABLE', label: 'Gasto variable' },
  { value: 'OTHER', label: 'Otros' },
];

const EXPENSE_KIND_LABELS: Record<string, string> = {
  FIXED: 'Fijo',
  VARIABLE: 'Variable',
  OTHER: 'Otros',
};

const PAYMENT_METHODS: { value: CreateExpenseFormValues['paymentMethod']; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
];

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

const CATEGORY_FACTURA_PROVEEDOR = 'Factura proveedor';

type ExpenseTypeFilter = 'all' | 'compras' | 'otros';

const EXPENSE_TYPE_OPTIONS: { value: ExpenseTypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'compras', label: 'Por compras' },
  { value: 'otros', label: 'Otros' },
];

function getExpenseTypeFromUrl(searchParams: URLSearchParams): ExpenseTypeFilter {
  const type = searchParams.get('type');
  if (type === 'compras' || type === 'otros') return type;
  if (searchParams.get('category') === CATEGORY_FACTURA_PROVEEDOR) return 'compras';
  return 'all';
}

export default function ExpensesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const expenseTypeFromUrl = getExpenseTypeFromUrl(searchParams);

  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; description: string; amount: string | number } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<ExpenseTypeFilter>(expenseTypeFromUrl);
  const [kindFilter, setKindFilter] = useState<'' | 'FIXED' | 'VARIABLE' | 'OTHER'>('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    setExpenseTypeFilter(expenseTypeFromUrl);
    setPage(1);
  }, [expenseTypeFromUrl]);

  const setTypeAndUrl = useCallback(
    (value: ExpenseTypeFilter) => {
      setExpenseTypeFilter(value);
      setPage(1);
      const next = new URLSearchParams(searchParams.toString());
      if (value === 'all') {
        next.delete('type');
        next.delete('category');
      } else {
        next.set('type', value);
        if (value === 'compras') next.delete('category');
        else next.delete('category');
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const limit = 20;
  const listParams = useMemo(
    () => ({
      page,
      limit,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      expenseType: expenseTypeFilter !== 'all' ? expenseTypeFilter : undefined,
      search: expenseTypeFilter === 'all' && category.trim() ? category.trim() : undefined,
    }),
    [page, limit, startDate, endDate, expenseTypeFilter, category],
  );

  const query = useExpensesList(listParams);
  const createMutation = useCreateExpense();
  const deleteMutation = useDeleteExpense();
  const cashSessionsQuery = useCashSessionsList({ page: 1, limit: 50 });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;
  const openSessions = useMemo(() => {
    const data = cashSessionsQuery.data?.data ?? [];
    return data.filter((s) => s.closedAt == null);
  }, [cashSessionsQuery.data]);

  const form = useForm<CreateExpenseFormValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      amount: 0,
      description: '',
      category: '',
      kind: '' as const,
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'CASH',
      cashSessionId: '',
      reference: '',
    },
  });

  const onSubmit = (values: CreateExpenseFormValues) => {
    // Sesión abierta predeterminada: se usa la primera si existe (no se elige en el formulario)
    const defaultSessionId = openSessions[0]?.id;
    // La API no acepta "kind"; se omite del payload (el campo en la UI queda solo para uso futuro)
    createMutation.mutate(
      {
        amount: values.amount,
        description: values.description.trim(),
        category: values.category?.trim() || undefined,
        expenseDate: values.expenseDate ? `${values.expenseDate}T12:00:00.000Z` : undefined,
        paymentMethod: values.paymentMethod,
        cashSessionId: defaultSessionId ?? undefined,
        reference: values.reference?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Gasto registrado');
          setOpenNew(false);
          form.reset({
            amount: 0,
            description: '',
            category: '',
            kind: '',
            expenseDate: new Date().toISOString().slice(0, 10),
            paymentMethod: 'CASH',
            cashSessionId: '',
            reference: '',
          });
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo registrar el gasto');
        },
      },
    );
  };

  const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    OTHER: 'Otro',
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl flex items-center gap-2">
          <Receipt className="h-6 w-6 shrink-0 text-primary" />
          Gastos
        </h1>
        <div className="rounded-xl border border-border/60 bg-muted/30 px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-base font-medium text-foreground/90 mb-5">
            Un solo lugar para todos los gastos: compras, oficina, viáticos, etc.
          </p>
          <ul className="space-y-4 text-muted-foreground text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
              </span>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-0.5">
                <span className="font-medium text-foreground/90">Efectivo:</span> se descuenta de la{' '}
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-sm border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/60 inline-flex items-center gap-1.5 font-medium shadow-sm"
                >
                  <Link href="/cash" className="inline-flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 shrink-0" />
                    Ir a sesión de caja
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  </Link>
                </Button>{' '}
                y se refleja en el cierre.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileCheck className="h-4 w-4" />
              </span>
              <span className="pt-0.5">
                Gastos por compras: los pagos de facturas de proveedor (abono o «Registrar pago») se reflejan con categoría «{CATEGORY_FACTURA_PROVEEDOR}». Para ver solo esos, usa el filtro <strong className="text-foreground/90 font-medium">Tipo → Por compras</strong> en el listado.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" />
              </span>
              <span className="pt-0.5">
                Filtra por tipo (compras/otros), naturaleza (fijos/variables/otros), fecha o categoría; puedes eliminar un gasto desde las acciones del listado.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Receipt className="h-5 w-5 shrink-0 text-primary" />
                Gastos
              </CardTitle>
              <CardDescription>
                Listado unificado de gastos. Filtra por tipo (compras / otros), fecha y categoría.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNew(true)}
              className="gap-2 w-full sm:w-fit shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nuevo gasto
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-4 pt-4 rounded-lg bg-muted/20 border border-border/50 p-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-type" className="text-muted-foreground text-xs font-medium">
                Tipo
              </Label>
              <select
                id="filter-type"
                value={expenseTypeFilter}
                onChange={(e) => setTypeAndUrl(e.target.value as ExpenseTypeFilter)}
                className="h-9 min-w-[140px] rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {EXPENSE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-start" className="text-muted-foreground text-xs font-medium">
                Desde
              </Label>
              <Input
                id="filter-start"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="h-9 min-w-[140px] rounded-lg"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-end" className="text-muted-foreground text-xs font-medium">
                Hasta
              </Label>
              <Input
                id="filter-end"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="h-9 min-w-[140px] rounded-lg"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-kind" className="text-muted-foreground text-xs font-medium">
                Naturaleza
              </Label>
              <select
                id="filter-kind"
                value={kindFilter}
                onChange={(e) => { setKindFilter((e.target.value || '') as '' | 'FIXED' | 'VARIABLE' | 'OTHER'); setPage(1); }}
                className="h-9 min-w-[140px] rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Todos</option>
                <option value="FIXED">Fijos</option>
                <option value="VARIABLE">Variables</option>
                <option value="OTHER">Otros</option>
              </select>
            </div>
            {expenseTypeFilter === 'all' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-category" className="text-muted-foreground text-xs font-medium">
                  Categoría o descripción
                </Label>
                <Input
                  id="filter-category"
                  type="text"
                  placeholder="Ej. Oficina, inventario..."
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                  className="h-9 min-w-[160px] rounded-lg"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Pagination meta={meta} onPageChange={setPage} label="Página" />

          {query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-medium">Fecha</TableHead>
                    <TableHead className="font-medium">Descripción</TableHead>
                    <TableHead className="font-medium">Categoría</TableHead>
                    <TableHead className="font-medium">Naturaleza</TableHead>
                    <TableHead className="text-right font-medium">Monto</TableHead>
                    <TableHead className="font-medium">Método</TableHead>
                    <TableHead className="text-center font-medium">Caja</TableHead>
                    <TableHead className="w-[4rem] text-center font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 mx-auto rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-4">
              {(query.error as { message?: string })?.message ?? 'Error al cargar gastos'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-medium">Fecha</TableHead>
                    <TableHead className="font-medium">Descripción</TableHead>
                    <TableHead className="font-medium">Categoría</TableHead>
                    <TableHead className="font-medium">Naturaleza</TableHead>
                    <TableHead className="text-right font-medium">Monto</TableHead>
                    <TableHead className="font-medium">Método</TableHead>
                    <TableHead className="text-center font-medium">Caja</TableHead>
                    <TableHead className="w-[4rem] text-center font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(e.expenseDate)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/expenses/${e.id}`}
                          className="text-primary hover:underline"
                        >
                          {e.description}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {e.category ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {e.kind ? EXPENSE_KIND_LABELS[e.kind] ?? e.kind : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(e.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {e.cashSessionId && e.cashSession ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground" title={`Sesión abierta el ${formatDateTime(e.cashSession.openedAt)}`}>
                            <Wallet className="h-3.5 w-3.5 shrink-0" />
                            Descontado
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setExpenseToDelete({ id: e.id, description: e.description, amount: e.amount })}
                          aria-label="Eliminar gasto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay gastos con los filtros indicados.
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
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Receipt className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              Nuevo gasto
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Indica monto, descripción y método de pago. Si pagaste desde caja en efectivo, elige la sesión para que se registre la salida en movimientos.
            </p>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">Monto (COP) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  {...form.register('amount')}
                  placeholder="Ej.: 50000"
                  className="rounded-lg"
                />
                <p className="text-sm text-muted-foreground">
                  Monto en pesos colombianos.
                </p>
                {form.formState.errors.amount && (
                  <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseDate" className="text-sm font-medium">Fecha *</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  {...form.register('expenseDate')}
                  className="rounded-lg"
                />
                <p className="text-sm text-muted-foreground">
                  Fecha del gasto. Por defecto hoy.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Descripción *</Label>
              <Input
                id="description"
                {...form.register('description')}
                placeholder="Ej. Compra material de oficina, pago a proveedor"
                className="rounded-lg"
              />
              <p className="text-sm text-muted-foreground">
                Breve descripción para identificar el gasto en el listado.
              </p>
              {form.formState.errors.description && (
                <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">Categoría (opcional)</Label>
                <Input
                  id="category"
                  {...form.register('category')}
                  list="category-suggestions"
                  placeholder="Ej. Almuerzo, Oficina, Viáticos"
                  className="rounded-lg"
                />
                <datalist id="category-suggestions">
                  <option value="Almuerzo" />
                  <option value="Oficina" />
                  <option value="Viáticos" />
                  <option value="Servicios" />
                  <option value="Otros" />
                </datalist>
                <p className="text-sm text-muted-foreground">
                  Para filtrar después en el listado.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kind" className="text-sm font-medium">Naturaleza (opcional)</Label>
                <select
                  id="kind"
                  {...form.register('kind')}
                  className={selectClassName}
                >
                  {EXPENSE_KIND_OPTIONS.map((o) => (
                    <option key={o.value || 'none'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  Fijo (recurrente), variable u otros.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod" className="text-sm font-medium">Método de pago *</Label>
              <select
                id="paymentMethod"
                {...form.register('paymentMethod')}
                className={selectClassName}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">
                Cómo se pagó: efectivo, tarjeta, transferencia u otro.
              </p>
            </div>
            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-sm font-medium text-foreground">Sesión de caja</span>
              </div>
              {openSessions.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Se descontará de la sesión abierta por defecto ({formatDate(openSessions[0].openedAt)}). Se creará una salida en &quot;Movimientos de la sesión&quot; y quedará en el cierre.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay sesión de caja abierta. El gasto no se descontará de caja.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference" className="text-sm font-medium">Referencia (opcional)</Label>
              <Input
                id="reference"
                {...form.register('reference')}
                placeholder="Ej. Factura 123, recibo, NIT"
                className="rounded-lg"
              />
              <p className="text-sm text-muted-foreground">
                Nº de factura, recibo o referencia externa para trazabilidad.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Guardando…' : 'Registrar gasto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!expenseToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setExpenseToDelete(null);
            setDeleteReason('');
          }
        }}
      >
        <DialogContent showClose className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar gasto</DialogTitle>
          </DialogHeader>
          {expenseToDelete && (
            <>
              <p className="text-sm text-muted-foreground">
                ¿Eliminar el gasto &quot;{expenseToDelete.description}&quot; por {formatMoney(expenseToDelete.amount)}?
                Si estaba descontado de caja, también se revertirá ese movimiento.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-reason">Justificación (obligatorio)</Label>
                <Input
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ej. Registrado por error, duplicado..."
                  className="w-full"
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setExpenseToDelete(null);
                setDeleteReason('');
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending || !deleteReason.trim()}
              onClick={() => {
                if (!expenseToDelete || !deleteReason.trim()) return;
                deleteMutation.mutate(
                  { id: expenseToDelete.id, reason: deleteReason.trim() },
                  {
                    onSuccess: () => {
                      toast.success('Gasto eliminado');
                      setExpenseToDelete(null);
                      setDeleteReason('');
                    },
                    onError: (err: { message?: string }) => {
                      toast.error(err?.message ?? 'No se pudo eliminar el gasto');
                    },
                  },
                );
              }}
            >
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
