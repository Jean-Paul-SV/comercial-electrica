'use client';

import { useState } from 'react';
import { Button } from '@shared/components/ui/button';
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
import { Badge } from '@shared/components/ui/badge';
import Link from 'next/link';
import { Database, Plus, Download, Trash2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  useBackupsList,
  useCreateBackup,
  useDeleteBackup,
  useVerifyBackup,
  useDownloadBackup,
} from '@features/backups/hooks';
import { formatDateTime } from '@shared/utils/format';
import { useAuth } from '@shared/providers/AuthProvider';

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  IN_PROGRESS: 'secondary',
  COMPLETED: 'default',
  FAILED: 'destructive',
};

export default function BackupsPage() {
  useAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const list = useBackupsList();
  const createBackup = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const verifyBackup = useVerifyBackup();
  const downloadBackup = useDownloadBackup();

  const backups = list.data ?? [];

  const handleCreate = () => {
    createBackup.mutate(undefined, {
      onSuccess: () => {
        toast.success('Backup iniciado. Se completará en unos segundos.');
      },
      onError: (e) => {
        toast.error((e as Error)?.message ?? 'No se pudo crear el backup');
      },
    });
  };

  const handleDownload = (id: string) => {
    downloadBackup.mutate(id, {
      onSuccess: () => toast.success('Descarga iniciada'),
      onError: (e) =>
        toast.error((e as Error)?.message ?? 'No se pudo descargar el backup'),
    });
  };

  const handleVerify = (id: string) => {
    verifyBackup.mutate(id, {
      onSuccess: (data) => {
        toast.success(data.isValid ? 'Backup íntegro' : 'Backup corrupto o no disponible');
      },
      onError: (e) =>
        toast.error((e as Error)?.message ?? 'No se pudo verificar'),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteBackup.mutate(deleteId, {
      onSuccess: () => {
        toast.success('Backup eliminado');
        setDeleteId(null);
      },
      onError: (e) => {
        toast.error((e as Error)?.message ?? 'No se pudo eliminar');
      },
    });
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-2 pb-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0 rounded-lg">
            <Link href="/app">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver al inicio</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <Database className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Backups
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Crear y descargar copias de seguridad de los datos de tu empresa (CSV en ZIP). Solo los completados pueden descargarse.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={handleCreate}
          disabled={createBackup.isPending || list.isRefetching}
          className="gap-2 shrink-0 rounded-xl bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {createBackup.isPending ? 'Creando…' : 'Nuevo backup'}
        </Button>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
          {list.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}
          {list.isError && (
            <p className="text-sm text-destructive py-8 px-6">
              {(list.error as { message?: string })?.message ?? 'Error al cargar backups'}
            </p>
          )}
          {!list.isLoading && !list.isError && (
            <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-medium">Fecha</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="font-medium">Finalizado</TableHead>
                    <TableHead className="w-[1%] whitespace-nowrap text-right font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b) => (
                    <TableRow key={b.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(b.startedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[b.status] ?? 'outline'}>
                          {STATUS_LABELS[b.status] ?? b.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {b.finishedAt ? formatDateTime(b.finishedAt) : '—'}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {b.status === 'COMPLETED' && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5 mr-1"
                              onClick={() => handleDownload(b.id)}
                              disabled={downloadBackup.isPending}
                              title="Descargar backup (CSV en ZIP para tu empresa)"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Descargar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 mr-1"
                              onClick={() => handleVerify(b.id)}
                              disabled={verifyBackup.isPending}
                              title="Verificar integridad"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteId(b.id)}
                              disabled={deleteBackup.isPending}
                              title="Eliminar backup"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {b.status !== 'COMPLETED' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(b.id)}
                            disabled={deleteBackup.isPending}
                            title="Eliminar backup"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {backups.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay backups. Crea uno para comenzar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
          )}
      </div>

      <Dialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar backup</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar este backup? El archivo se borrará del servidor y no podrás recuperarlo.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteBackup.isPending}
            >
              {deleteBackup.isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
