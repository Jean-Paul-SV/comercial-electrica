'use client';

import { useMemo, useState, useEffect } from 'react';
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
} from '@shared/components/ui/dialog';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Pagination } from '@shared/components/Pagination';
import { toast } from 'sonner';
import { formatDateTime } from '@shared/utils/format';
import { ClipboardList, Eye, ShieldCheck } from 'lucide-react';
import { useAuditLogsList, useVerifyAuditChain } from '@features/audit/hooks';
import type { AuditLog } from '@features/audit/types';

const SEARCH_DEBOUNCE_MS = 300;

const ENTITY_LABELS: Record<string, string> = {
  expense: 'Gasto',
  sale: 'Venta',
  quote: 'Cotización',
  saleReturn: 'Devolución',
  customer: 'Cliente',
  product: 'Producto',
  category: 'Categoría',
  supplier: 'Proveedor',
  supplierInvoice: 'Factura proveedor',
  supplierPayment: 'Pago proveedor',
  inventoryMovement: 'Movimiento inventario',
  cashSession: 'Sesión caja',
  cashMovement: 'Movimiento caja',
  auth: 'Auth',
  dianDocument: 'Documento DIAN',
  backupRun: 'Backup',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Creación',
  update: 'Actualización',
  delete: 'Eliminación',
  access: 'Acceso',
  login: 'Login',
  logout: 'Logout',
  login_failed: 'Login fallido',
  convert: 'Convertir',
  update_status: 'Cambio estado',
  expire_batch: 'Expiración (cron)',
  status_update: 'Cambio estado',
};

