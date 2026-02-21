'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, Receipt, Wallet } from 'lucide-react';
import { useExpense } from '@features/expenses/hooks';
import { formatMoney, formatDate } from '@shared/utils/format';

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

const KIND_LABELS: Record<string, string> = {
  FIXED: 'Fijo',
  VARIABLE: 'Variable',
  OTHER: 'Otros',
};

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: expense, isLoading, isError, error } = useExpense(id);

  if (!id) {
    router.replace('/expenses');
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-10">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
          <Skeleton className="h-5 w-full mt-4" />
          <Skeleton className="h-5 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !expense) {
    return (
      <div className="space-y-10">
        <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
          <Link href="/expenses">
            <ArrowLeft className="h-4 w-4" />
            Volver a gastos
          </Link>
        </Button>
        <div className="rounded-2xl border border-destructive/50 bg-card p-6">
          <p className="text-sm text-destructive">
            {(error as { message?: string })?.message ?? 'Gasto no encontrado.'}
          </p>
        </div>
      </div>
    );
  }

  const amount = Number(expense.amount);

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Receipt className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Gasto
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDate(expense.expenseDate ?? expense.createdAt)} · {formatMoney(amount)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
            <Link href="/expenses">
              <ArrowLeft className="h-4 w-4" />
              Volver a gastos
            </Link>
          </Button>
          {expense.cashSessionId && (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/cash">
              <Wallet className="h-4 w-4" />
              Ver caja
            </Link>
          </Button>
          )}
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="pb-4 border-b border-border/60 px-6 pt-6 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-medium text-foreground">{expense.description}</h2>
          <Badge variant="secondary" className="text-base font-semibold">
            {formatMoney(amount)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground px-6 pt-1 pb-4">
          {formatDate(expense.expenseDate)} · {PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod}
        </p>
        <div className="pt-4 px-6 pb-6 space-y-4 border-t border-border/60">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Monto</dt>
              <dd className="text-sm font-semibold text-foreground">{formatMoney(amount)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Fecha</dt>
              <dd className="text-sm text-foreground">{formatDate(expense.expenseDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Descripción</dt>
              <dd className="text-sm text-foreground">{expense.description}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Forma de pago</dt>
              <dd className="text-sm text-foreground">{PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod}</dd>
            </div>
            {expense.category && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Categoría</dt>
                <dd className="text-sm text-foreground">{expense.category}</dd>
              </div>
            )}
            {expense.kind && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Tipo</dt>
                <dd className="text-sm text-foreground">{KIND_LABELS[expense.kind] ?? expense.kind}</dd>
              </div>
            )}
            {expense.reference && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Referencia</dt>
                <dd className="text-sm text-foreground">{expense.reference}</dd>
              </div>
            )}
            {expense.cashSession && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Sesión de caja</dt>
                <dd className="text-sm text-foreground">
                  <Link href="/cash" className="text-primary hover:underline">
                    {formatDate(expense.cashSession.openedAt)}
                    {expense.cashSession.closedAt ? ` — Cerrada` : ' — Abierta'}
                  </Link>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Creado</dt>
              <dd className="text-sm text-foreground">{formatDate(expense.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Actualizado</dt>
              <dd className="text-sm text-foreground">{formatDate(expense.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
