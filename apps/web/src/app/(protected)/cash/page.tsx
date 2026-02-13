'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
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
import { EmptyState } from '@shared/components/EmptyState';
import { formatMoney, formatDateTime } from '@shared/utils/format';
import { getErrorMessage } from '@shared/utils/errors';
import { useHasPermission } from '@shared/hooks/useHasPermission';
import { Wallet, Plus, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Lock, TrendingUp, Calculator, Receipt } from 'lucide-react';
import { useCashSessionsList, useOpenCashSession, useCloseCashSession, useSessionMovements } from '@features/cash/hooks';
import { useDashboard, useCashReport } from '@features/reports/hooks';

const openSessionSchema = z.object({
  openingAmount: z.coerce.number().min(0, 'Monto >= 0'),
});
type OpenSessionFormValues = z.infer<typeof openSessionSchema>;

const closeSessionSchema = z.object({
  closingAmount: z.coerce.number().refine((v) => Number.isFinite(v), 'Monto inválido'),
});
type CloseSessionFormValues = z.infer<typeof closeSessionSchema>;

const MOVEMENT_TYPES: { value: 'IN' | 'OUT' | 'ADJUST'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'IN', label: 'Entrada', icon: ArrowDownToLine },
  { value: 'OUT', label: 'Salida', icon: ArrowUpFromLine },
  { value: 'ADJUST', label: 'Ajuste', icon: SlidersHorizontal },
];

