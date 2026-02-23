'use client';

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
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, FileCheck, Eye, CheckCircle } from 'lucide-react';
import { useDianActivationRequests, useMarkDianActivationAsCompleted } from '@features/provider/hooks';
import { toast } from 'sonner';

export default function ProviderDianRequestsPage() {
  const { data: requests = [], isLoading } = useDianActivationRequests();
  const markCompleted = useMarkDianActivationAsCompleted();

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
              <FileCheck className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Solicitudes DIAN
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Empresas que tienen plan con facturación electrónica y solicitan la activación del servicio. Marca como completada cuando hayas cobrado y configurado el certificado.
            </p>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="p-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No hay solicitudes de activación DIAN pendientes.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="font-medium">Empresa</TableHead>
                  <TableHead className="font-medium">Plan</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Fecha solicitud</TableHead>
                  <TableHead className="w-[220px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} className="border-border/50">
                    <TableCell>
                      <div className="font-medium">{req.tenantName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{req.tenantSlug}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {req.planName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(req.requestedAt).toLocaleDateString('es-CO', {
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
                          <Link href={`/provider/${req.tenantId}`}>
                            <Eye className="h-3.5 w-3.5" />
                            Ver empresa
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                          disabled={markCompleted.isPending && markCompleted.variables === req.tenantId}
                          onClick={() => {
                            markCompleted.mutate(req.tenantId, {
                              onSuccess: () =>
                                toast.success('Activación DIAN marcada como completada.'),
                              onError: (e: unknown) =>
                                toast.error(
                                  (e as { message?: string })?.message ?? 'Error al actualizar.',
                                ),
                            });
                          }}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          {markCompleted.isPending && markCompleted.variables === req.tenantId
                            ? '…'
                            : 'Marcar como activada'}
                        </Button>
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
