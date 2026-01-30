'use client';

import { useMemo, useState, useEffect } from 'react';
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
import { Select } from '@shared/components/ui/select';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Pagination } from '@shared/components/Pagination';
import { formatMoney, formatDateTime } from '@shared/utils/format';
import { Wallet, Plus, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Lock, TrendingUp, Calculator, Receipt } from 'lucide-react';
import { useCashSessionsList, useOpenCashSession, useCloseCashSession, useCreateCashMovement } from '@features/cash/hooks';
import { useExpensesList } from '@features/expenses/hooks';
import { useDashboard, useCashReport } from '@features/reports/hooks';
import type { CreateMovementPayload } from '@features/cash/types';

const openSessionSchema = z.object({
  openingAmount: z.coerce.number().min(0, 'Monto >= 0'),
});
type OpenSessionFormValues = z.infer<typeof openSessionSchema>;

const closeSessionSchema = z.object({
  closingAmount: z.coerce.number().min(0, 'Monto >= 0'),
});
type CloseSessionFormValues = z.infer<typeof closeSessionSchema>;

const movementSchema = z.object({
  sessionId: z.string().uuid('Selecciona una sesión'),
  type: z.enum(['IN', 'OUT', 'ADJUST']),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  amount: z.coerce.number().min(0.01, 'Monto mayor a 0'),
  reference: z.string().optional(),
});
type MovementFormValues = z.infer<typeof movementSchema>;

const MOVEMENT_TYPES: { value: MovementFormValues['type']; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'IN', label: 'Entrada', icon: ArrowDownToLine },
  { value: 'OUT', label: 'Salida', icon: ArrowUpFromLine },
  { value: 'ADJUST', label: 'Ajuste', icon: SlidersHorizontal },
];
const PAYMENT_METHODS: { value: MovementFormValues['method']; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
];

