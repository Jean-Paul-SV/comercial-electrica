'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Building2, PlusCircle, Eye, ChevronLeft, BarChart3 } from 'lucide-react';
import { useListTenants, useTenantsSummary } from '@features/provider/hooks';

const PAGE_SIZE = 20;

export default function ProviderTenantsPage() {
  const [page, setPage] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);

  const { data: summary, isLoading: isLoadingSummary } = useTenantsSummary();
  const { data, isLoading, error } = useListTenants({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    isActive: activeFilter,
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Panel proveedor
          </CardTitle>
          <CardDescription>
            Filtrar por estado y ver última actividad.
          </CardDescription>
          <div className="flex gap-2 pt-2">
            <Button
              variant={activeFilter === undefined ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveFilter(undefined);
                setPage(0);
              }}
            >
              Todas
            </Button>
            <Button
              variant={activeFilter === 'true' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveFilter('true');
                setPage(0);
              }}
            >
              Activas
            </Button>
            <Button
              variant={activeFilter === 'false' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveFilter('false');
                setPage(0);
              }}
            >
              Suspendidas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-destructive text-sm py-4">
              {(error as { message?: string })?.message ?? 'Error al cargar empresas.'}
            </p>
          )}
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No hay empresas registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-muted-foreground">{t.slug}</TableCell>
                        <TableCell>
                          <Badge variant={t.isActive ? 'default' : 'secondary'}>
                            {t.isActive ? 'Activa' : 'Suspendida'}
                          </Badge>
                        </TableCell>
                        <TableCell>{t.plan?.name ?? '—'}</TableCell>
                        <TableCell>{t.usersCount}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {t.lastActivityAt
                            ? new Date(t.lastActivityAt).toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    {total} empresa(s) · página {page + 1} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
