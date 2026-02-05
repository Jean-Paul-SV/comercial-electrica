'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
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
import { Database, Plus, Download, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  useBackupsList,
  useCreateBackup,
  useDeleteBackup,
  useVerifyBackup,
  useDownloadBackup,
} from '@features/backups/hooks';
import { formatDateTime } from '@shared/utils/format';

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
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Backups
        </h1>
        <p className="text-sm text-muted-foreground">
          Crear, descargar y gestionar copias de seguridad de la base de datos
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
                <Database className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                Copias de seguridad
              </CardTitle>
              <CardDescription>
                Lista de backups. Solo los completados pueden descargarse.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createBackup.isPending || list.isRefetching}
              className="gap-2 shrink-0"
            >
              <Plus className="h-4 w-4" />
              {createBackup.isPending ? 'Creando…' : 'Nuevo backup'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {list.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}
          {list.isError && (
            <p className="text-sm text-destructive py-4">
              {(list.error as { message?: string })?.message ?? 'Error al cargar backups'}
            </p>
          )}
          {!list.isLoading && !list.isError && (
            <div className="rounded-lg border border-border overflow-hidden">
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
            </div>
          )}
        </CardContent>
      </Card>

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
