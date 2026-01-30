'use client';

import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
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
} from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Pagination } from '@shared/components/Pagination';
import { formatDateTime } from '@shared/utils/format';
import { ClipboardList, Eye } from 'lucide-react';
import { useAuditLogsList } from '@features/audit/hooks';
import type { AuditLog } from '@features/audit/types';

const ENTITY_LABELS: Record<string, string> = {
  expense: 'Gasto',
  sale: 'Venta',
  customer: 'Cliente',
  product: 'Producto',
  supplier: 'Proveedor',
  auth: 'Auth',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Creación',
  update: 'Actualización',
  delete: 'Eliminación',
  access: 'Acceso',
};

function renderDetails(log: AuditLog): React.ReactNode {
  const diff = log.diff;
  if (!diff || typeof diff !== 'object') return '—';

  const parts: string[] = [];
  if (typeof diff.deletionReason === 'string' && diff.deletionReason.trim()) {
    parts.push(`Justificación: ${diff.deletionReason}`);
  }
  if (typeof diff.description === 'string') {
    parts.push(`Descripción: ${diff.description}`);
  }
  if (typeof diff.amount === 'number' || typeof diff.amount === 'string') {
    parts.push(`Monto: ${Number(diff.amount).toLocaleString('es-CO')}`);
  }
  if (parts.length === 0) {
    return Object.keys(diff).length ? JSON.stringify(diff) : '—';
  }
  return parts.join(' · ');
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const limit = 20;
  const params = useMemo(() => ({ page, limit }), [page, limit]);
  const query = useAuditLogsList(params);

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Auditoría
        </h1>
        <p className="text-sm text-muted-foreground">
          Registro de acciones del sistema. En eliminaciones se muestra la justificación.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <ClipboardList className="h-5 w-5 shrink-0" />
            Registro de auditoría
          </CardTitle>
          <CardDescription>
            Listado de logs (creaciones, actualizaciones, eliminaciones). Solo visible para ADMIN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : query.isError ? (
            <p className="text-sm text-destructive">
              No se pudo cargar el registro. Verifica que tengas rol ADMIN.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="max-w-[280px]">Detalles</TableHead>
                    <TableHead className="w-[100px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No hay registros de auditoría.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          {ENTITY_LABELS[log.entity] ?? log.entity}
                        </TableCell>
                        <TableCell>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.actor?.email ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm max-w-[280px] truncate" title={String(renderDetails(log))}>
                          {renderDetails(log)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => setSelectedLog(log)}
                            aria-label="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                            Ver detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Pagination meta={meta} onPageChange={setPage} label="Página" />

              <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent showClose className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Detalles del registro</DialogTitle>
                  </DialogHeader>
                  {selectedLog && (
                    <div className="space-y-4 text-sm">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                        <dt className="text-muted-foreground">Fecha</dt>
                        <dd>{formatDateTime(selectedLog.createdAt)}</dd>
                        <dt className="text-muted-foreground">Entidad</dt>
                        <dd>{ENTITY_LABELS[selectedLog.entity] ?? selectedLog.entity}</dd>
                        <dt className="text-muted-foreground">ID entidad</dt>
                        <dd className="font-mono text-xs break-all">{selectedLog.entityId}</dd>
                        <dt className="text-muted-foreground">Acción</dt>
                        <dd>{ACTION_LABELS[selectedLog.action] ?? selectedLog.action}</dd>
                        <dt className="text-muted-foreground">Usuario</dt>
                        <dd>{selectedLog.actor?.email ?? '—'}</dd>
                      </dl>
                      {selectedLog.diff && typeof selectedLog.diff === 'object' && Object.keys(selectedLog.diff).length > 0 && (
                        <div>
                          <p className="font-medium text-muted-foreground mb-2">Datos (diff)</p>
                          <pre className="rounded-lg border bg-muted/50 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto">
                            {JSON.stringify(selectedLog.diff, null, 2)}
                          </pre>
                        </div>
                      )}
                      {(!selectedLog.diff || (typeof selectedLog.diff === 'object' && Object.keys(selectedLog.diff).length === 0)) && (
                        <p className="text-muted-foreground">Sin datos adicionales.</p>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