export default function CashPage() {
  const hasCashCreate = useHasPermission('cash:create');
  const hasCashUpdate = useHasPermission('cash:update');
  const [page, setPage] = useState(1);
  const [openNewSession, setOpenNewSession] = useState(false);
  const [sessionToClose, setSessionToClose] = useState<{ id: string; openedAt: string; openingAmount: number | string } | null>(null);
  const limit = 20;
  const query = useCashSessionsList({ page, limit });
  const dashboard = useDashboard();
  const cashReportForSession = useCashReport(
    sessionToClose ? { sessionId: sessionToClose.id } : {}
  );
  const openSession = useOpenCashSession();
  const closeSession = useCloseCashSession();
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

  const sessionMovementsQuery = useSessionMovements(
    sessionToClose?.id ?? null,
    { page: 1, limit: 50 }
  );
  const sessionMovements = useMemo(() => sessionMovementsQuery.data?.data ?? [], [sessionMovementsQuery.data]);

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
        onError: (e: unknown) => {
          toast.error(getErrorMessage(e, 'No se pudo cerrar la sesión'));
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
        onError: (e: unknown) => {
          toast.error(getErrorMessage(e, 'No se pudo abrir la sesión'));
        },
      }
    );
  };

  const totalSessions = meta?.total ?? 0;
  const hasData = rows.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Caja
        </h1>
        <p className="text-sm text-muted-foreground">
          Sesiones de caja
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3">
              <div>
                <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
                  <Wallet className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  Sesiones
                </CardTitle>
                <CardDescription>
                  {hasData
                    ? `${totalSessions} sesión${totalSessions !== 1 ? 'es' : ''} de caja`
                    : 'Listado de sesiones de caja'}
                </CardDescription>
              </div>
              {!dashboard.isLoading && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary shrink-0" aria-hidden />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        Ventas del día:
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        {formatMoney(todaySalesTotal)}
                      </span>
                      {todaySalesCount > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ({todaySalesCount} venta{todaySalesCount !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button size="sm" variant="outline" asChild className="gap-2">
                <Link href="/cash/movements">
                  <Receipt className="h-4 w-4 shrink-0" />
                  Movimientos de caja
                </Link>
              </Button>
              {hasCashCreate && (
                <Button
                  size="sm"
                  onClick={() => setOpenNewSession(true)}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Abrir sesión
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {query.isLoading && (
            <div className="rounded-lg border border-border/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-muted-foreground">Apertura</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Cierre</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Apertura (monto)</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Cierre (monto)</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                    <TableHead className="w-[120px] text-right font-medium text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">
                {getErrorMessage(query.error, 'Error al cargar sesiones')}
              </p>
            </div>
          )}

          {!query.isLoading && !query.isError && (
            <>
              <div className="rounded-lg border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="font-medium text-muted-foreground">Apertura</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Cierre</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">Apertura (monto)</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">Cierre (monto)</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                      <TableHead className="w-[120px] text-right font-medium text-muted-foreground">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((s) => (
                      <TableRow
                        key={s.id}
                        className="transition-colors hover:bg-muted/40"
                      >
                        <TableCell className="text-sm text-foreground">
                          {formatDateTime(s.openedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.closedAt ? formatDateTime(s.closedAt) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-foreground">
                          {formatMoney(s.openingAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {s.closedAt != null ? formatMoney(s.closingAmount) : '—'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              s.closedAt == null
                                ? 'inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                                : 'text-muted-foreground text-sm'
                            }
                          >
                            {s.closedAt == null ? 'Abierta' : 'Cerrada'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {s.closedAt == null && hasCashUpdate ? (
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
                          ) : s.closedAt == null ? (
                            <span className="text-xs text-muted-foreground">Sin permiso</span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0 align-top">
                          <EmptyState
                            message="No hay sesiones de caja"
                            description="Abre una sesión para registrar ventas y movimientos de efectivo."
                            icon={Wallet}
                            action={
                              hasCashCreate ? (
                                <Button
                                  size="sm"
                                  onClick={() => setOpenNewSession(true)}
                                  className="gap-2"
                                >
                                  <Plus className="h-4 w-4" />
                                  Abrir sesión
                                </Button>
                              ) : undefined
                            }
                            className="py-16"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {meta && (meta.total > 0 || meta.totalPages > 1) && (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {meta.total > 0
                      ? `Mostrando ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}`
                      : '0 resultados'}
                  </p>
                  <Pagination meta={meta} onPageChange={setPage} label="Página" />
                </div>
              )}
            </>
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
            <p className="text-sm text-muted-foreground pt-1">
              Indica el efectivo con el que inicias el turno. Este monto será el saldo inicial de la sesión; las ventas y movimientos se sumarán o restarán a partir de aquí.
            </p>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onOpenSession)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openingAmount">Monto de apertura (COP)</Label>
              <Input
                id="openingAmount"
                type="number"
                step="1"
                min="0"
                {...form.register('openingAmount')}
                placeholder="Ej. 0 o 100000"
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">
                Puedes usar 0 si no dejas efectivo inicial en caja.
              </p>
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

      <Dialog open={!!sessionToClose} onOpenChange={(open) => !open && setSessionToClose(null)}>
        <DialogContent showClose className="sm:max-w-xl rounded-2xl border-border/80 shadow-xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Lock className="h-4 w-4" />
              </span>
              Cerrar sesión de caja
            </DialogTitle>
            {sessionToClose && (
              <div className="space-y-1.5 text-sm text-muted-foreground min-w-0">
                <p>
                  Sesión abierta el {formatDateTime(sessionToClose.openedAt)} — Apertura: {formatMoney(Number(sessionToClose.openingAmount))}
                </p>
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  Ventas del día: {formatMoney(todaySalesTotal)}
                  {todaySalesCount > 0 && ` (${todaySalesCount} venta${todaySalesCount !== 1 ? 's' : ''})`}
                </p>
                {sessionExpectedAmount != null && (
                  <>
                    <p className="text-muted-foreground">
                      Monto esperado en caja (apertura + movimientos): <strong className={sessionExpectedAmount < 0 ? 'text-destructive' : 'text-foreground'}>{formatMoney(sessionExpectedAmount)}</strong>
                    </p>
                    {sessionExpectedAmount < 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 rounded-lg px-2.5 py-1.5 border border-amber-500/20">
                        Es normal si hubo más salidas (gastos, retiros) que entradas (ventas en efectivo). Puedes cerrar con este monto negativo; el sistema lo permite.
                      </p>
                    )}
                  </>
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
                <div className="pt-1.5 border-t border-border mt-1.5 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                    Movimientos de la sesión
                  </p>
                  <p className="text-xs text-muted-foreground/90 mb-1.5">
                    Incluye entradas (ventas), salidas (gastos) y ajustes.
                  </p>
                  {sessionMovementsQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Cargando…</p>
                  ) : sessionMovements.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin movimientos (ventas, gastos ni ajustes en esta sesión).</p>
                  ) : (
                    <ul className="text-xs text-muted-foreground space-y-0.5 max-h-40 overflow-y-auto overflow-x-hidden">
                      {sessionMovements.slice(0, 25).map((m) => {
                        const label =
                          m.relatedExpense?.description ??
                          m.relatedSale?.invoices?.[0]?.number ??
                          (m.relatedSaleId ? 'Venta' : null) ??
                          m.reference ??
                          '—';
                        return (
                          <li key={m.id} className="flex justify-between gap-2 min-w-0">
                            <span className="min-w-0 break-words pr-2">
                              {MOVEMENT_TYPES.find((t) => t.value === m.type)?.label ?? m.type}: {label}
                            </span>
                            <span className={`tabular-nums shrink-0 ${m.type === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : m.type === 'OUT' ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                              {m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : '±'}{formatMoney(m.amount)}
                            </span>
                          </li>
                        );
                      })}
                      {sessionMovements.length > 25 && (
                        <li className="text-muted-foreground/80">+ {sessionMovements.length - 25} más</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </DialogHeader>
          <form onSubmit={closeForm.handleSubmit(onCloseSession)} className="space-y-4 pt-1 min-w-0">
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 border-l-4 border-l-primary/50 min-w-0">
              <p className="text-sm font-medium flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 shrink-0 text-primary" />
                Arqueo de caja
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cuente el efectivo en caja e ingrese el monto contado. Compare con el monto esperado.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closingAmount" className="text-foreground font-medium">Monto contado en caja (COP)</Label>
              <Input
                id="closingAmount"
                type="number"
                step="1"
                {...closeForm.register('closingAmount')}
                placeholder="Ej. 174034"
                className="rounded-xl h-10 border-input bg-background/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                      <span className="text-success font-medium">Cuadra</span>
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
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSessionToClose(null)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={closeSession.isPending} className="rounded-xl font-medium">
                {closeSession.isPending ? 'Cerrando…' : 'Cerrar sesión'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