export default function CashPage() {
  const [page, setPage] = useState(1);
  const [openNewSession, setOpenNewSession] = useState(false);
  const [openNewMovement, setOpenNewMovement] = useState(false);
  const [sessionToClose, setSessionToClose] = useState<{ id: string; openedAt: string; openingAmount: number | string } | null>(null);
  const limit = 20;
  const query = useCashSessionsList({ page, limit });
  const dashboard = useDashboard();
  const cashReportForSession = useCashReport(
    sessionToClose ? { sessionId: sessionToClose.id } : {}
  );
  const sessionDate = sessionToClose
    ? (() => {
        const d = new Date(sessionToClose.openedAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })()
    : '';
  const expensesTodayQuery = useExpensesList(
    sessionDate ? { startDate: sessionDate, endDate: sessionDate, limit: 50 } : {}
  );
  const expensesToday = useMemo(() => expensesTodayQuery.data?.data ?? [], [expensesTodayQuery.data]);
  const expensesTodayTotal = useMemo(
    () => expensesToday.reduce((sum, e) => sum + Number(e.amount), 0),
    [expensesToday]
  );
  const openSession = useOpenCashSession();
  const closeSession = useCloseCashSession();
  const createMovement = useCreateCashMovement();
  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const openSessions = useMemo(() => rows.filter((s) => s.closedAt == null), [rows]);
  const meta = query.data?.meta;
  const todaySalesTotal = dashboard.data?.sales?.today?.total ?? 0;
  const todaySalesCount = dashboard.data?.sales?.today?.count ?? 0;
  const sessionExpectedAmount = useMemo(() => {
    if (!sessionToClose || !cashReportForSession.data?.sessions?.length) return null;
    return cashReportForSession.data.sessions[0].expectedAmount ?? null;
  }, [sessionToClose, cashReportForSession.data?.sessions]);

  const sessionTotalsByMethod = useMemo(() => {
    if (!sessionToClose || !cashReportForSession.data?.sessions?.length) return null;
    return cashReportForSession.data.sessions[0].movements?.totalsByMethod ?? null;
  }, [sessionToClose, cashReportForSession.data?.sessions]);

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    OTHER: 'Otro',
  };

  const form = useForm<OpenSessionFormValues>({
    resolver: zodResolver(openSessionSchema),
    defaultValues: { openingAmount: 0 },
  });

  const movementForm = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      sessionId: '',
      type: 'ADJUST',
      method: 'CASH',
      amount: 0,
      reference: '',
    },
  });

  const closeForm = useForm<CloseSessionFormValues>({
    resolver: zodResolver(closeSessionSchema),
    defaultValues: { closingAmount: 0 },
  });

  useEffect(() => {
    if (sessionToClose && sessionExpectedAmount != null) {
      closeForm.setValue('closingAmount', sessionExpectedAmount);
    }
  }, [sessionToClose?.id, sessionExpectedAmount]);

  const onCloseSession = (values: CloseSessionFormValues) => {
    if (!sessionToClose) return;
    closeSession.mutate(
      { sessionId: sessionToClose.id, payload: { closingAmount: values.closingAmount } },
      {
        onSuccess: () => {
          toast.success('Sesión cerrada');
          setSessionToClose(null);
          closeForm.reset({ closingAmount: 0 });
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo cerrar la sesión');
        },
      }
    );
  };

  const onOpenSession = (values: OpenSessionFormValues) => {
    openSession.mutate(
      { openingAmount: values.openingAmount },
      {
        onSuccess: () => {
          toast.success('Sesión de caja abierta');
          setOpenNewSession(false);
          form.reset({ openingAmount: 0 });
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo abrir la sesión');
        },
      }
    );
  };

  const onMovementSubmit = (values: MovementFormValues) => {
    const payload: CreateMovementPayload = {
      type: values.type,
      method: values.method,
      amount: values.amount,
      reference: values.reference || undefined,
    };
    createMovement.mutate(
      { sessionId: values.sessionId, payload },
      {
        onSuccess: () => {
          toast.success('Movimiento registrado');
          setOpenNewMovement(false);
          movementForm.reset({
            sessionId: openSessions[0]?.id ?? '',
            type: 'ADJUST',
            method: 'CASH',
            amount: 0,
            reference: '',
          });
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo registrar el movimiento');
        },
      }
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Caja
        </h1>
        <p className="text-sm text-muted-foreground">
          Sesiones de caja
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Wallet className="h-5 w-5 shrink-0" />
                Sesiones
              </CardTitle>
              <CardDescription>
                Listado de sesiones de caja
              </CardDescription>
              {!dashboard.isLoading && (
                <p className="text-sm font-medium text-muted-foreground mt-2 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Ventas del día: {formatMoney(todaySalesTotal)}
                  {todaySalesCount > 0 && (
                    <span className="font-normal">({todaySalesCount} venta{todaySalesCount !== 1 ? 's' : ''})</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpenNewMovement(true);
                  if (openSessions.length > 0) {
                    movementForm.reset({
                      sessionId: openSessions[0].id,
                      type: 'ADJUST',
                      method: 'CASH',
                      amount: 0,
                      reference: '',
                    });
                  }
                }}
                disabled={openSessions.length === 0}
                className="gap-2"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                Registrar movimiento
              </Button>
              <Button
                size="sm"
                onClick={() => setOpenNewSession(true)}
                className="gap-2 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 shrink-0" />
                Abrir sesión
              </Button>
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
                    <TableHead>Apertura</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead className="text-right">Apertura (monto)</TableHead>
                    <TableHead className="text-right">Cierre (monto)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[120px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-4">
              {(query.error as { message?: string })?.message ??
                'Error al cargar sesiones'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apertura</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead className="text-right">Apertura (monto)</TableHead>
                    <TableHead className="text-right">Cierre (monto)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[120px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(s.openedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {s.closedAt ? formatDateTime(s.closedAt) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(s.openingAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {s.closedAt != null ? formatMoney(s.closingAmount) : '—'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            s.closedAt == null
                              ? 'font-medium text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {s.closedAt == null ? 'Abierta' : 'Cerrada'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.closedAt == null ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => {
                              setSessionToClose({
                                id: s.id,
                                openedAt: s.openedAt,
                                openingAmount: s.openingAmount,
                              });
                              closeForm.reset({ closingAmount: Number(s.openingAmount) });
                            }}
                          >
                            <Lock className="h-3.5 w-3" />
                            Cerrar sesión
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay sesiones de caja. Abre una para comenzar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openNewSession} onOpenChange={setOpenNewSession}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Abrir sesión de caja
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onOpenSession)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openingAmount">Monto de apertura (COP)</Label>
              <Input
                id="openingAmount"
                type="number"
                step="1"
                {...form.register('openingAmount')}
                placeholder="100000"
                className="rounded-lg"
              />
              {form.formState.errors.openingAmount && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.openingAmount.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNewSession(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={openSession.isPending}>
                {openSession.isPending ? 'Abriendo…' : 'Abrir sesión'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openNewMovement} onOpenChange={setOpenNewMovement}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Registrar movimiento
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={movementForm.handleSubmit(onMovementSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="movement-sessionId">Sesión de caja</Label>
              <Select
                id="movement-sessionId"
                {...movementForm.register('sessionId')}
                className="w-full"
              >
                <option value="">Selecciona una sesión abierta</option>
                {openSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    Abierta {formatDateTime(s.openedAt)} — {formatMoney(Number(s.openingAmount))}
                  </option>
                ))}
              </Select>
              {movementForm.formState.errors.sessionId && (
                <p className="text-sm text-destructive">
                  {movementForm.formState.errors.sessionId.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select {...movementForm.register('type')} className="w-full">
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de pago</Label>
              <Select {...movementForm.register('method')} className="w-full">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="movement-amount">Monto (COP)</Label>
              <Input
                id="movement-amount"
                type="number"
                step="0.01"
                min={0.01}
                {...movementForm.register('amount')}
                placeholder="50000"
                className="rounded-lg"
              />
              {movementForm.formState.errors.amount && (
                <p className="text-sm text-destructive">
                  {movementForm.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="movement-reference">Motivo (opcional)</Label>
              <Input
                id="movement-reference"
                {...movementForm.register('reference')}
                placeholder="Ej. Ajuste por conteo"
                className="rounded-lg"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNewMovement(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMovement.isPending}>
                {createMovement.isPending ? 'Guardando…' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sessionToClose} onOpenChange={(open) => !open && setSessionToClose(null)}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Cerrar sesión de caja
            </DialogTitle>
            {sessionToClose && (
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <p>
                  Sesión abierta el {formatDateTime(sessionToClose.openedAt)} — Apertura: {formatMoney(Number(sessionToClose.openingAmount))}
                </p>
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Ventas del día: {formatMoney(todaySalesTotal)}
                  {todaySalesCount > 0 && ` (${todaySalesCount} venta${todaySalesCount !== 1 ? 's' : ''})`}
                </p>
                {sessionExpectedAmount != null && (
                  <p className="text-muted-foreground">
                    Monto esperado en caja (apertura + movimientos): <strong className="text-foreground">{formatMoney(sessionExpectedAmount)}</strong>
                  </p>
                )}
                {sessionTotalsByMethod && Object.keys(sessionTotalsByMethod).some((k) => (sessionTotalsByMethod[k] ?? 0) > 0) && (
                  <div className="pt-1.5 border-t border-border mt-1.5">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Movimientos por método de pago:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {(['CASH', 'CARD', 'TRANSFER', 'OTHER'] as const).map(
                        (method) =>
                          (sessionTotalsByMethod[method] ?? 0) > 0 && (
                            <li key={method}>
                              {PAYMENT_METHOD_LABELS[method] ?? method}:{' '}
                              <strong className="text-foreground">{formatMoney(sessionTotalsByMethod[method] ?? 0)}</strong>
                            </li>
                          )
                      )}
                    </ul>
                  </div>
                )}
                <div className="pt-1.5 border-t border-border mt-1.5">
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5" />
                    Gastos del día ({sessionDate ? new Date(sessionDate + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : ''})
                  </p>
                  {expensesTodayQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Cargando…</p>
                  ) : expensesToday.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin gastos registrados.</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Total gastos: {formatMoney(expensesTodayTotal)}
                        {expensesToday.length > 0 && ` (${expensesToday.length} gasto${expensesToday.length !== 1 ? 's' : ''})`}
                      </p>
                      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                        {expensesToday.slice(0, 10).map((e) => (
                          <li key={e.id} className="flex justify-between gap-2">
                            <span className="truncate">{e.description}</span>
                            <span className="tabular-nums shrink-0">{formatMoney(e.amount)}</span>
                          </li>
                        ))}
                        {expensesToday.length > 10 && (
                          <li className="text-muted-foreground/80">+ {expensesToday.length - 10} más</li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogHeader>
          <form onSubmit={closeForm.handleSubmit(onCloseSession)} className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Arqueo de caja
              </p>
              <p className="text-xs text-muted-foreground">
                Cuente el efectivo en caja e ingrese el monto contado. Compare con el monto esperado.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closingAmount">Monto contado en caja (COP)</Label>
              <Input
                id="closingAmount"
                type="number"
                step="1"
                {...closeForm.register('closingAmount')}
                placeholder="Ej. 174034"
                className="rounded-lg"
              />
              {closeForm.formState.errors.closingAmount && (
                <p className="text-sm text-destructive">
                  {closeForm.formState.errors.closingAmount.message}
                </p>
              )}
              {sessionExpectedAmount != null && (() => {
                const counted = Number(closeForm.watch('closingAmount')) || 0;
                const diff = counted - sessionExpectedAmount;
                return (
                  <p className="text-sm">
                    {diff === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Cuadra</span>
                    ) : diff > 0 ? (
                      <span className="text-muted-foreground">
                        Diferencia: <strong className="text-foreground">{formatMoney(diff)}</strong> (sobrante)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Diferencia: <strong className="text-destructive">{formatMoney(-diff)}</strong> (faltante)
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSessionToClose(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={closeSession.isPending}>
                {closeSession.isPending ? 'Cerrando…' : 'Cerrar sesión'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
