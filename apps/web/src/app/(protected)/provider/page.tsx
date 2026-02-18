'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import { Badge } from '@shared/components/ui/badge';
import { Label } from '@shared/components/ui/label';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Building2, PlusCircle, Eye, ChevronLeft, ChevronRight, BarChart3, Search, Filter } from 'lucide-react';
import { useListTenants, useTenantsSummary, useDeleteTenant } from '@features/provider/hooks';

const PAGE_SIZE = 20;

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  plan?: { name: string } | null;
  usersCount: number;
  lastActivityAt: string | null;
};

export default function ProviderTenantsPage() {
  const [page, setPage] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const [searchName, setSearchName] = useState('');
  const [searchNumber, setSearchNumber] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [debouncedNumber, setDebouncedNumber] = useState('');
  const [tenantToDelete, setTenantToDelete] = useState<TenantRow | null>(null);

  const deleteTenant = useDeleteTenant();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedName(searchName);
      setDebouncedNumber(searchNumber);
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [searchName, searchNumber]);

  const { data: summary, isLoading: isLoadingSummary } = useTenantsSummary();
  const { data, isLoading, error } = useListTenants({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    isActive: activeFilter,
    searchName: debouncedName || undefined,
    searchNumber: debouncedNumber || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground text-sm">
            Listado de tenants (empresas) de la plataforma.
          </p>
        </div>
        <Button asChild>
          <Link href="/provider/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva empresa
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Empresas totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {isLoadingSummary ? '—' : summary?.totalTenants ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Incluye activas y suspendidas.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Empresas activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {isLoadingSummary ? '—' : summary?.activeTenants ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Con acceso habilitado al sistema.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Empresas suspendidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {isLoadingSummary ? '—' : summary?.suspendedTenants ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              No pueden iniciar sesión hasta reactivarlas.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Usuarios totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {isLoadingSummary ? '—' : summary?.totalUsers ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Usuarios dentro de las empresas (sin contar admins de plataforma).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/60 bg-card/50">
        <CardHeader className="space-y-4 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary/90" />
              Panel proveedor
            </CardTitle>
            <CardDescription className="mt-1">
              Filtrar por estado y ver última actividad.
            </CardDescription>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label htmlFor="search-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Nombre
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="search-name"
                    placeholder="Buscar por nombre..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-9 h-9 bg-background/80 border-border/70 focus-visible:ring-primary/50"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label htmlFor="search-number" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Número / Slug
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="search-number"
                    placeholder="ID o slug de la empresa"
                    value={searchNumber}
                    onChange={(e) => setSearchNumber(e.target.value)}
                    className="pl-9 h-9 bg-background/80 border-border/70 focus-visible:ring-primary/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Estado:</span>
              <div className="inline-flex rounded-lg border border-border/50 bg-muted/30 p-0.5" role="group">
                <Button
                  variant={activeFilter === undefined ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-md h-8 px-3"
                  onClick={() => {
                    setActiveFilter(undefined);
                    setPage(0);
                  }}
                >
                  Todas
                </Button>
                <Button
                  variant={activeFilter === 'true' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-md h-8 px-3"
                  onClick={() => {
                    setActiveFilter('true');
                    setPage(0);
                  }}
                >
                  Activas
                </Button>
                <Button
                  variant={activeFilter === 'false' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-md h-8 px-3"
                  onClick={() => {
                    setActiveFilter('false');
                    setPage(0);
                  }}
                >
                  Suspendidas
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {error && (
            <p className="text-destructive text-sm py-4">
              {(error as { message?: string })?.message ?? 'Error al cargar empresas.'}
            </p>
          )}
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="font-semibold text-muted-foreground">Nombre</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Slug</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Estado</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Plan</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Usuarios</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Última actividad</TableHead>
                      <TableHead className="w-[72px] font-semibold text-muted-foreground"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                          No hay empresas que coincidan con los filtros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((t) => (
                        <TableRow key={t.id} className="border-border/50 transition-colors">
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-sm">{t.slug}</TableCell>
                          <TableCell>
                            <Badge variant={t.isActive ? 'default' : 'secondary'} className="font-medium">
                              {t.isActive ? 'Activa' : 'Suspendida'}
                            </Badge>
                          </TableCell>
                          <TableCell>{t.plan?.name ?? '—'}</TableCell>
                          <TableCell className="tabular-nums">{t.usersCount}</TableCell>
                          <TableCell className="text-muted-foreground text-sm tabular-nums">
                            {t.lastActivityAt
                              ? new Date(t.lastActivityAt).toLocaleString()
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link href={`/provider/${t.id}`}>
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">Ver detalle</span>
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground order-2 sm:order-1">
                    <span className="font-medium text-foreground">{total}</span> empresa(s) · página {page + 1} de {totalPages}
                  </p>
                  <div className="flex gap-2 order-1 sm:order-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="gap-1"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <DialogContent showClose>
          <DialogHeader>
            <DialogTitle>Eliminar empresa</DialogTitle>
            <DialogDescription>
              ¿Eliminar la empresa &quot;{tenantToDelete?.name}&quot;? Se borrarán todos los datos
              (ventas, productos, clientes, etc.) y los usuarios quedarán desactivados. Esta acción
              no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTenantToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteTenant.isPending}
              onClick={() => {
                if (!tenantToDelete) return;
                deleteTenant.mutate(tenantToDelete.id, {
                  onSuccess: () => setTenantToDelete(null),
                });
              }}
            >
              {deleteTenant.isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
