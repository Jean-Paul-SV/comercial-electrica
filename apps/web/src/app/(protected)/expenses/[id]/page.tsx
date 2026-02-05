'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
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
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !expense) {
    return (
      <div className="space-y-6">
        <Link href="/expenses">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a gastos
          </Button>
        </Link>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {(error as { message?: string })?.message ?? 'Gasto no encontrado.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const amount = Number(expense.amount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/expenses">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a gastos
          </Button>
        </Link>
        {expense.cashSessionId && (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/cash">
              <Wallet className="h-4 w-4" />
              Ver caja
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Detalle del gasto
        </h1>
        <p className="text-sm text-muted-foreground">
          {expense.description} · {formatMoney(amount)}
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
              <Receipt className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              {expense.description}
            </CardTitle>
            <Badge variant="secondary" className="text-base font-semibold">
              {formatMoney(amount)}
            </Badge>
          </div>
          <CardDescription>
            {formatDate(expense.expenseDate)} · {PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
