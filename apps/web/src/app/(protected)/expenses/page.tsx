'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { MoneyInput } from '@shared/components/ui/money-input';
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
import { getErrorMessage } from '@shared/utils/errors';
import { useHasPermission } from '@shared/hooks/useHasPermission';
import { Receipt, Plus, Wallet, Trash2, FileCheck, ExternalLink, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useExpensesList, useCreateExpense, useDeleteExpense } from '@features/expenses/hooks';
import { useCashSessionsList } from '@features/cash/hooks';
import Link from 'next/link';
import { EmptyState } from '@shared/components/EmptyState';

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

const formInputClass =
  'h-9 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors';
const formSelectClass =
  'flex h-9 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 transition-colors';

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
  const hasExpensesCreate = useHasPermission('expenses:create');
  const hasExpensesDelete = useHasPermission('expenses:delete');
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
  const [resumenOpen, setResumenOpen] = useState(false);

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
        onError: (e: unknown) => {
          toast.error(getErrorMessage(e, 'No se pudo registrar el gasto'));
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
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-2 pb-2">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Receipt className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Gastos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Un solo lugar para todos los gastos: compras, oficina, viáticos, etc.
          </p>
        </div>
        {hasExpensesCreate && (
          <Button onClick={() => setOpenNew(true)} className="gap-2 rounded-xl font-medium shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground" size="default">
            <Plus className="h-4 w-4" />
            Nuevo gasto
          </Button>
        )}
      </header>

      <button
        type="button"
        onClick={() => setResumenOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="text-sm font-medium text-foreground flex items-center gap-2">
          <Receipt className="h-4 w-4 shrink-0 text-primary" />
          Cómo se registran los gastos
        </span>
        {resumenOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {resumenOpen && (
        <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-4">
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                <Wallet className="h-3.5 w-3.5" />
              </span>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-0.5">
                <span className="font-medium text-foreground">Efectivo:</span> se descuenta de la{' '}
                <Button asChild variant="outline" size="sm" className="h-7 px-2.5 text-xs inline-flex gap-1">
                  <Link href="/cash">Ir a sesión de caja <ExternalLink className="h-3 w-3 opacity-70" /></Link>
                </Button>
                {' '}y se refleja en el cierre.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                <FileCheck className="h-3.5 w-3.5" />
              </span>
              <span className="pt-0.5">
                <span className="font-medium text-foreground">Por compras:</span> pagos de facturas de proveedor aparecen como «{CATEGORY_FACTURA_PROVEEDOR}». Filtro <strong className="text-foreground">Tipo → Por compras</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                <Receipt className="h-3.5 w-3.5" />
              </span>
              <span className="pt-0.5">
                Filtra por tipo, fecha, naturaleza o categoría; elimina desde las acciones del listado.
              </span>
            </li>
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-type" className="text-xs font-medium text-muted-foreground">Tipo</Label>
              <select
                id="filter-type"
                value={expenseTypeFilter}
                onChange={(e) => setTypeAndUrl(e.target.value as ExpenseTypeFilter)}
                className={formSelectClass + ' min-w-[130px]'}
              >
                {EXPENSE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-start" className="text-xs font-medium text-muted-foreground">Desde</Label>
              <Input
                id="filter-start"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className={formInputClass + ' min-w-[130px]'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-end" className="text-xs font-medium text-muted-foreground">Hasta</Label>
              <Input
                id="filter-end"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className={formInputClass + ' min-w-[130px]'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-kind" className="text-xs font-medium text-muted-foreground">Naturaleza</Label>
              <select
                id="filter-kind"
                value={kindFilter}
                onChange={(e) => { setKindFilter((e.target.value || '') as '' | 'FIXED' | 'VARIABLE' | 'OTHER'); setPage(1); }}
                className={formSelectClass + ' min-w-[130px]'}
              >
                <option value="">Todos</option>
                <option value="FIXED">Fijos</option>
                <option value="VARIABLE">Variables</option>
                <option value="OTHER">Otros</option>
              </select>
            </div>
            {expenseTypeFilter === 'all' && (
              <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
                <Label htmlFor="filter-category" className="text-xs font-medium text-muted-foreground">Categoría o descripción</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="filter-category"
                    type="text"
                    placeholder="Ej. Oficina, inventario..."
                    value={category}
                    onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                    className={formInputClass + ' pl-8'}
                  />
                </div>
              </div>
            )}
          </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
            <Pagination meta={meta} onPageChange={setPage} label="Página" />
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm shadow-black/[0.03] dark:shadow-none overflow-x-auto">
          {query.isLoading && (
            <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Descripción</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Categoría</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Naturaleza</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Monto</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Método</TableHead>
                    <TableHead className="text-center font-medium text-muted-foreground">Caja</TableHead>
                    <TableHead className="w-[4rem] text-center font-medium text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto rounded" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 mx-auto rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-8 px-6">
              {getErrorMessage(query.error, 'Error al cargar gastos')}
            </p>
          )}

          {!query.isLoading && !query.isError && (
            <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Descripción</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Categoría</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Naturaleza</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Monto</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Método</TableHead>
                    <TableHead className="text-center font-medium text-muted-foreground">Caja</TableHead>
                    <TableHead className="w-[4rem] text-center font-medium text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(e.expenseDate)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/expenses/${e.id}`} className="text-primary hover:underline">
                          {e.description}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.category ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.kind ? EXPENSE_KIND_LABELS[e.kind] ?? e.kind : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-foreground">
                        {formatMoney(e.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {e.cashSessionId && e.cashSession ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground" title={`Sesión ${formatDateTime(e.cashSession.openedAt)}`}>
                            <Wallet className="h-3.5 w-3.5 shrink-0" />
                            Descontado
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasExpensesDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                            onClick={() => setExpenseToDelete({ id: e.id, description: e.description, amount: e.amount })}
                            aria-label="Eliminar gasto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="p-0">
                        <EmptyState
                          message="No hay gastos con los filtros indicados"
                          description="Cambia tipo, fechas o categoría, o registra un nuevo gasto."
                          icon={Receipt}
                          action={hasExpensesCreate ? (
                            <Button size="sm" onClick={() => setOpenNew(true)} className="gap-2">
                              <Plus className="h-4 w-4" />
                              Nuevo gasto
                            </Button>
                          ) : undefined}
                          className="py-16"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
          )}
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent showClose className="sm:max-w-2xl overflow-x-hidden rounded-2xl border-border/80 shadow-xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" aria-hidden />
              </span>
              Nuevo gasto
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-0.5 leading-snug">
              Indica monto, descripción y método de pago. Si pagaste desde caja en efectivo, se descontará de la sesión abierta.
            </p>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-sm font-medium text-foreground">Monto (COP) *</Label>
                <Controller
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <MoneyInput
                      id="amount"
                      className={formInputClass + ' h-10'}
                      placeholder="Ej.: 50.000"
                      value={field.value ?? undefined}
                      onChangeValue={(val) => field.onChange(val ?? undefined)}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Monto en pesos colombianos.
                </p>
                {form.formState.errors.amount && (
                  <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expenseDate" className="text-sm font-medium text-foreground">Fecha *</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  {...form.register('expenseDate')}
                  className={formInputClass + ' h-10'}
                />
                <p className="text-xs text-muted-foreground">
                  Fecha del gasto. Por defecto hoy.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">Descripción *</Label>
              <Input
                id="description"
                {...form.register('description')}
                placeholder="Ej. Compra material de oficina, pago a proveedor"
                className={formInputClass + ' h-10'}
              />
              <p className="text-xs text-muted-foreground">
                Breve descripción para identificar el gasto en el listado.
              </p>
              {form.formState.errors.description && (
                <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-sm font-medium text-foreground">Categoría (opcional)</Label>
                <Input
                  id="category"
                  {...form.register('category')}
                  list="category-suggestions"
                  placeholder="Ej. Almuerzo, Oficina, Viáticos"
                  className={formInputClass + ' h-10'}
                />
                <datalist id="category-suggestions">
                  <option value="Almuerzo" />
                  <option value="Oficina" />
                  <option value="Viáticos" />
                  <option value="Servicios" />
                  <option value="Otros" />
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Para filtrar después en el listado.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kind" className="text-sm font-medium text-foreground">Naturaleza (opcional)</Label>
                <select
                  id="kind"
                  {...form.register('kind')}
                  className={formSelectClass}
                >
                  {EXPENSE_KIND_OPTIONS.map((o) => (
                    <option key={o.value || 'none'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Fijo (recurrente), variable u otros.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod" className="text-sm font-medium text-foreground">Método de pago *</Label>
              <select
                id="paymentMethod"
                {...form.register('paymentMethod')}
                className={formSelectClass}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Cómo se pagó: efectivo, tarjeta, transferencia u otro.
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3 border-l-4 border-l-primary/50">
              <div className="flex items-center gap-2 mb-1.5">
                <Wallet className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-sm font-medium text-foreground">Sesión de caja</span>
              </div>
              {openSessions.length > 0 ? (
                <p className="text-xs text-muted-foreground leading-snug">
                  Se descontará de la sesión abierta por defecto ({formatDate(openSessions[0].openedAt)}). Se creará una salida en &quot;Movimientos de la sesión&quot; y quedará en el cierre.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-snug">
                  No hay sesión de caja abierta. El gasto no se descontará de caja.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reference" className="text-sm font-medium text-foreground">Referencia (opcional)</Label>
              <Input
                id="reference"
                {...form.register('reference')}
                placeholder="Ej. Factura 123, recibo, NIT"
                className={formInputClass + ' h-10'}
              />
              <p className="text-xs text-muted-foreground">
                Nº de factura, recibo o referencia externa para trazabilidad.
              </p>
            </div>
            <DialogFooter className="gap-2 pt-1 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpenNew(false)} className="rounded-xl">
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="rounded-xl font-medium">
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
        <DialogContent showClose className="sm:max-w-sm rounded-2xl border-border/80 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Eliminar gasto</DialogTitle>
          </DialogHeader>
          {expenseToDelete && (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ¿Eliminar el gasto &quot;{expenseToDelete.description}&quot; por {formatMoney(expenseToDelete.amount)}?
                Si estaba descontado de caja, también se revertirá ese movimiento.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-reason" className="text-foreground font-medium">Justificación (obligatorio)</Label>
                <Input
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ej. Registrado por error, duplicado..."
                  className="rounded-xl border-input bg-background/80 focus-visible:ring-primary focus-visible:ring-offset-2"
                />
              </div>
            </>
          )}
          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setExpenseToDelete(null);
                setDeleteReason('');
              }}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending || !deleteReason.trim()}
              className="rounded-xl font-medium"
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
                    onError: (err: unknown) => {
                      toast.error(getErrorMessage(err, 'No se pudo eliminar el gasto'));
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