function renderDetailsSummary(log: AuditLog): string {
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

/** Formatea el diff para mostrar en el modal: claves conocidas en texto y JSON completo legible. */
function formatDiffForDisplay(diff: Record<string, unknown>): { summaryLines: string[]; hasMore: boolean } {
  const summaryLines: string[] = [];
  if (typeof diff.deletionReason === 'string' && diff.deletionReason.trim()) {
    summaryLines.push(`Justificación: ${diff.deletionReason}`);
  }
  if (typeof diff.description === 'string') {
    summaryLines.push(`Descripción: ${diff.description}`);
  }
  if (typeof diff.amount === 'number' || typeof diff.amount === 'string') {
    summaryLines.push(`Monto: ${Number(diff.amount).toLocaleString('es-CO')}`);
  }
  const knownKeys = new Set(['deletionReason', 'description', 'amount']);
  const hasOtherKeys = Object.keys(diff).some((k) => !knownKeys.has(k));
  return { summaryLines, hasMore: hasOtherKeys };
}

const ENTITY_OPTIONS = Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }));
const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }));

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    totalChecked: number;
    totalWithHash: number;
    brokenAt?: string;
    errors: string[];
  } | null>(null);

  const limit = 20;
  const verifyChain = useVerifyAuditChain();

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      entity: entityFilter || undefined,
      action: actionFilter || undefined,
      startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
      endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
    }),
    [page, limit, search, entityFilter, actionFilter, startDate, endDate],
  );
  const query = useAuditLogsList(params);

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;

  const hasActiveFilters = Boolean(
    searchInput.trim() || entityFilter || actionFilter || startDate || endDate,
  );

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setEntityFilter('');
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const runVerifyChain = () => {
    setVerifyResult(null);
    verifyChain.mutate(undefined, {
      onSuccess: (data) => {
        setVerifyResult(data);
        if (data?.valid) {
          toast.success('Cadena de integridad verificada correctamente');
        } else {
          toast.warning('La cadena presenta inconsistencias. Revisa el resultado.');
        }
      },
      onError: (e) => {
        setVerifyResult({
          valid: false,
          totalChecked: 0,
          totalWithHash: 0,
          errors: ['Error al conectar con el servidor.'],
        });
        toast.error((e as Error)?.message ?? 'Error al verificar la cadena');
      },
    });
  };

  const totalLogs = meta?.total ?? 0;
  const hasData = rows.length > 0;

  return (
    <div className="space-y-10">
      <header className="pt-2 pb-2">
        <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <ClipboardList className="h-7 w-7 shrink-0 text-primary" aria-hidden />
          Auditoría
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Registro de acciones del sistema. En eliminaciones se muestra la justificación.
        </p>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="p-6 pb-4 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-lg font-medium text-foreground flex items-center gap-2">
                <ClipboardList className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                Registro de auditoría
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {hasData
                  ? `${totalLogs} registro${totalLogs !== 1 ? 's' : ''}`
                  : 'Listado de logs (creaciones, actualizaciones, eliminaciones). Cadena de integridad para inmutabilidad.'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 rounded-xl"
              onClick={runVerifyChain}
              disabled={verifyChain.isPending}
              aria-label="Verificar cadena de integridad"
            >
              <ShieldCheck className="h-4 w-4" />
              {verifyChain.isPending ? 'Verificando…' : 'Verificar cadena'}
            </Button>
          </div>
        </div>
        <div className="p-6 pt-4">
          {query.isLoading ? (
            <div className="rounded-lg border border-border/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Entidad</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Acción</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Usuario</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Detalles</TableHead>
                    <TableHead className="w-[100px] text-right font-medium text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-48 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : query.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">
                No se pudo cargar el registro. Verifica que tengas rol ADMIN.
              </p>
            </div>
          ) : (
            <>
              {verifyResult && (
                <div
                  className={`mb-4 rounded-lg border p-4 text-sm ${
                    verifyResult.valid
                      ? 'border-success/40 bg-success/10'
                      : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <p className="font-medium flex items-center gap-2">
                    <ShieldCheck className={`h-4 w-4 shrink-0 ${verifyResult.valid ? 'text-success' : 'text-destructive'}`} />
                    {verifyResult.valid
                      ? 'Cadena de integridad correcta'
                      : 'Cadena de integridad alterada'}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Revisados {verifyResult.totalChecked} registros, {verifyResult.totalWithHash} con hash.
                    {verifyResult.brokenAt && (
                      <span className="block mt-1">Primera inconsistencia en registro: {verifyResult.brokenAt}</span>
                    )}
                  </p>
                  {verifyResult.errors.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-destructive">
                      {verifyResult.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="rounded-lg border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Entidad</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Acción</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Usuario</TableHead>
                      <TableHead className="min-w-[200px] max-w-[360px] font-medium text-muted-foreground">Detalles</TableHead>
                      <TableHead className="w-[120px] text-right font-medium text-muted-foreground">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                          No hay registros de auditoría.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((log) => (
                        <TableRow key={log.id} className="transition-colors hover:bg-muted/40">
                          <TableCell className="whitespace-nowrap text-sm text-foreground">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {ENTITY_LABELS[log.entity] ?? log.entity}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {ACTION_LABELS[log.action] ?? log.action}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.actor?.email ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm min-w-[200px] max-w-[360px] align-top">
                            <span
                              className="line-clamp-2 text-muted-foreground break-words"
                              title={log.summary ?? String(renderDetailsSummary(log))}
                            >
                              {log.summary ?? renderDetailsSummary(log)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                              onClick={() => setSelectedLog(log)}
                              aria-label="Ver detalles completos"
                            >
                              <Eye className="h-4 w-4 shrink-0" />
                              Ver detalles
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {meta && (meta.total > 0 || meta.totalPages > 1) && (
                <div className="flex items-center justify-between gap-4 flex-wrap mt-4">
                  <p className="text-xs text-muted-foreground">
                    {meta.total > 0
                      ? `Mostrando ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}`
                      : '0 resultados'}
                  </p>
                  <Pagination meta={meta} onPageChange={setPage} label="Página" />
                </div>
              )}

              <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent showClose className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Detalles del registro</DialogTitle>
                  </DialogHeader>
                  {selectedLog && (
                    <div className="space-y-4 text-sm overflow-y-auto flex-1 min-h-0 pr-1">
                      <dl className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2.5">
                        <dt className="text-muted-foreground font-medium">Fecha</dt>
                        <dd className="text-foreground">{formatDateTime(selectedLog.createdAt)}</dd>
                        {selectedLog.summary && (
                          <>
                            <dt className="text-muted-foreground font-medium">Resumen</dt>
                            <dd className="text-foreground">{selectedLog.summary}</dd>
                          </>
                        )}
                        <dt className="text-muted-foreground font-medium">Entidad</dt>
                        <dd className="text-foreground">{ENTITY_LABELS[selectedLog.entity] ?? selectedLog.entity}</dd>
                        <dt className="text-muted-foreground font-medium">ID entidad</dt>
                        <dd className="font-mono text-xs break-all text-foreground">{selectedLog.entityId}</dd>
                        <dt className="text-muted-foreground font-medium">Acción</dt>
                        <dd className="text-foreground">{ACTION_LABELS[selectedLog.action] ?? selectedLog.action}</dd>
                        <dt className="text-muted-foreground font-medium">Usuario</dt>
                        <dd className="text-foreground">{selectedLog.actor?.email ?? '—'}</dd>
                      </dl>
                      {selectedLog.diff && typeof selectedLog.diff === 'object' && Object.keys(selectedLog.diff).length > 0 && (() => {
                        const { summaryLines, hasMore } = formatDiffForDisplay(selectedLog.diff as Record<string, unknown>);
                        return (
                          <div className="space-y-3">
                            <p className="font-medium text-muted-foreground">Datos del cambio</p>
                            {summaryLines.length > 0 && (
                              <ul className="list-none space-y-1.5 text-foreground">
                                {summaryLines.map((line, i) => (
                                  <li key={i} className="leading-relaxed">{line}</li>
                                ))}
                              </ul>
                            )}
                            {hasMore && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">JSON completo</p>
                                <pre className="rounded-lg border border-border/80 bg-muted/30 p-4 text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words max-h-[320px] overflow-y-auto">
                                  {JSON.stringify(selectedLog.diff, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {(!selectedLog.diff || (typeof selectedLog.diff === 'object' && Object.keys(selectedLog.diff).length === 0)) && (
                        <p className="text-muted-foreground">Sin datos adicionales.</p>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
