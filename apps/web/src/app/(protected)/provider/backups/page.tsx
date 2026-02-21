'use client';

import Link from 'next/link';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import { Skeleton } from '@shared/components/ui/skeleton';
import {
  ArrowLeft,
  Database,
  AlertTriangle,
} from 'lucide-react';
import {
  useBackupsMetadata,
  useBackupsStatistics,
  useBackupsAlerts,
} from '@features/provider/hooks';
import { formatDateTime } from '@shared/utils/format';

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
};

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  IN_PROGRESS: 'secondary',
  COMPLETED: 'default',
  FAILED: 'destructive',
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

export default function ProviderBackupsPage() {
  const { data: backups, isLoading: backupsLoading, error: backupsError } = useBackupsMetadata(100);
  const { data: stats, isLoading: statsLoading, error: statsError } = useBackupsStatistics();
  const { data: alerts, isLoading: alertsLoading, error: alertsError } = useBackupsAlerts();

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
              <Database className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Metadatos de Backups
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Información de backups para monitoreo y análisis. Solo metadatos,
              sin acceso al contenido.
            </p>
          </div>
        </div>
      </header>

      {/* Alertas */}
      {alertsLoading ? (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <p className="text-lg font-medium text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Alertas
          </p>
          <div className="mt-4">
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      ) : alerts && alerts.length > 0 ? (
        <div className="rounded-2xl border border-destructive/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <p className="text-lg font-medium text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Alertas ({alerts.length})
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Problemas detectados que requieren atención
          </p>
          <div className="mt-4">
            <div className="space-y-2">
              {alerts.slice(0, 10).map((alert, idx) => (
                <div
                  key={alert.backupId ?? idx}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    alert.severity === 'error'
                      ? 'border-destructive/50 bg-destructive/5'
                      : 'border-amber-500/50 bg-amber-500/5'
                  }`}
                >
                  <AlertTriangle
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      alert.severity === 'error'
                        ? 'text-destructive'
                        : 'text-amber-600'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {alert.message}
                    </p>
                    {alert.tenantName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Empresa: {alert.tenantName}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {alerts.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Mostrando 10 de {alerts.length} alertas
                </p>
              )}
            </div>
          </div>
        </div>
      ) : alerts && alerts.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <p className="text-lg font-medium text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Alertas
          </p>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay alertas. Todo está funcionando correctamente.
            </p>
          </div>
        </div>
      ) : null}

      {/* Estadísticas */}
      {statsError ? (
        <div className="rounded-2xl border border-destructive/50 bg-card shadow-sm p-6 dark:border-[#1F2937]">
          <p className="text-sm text-destructive text-center">
            Error al cargar estadísticas. Intenta recargar la página.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
            <p className="text-sm font-medium text-muted-foreground">Adopción</p>
            <div className="mt-3">
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.adoptionRate ?? 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.tenantsWithBackups ?? 0} de{' '}
                    {stats?.totalTenants ?? 0} empresas
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
            <p className="text-sm font-medium text-muted-foreground">Tasa de éxito</p>
            <div className="mt-3">
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.successRate ?? 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.completedBackups ?? 0} completados,{' '}
                    {stats?.failedBackups ?? 0} fallidos (30 días)
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
            <p className="text-sm font-medium text-muted-foreground">Promedio por empresa</p>
            <div className="mt-3">
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.averageBackupsPerTenant ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Backups por empresa (30 días)
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
            <p className="text-sm font-medium text-muted-foreground">Tamaño promedio</p>
            <div className="mt-3">
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatBytes(stats?.averageSize ?? null)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Duración: {formatDuration(stats?.averageDuration ?? null)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backups recientes */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="p-6 pb-3">
          <p className="text-lg font-medium text-foreground">Backups recientes</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Últimos 100 backups con información del tenant y estadísticas básicas
          </p>
        </div>
        <div className="p-6 pt-0">
          {backupsError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Error al cargar backups. Intenta recargar la página.
            </p>
          ) : backupsLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : !backups || backups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay backups registrados.
            </p>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-medium">Empresa</TableHead>
                    <TableHead className="font-medium">Plan</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="font-medium">Fecha</TableHead>
                    <TableHead className="font-medium text-right">Tamaño</TableHead>
                    <TableHead className="font-medium text-right">Duración</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.id} className="border-border/50">
                      <TableCell>
                        <Link
                          href={`/provider/${backup.tenantId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {backup.tenantName}
                        </Link>
                        <div className="text-xs text-muted-foreground font-mono">
                          {backup.tenantSlug}
                        </div>
                      </TableCell>
                      <TableCell>
                        {backup.planName ? (
                          <Badge variant="secondary" className="text-xs">
                            {backup.planName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            STATUS_VARIANT[backup.status] ?? 'outline'
                          }
                          className="text-xs"
                        >
                          {STATUS_LABELS[backup.status] ?? backup.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(backup.startedAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatBytes(backup.fileSize)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatDuration(backup.duration)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
