'use client';

import { useMemo, useState } from 'react';
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
import { Receipt, Plus, Wallet, Trash2 } from 'lucide-react';
import { useExpensesList, useCreateExpense, useDeleteExpense } from '@features/expenses/hooks';
import { useCashSessionsList } from '@features/cash/hooks';
import Link from 'next/link';

const createExpenseSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Monto mayor a 0'),
  description: z.string().min(1, 'Descripción requerida'),
  category: z.string().optional(),
  expenseDate: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  cashSessionId: z.string().uuid().optional().or(z.literal('')),
  reference: z.string().optional(),
});
type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>;

const PAYMENT_METHODS: { value: CreateExpenseFormValues['paymentMethod']; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
];

const selectClassName =
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; description: string; amount: string | number } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('');

  const limit = 20;
  const listParams = useMemo(
    () => ({
      page,
      limit,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      category: category.trim() || undefined,
    }),
    [page, limit, startDate, endDate, category],
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
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'CASH',
      cashSessionId: '',
      reference: '',
    },
  });

  const onSubmit = (values: CreateExpenseFormValues) => {
    createMutation.mutate(
      {
        amount: values.amount,
        description: values.description.trim(),
        category: values.category?.trim() || undefined,
        expenseDate: values.expenseDate ? `${values.expenseDate}T12:00:00.000Z` : undefined,
        paymentMethod: values.paymentMethod,
        cashSessionId: values.cashSessionId && values.cashSessionId !== '' ? values.cashSessionId : undefined,
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
            expenseDate: new Date().toISOString().slice(0, 10),
            paymentMethod: 'CASH',
            cashSessionId: openSessions[0]?.id ?? '',
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
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Gastos
        </h1>
        <p className="text-sm text-muted-foreground">
          Registro y consulta de gastos. Los gastos en efectivo pueden{' '}
          <Link href="/cash" className="text-primary underline underline-offset-2 font-medium">
            descontarse de la sesión de caja
          </Link>{' '}
          y aparecen en el cierre de sesión.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Receipt className="h-5 w-5 shrink-0" />
                Gastos
              </CardTitle>
              <CardDescription>
                Listado de gastos con filtros por fecha y categoría
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setOpenNew(true);
                form.setValue('cashSessionId', openSessions[0]?.id ?? '');
              }}
              className="gap-2 w-full sm:w-fit"
            >
              <Plus className="h-4 w-4" />
              Nuevo gasto
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="filter-start" className="text-muted-foreground text-sm whitespace-nowrap">
                Desde
              </Label>
              <Input
                id="filter-start"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="h-9 w-[140px] rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="filter-end" className="text-muted-foreground text-sm whitespace-nowrap">
                Hasta
              </Label>
              <Input
                id="filter-end"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="h-9 w-[140px] rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="filter-category" className="text-muted-foreground text-sm whitespace-nowrap">
                Categoría
              </Label>
              <Input
                id="filter-category"
                type="text"
                placeholder="Ej. Oficina"
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="h-9 w-[140px] rounded-lg"
              />
            </div>
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
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-center">Caja</TableHead>
                    <TableHead className="w-[4rem] text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
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
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-center">Caja</TableHead>
                    <TableHead className="w-[4rem] text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(e.expenseDate)}
                      </TableCell>
                      <TableCell className="font-medium">{e.description}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {e.category ?? '—'}
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
                        colSpan={7}
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
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Nuevo gasto
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Monto (COP) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  {...form.register('amount')}
                  className="rounded-lg"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseDate">Fecha</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  {...form.register('expenseDate')}
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción *</Label>
              <Input
                id="description"
                {...form.register('description')}
                placeholder="Ej. Compra material de oficina"
                className="rounded-lg"
              />
              {form.formState.errors.description && (
                <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría (opcional)</Label>
                <Input
                  id="category"
                  {...form.register('category')}
                  placeholder="Ej. Oficina, Servicios"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de pago *</Label>
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
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cashSessionId">Descontar de sesión de caja (opcional)</Label>
              <select
                id="cashSessionId"
                {...form.register('cashSessionId')}
                className={selectClassName}
              >
                <option value="">No descontar de caja</option>
                {openSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    Sesión abierta {formatDate(s.openedAt)}
                  </option>
                ))}
                {openSessions.length === 0 && (
                  <option value="" disabled>No hay sesiones de caja abiertas</option>
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                Si eliges una sesión, se registrará una salida en caja por este monto.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Referencia (opcional)</Label>
              <Input
                id="reference"
                {...form.register('reference')}
                placeholder="Ej. Factura 123"
                className="rounded-lg"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNew(false)}
              >
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
