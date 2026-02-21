'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, Lightbulb, Eye, CheckCircle, Circle } from 'lucide-react';
import { useProviderFeedback, useUpdateFeedbackStatus } from '@features/provider/hooks';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  READ: 'Leída',
  DONE: 'Resuelta',
};

type StatusFilter = 'PENDING' | 'READ' | 'DONE' | '';

export default function ProviderFeedbackPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const { data: items = [], isLoading } = useProviderFeedback({
    status: statusFilter || undefined,
  });
  const updateStatus = useUpdateFeedbackStatus();

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/provider">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <Lightbulb className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Sugerencias de clientes
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Mejoras e ideas enviadas por usuarios de las empresas. Marca como leída o resuelta.
            </p>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">Filtra por estado</p>
          <div className="flex gap-2 flex-wrap">
            {(['', 'PENDING', 'READ', 'DONE'] as const).map((s) => (
              <Button
                key={s || 'all'}
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {s === '' ? 'Todas' : STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="p-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay sugerencias {statusFilter ? `con estado "${STATUS_LABELS[statusFilter]}"` : ''}.
            </p>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-medium">Empresa</TableHead>
                    <TableHead className="font-medium">Usuario</TableHead>
                    <TableHead className="font-medium">Mensaje</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                    <TableHead className="w-[180px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="border-border/50">
                      <TableCell>
                        <div className="font-medium">{item.tenant.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {item.tenant.slug}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.user.name || item.user.email}</div>
                        <div className="text-xs text-muted-foreground">{item.user.email}</div>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">
                          {item.message}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === 'DONE'
                              ? 'default'
                              : item.status === 'READ'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="text-xs"
                        >
                          {STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 gap-1" asChild>
                            <Link href={`/provider/${item.tenant.id}`}>
                              <Eye className="h-3.5 w-3.5" />
                              Ver empresa
                            </Link>
                          </Button>
                          {item.status !== 'READ' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1"
                              disabled={
                                updateStatus.isPending &&
                                updateStatus.variables?.id === item.id
                              }
                              onClick={() => {
                                updateStatus.mutate(
                                  { id: item.id, status: 'READ' },
                                  {
                                    onSuccess: () =>
                                      toast.success('Marcada como leída.'),
                                    onError: (e: unknown) =>
                                      toast.error(
                                        (e as { message?: string })?.message ??
                                          'Error al actualizar.',
                                      ),
                                  }
                                );
                              }}
                            >
                              <Circle className="h-3.5 w-3.5" />
                              {updateStatus.isPending &&
                              updateStatus.variables?.id === item.id &&
                              updateStatus.variables?.status === 'READ'
                                ? '…'
                                : 'Leída'}
                            </Button>
                          )}
                          {item.status !== 'DONE' && (
                            <Button
                              size="sm"
                              className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                              disabled={
                                updateStatus.isPending &&
                                updateStatus.variables?.id === item.id
                              }
                              onClick={() => {
                                updateStatus.mutate(
                                  { id: item.id, status: 'DONE' },
                                  {
                                    onSuccess: () =>
                                      toast.success('Marcada como resuelta.'),
                                    onError: (e: unknown) =>
                                      toast.error(
                                        (e as { message?: string })?.message ??
                                          'Error al actualizar.',
                                      ),
                                  }
                                );
                              }}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              {updateStatus.isPending &&
                              updateStatus.variables?.id === item.id &&
                              updateStatus.variables?.status === 'DONE'
                                ? '…'
                                : 'Resuelta'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </div>
      </div>
    </div>
  );
}
