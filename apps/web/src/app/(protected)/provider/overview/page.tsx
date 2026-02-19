'use client';

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
import { ArrowLeft, LayoutGrid, Eye } from 'lucide-react';
import { useListTenants } from '@features/provider/hooks';

export default function ProviderOverviewPage() {
  const { data, isLoading } = useListTenants({ limit: 500 });
  const tenants = data?.items ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/provider">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <LayoutGrid className="h-6 w-6 text-primary" />
              Vista global
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Todas las empresas con plan, estado, uso y última actividad en una sola vista.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Todas las empresas</CardTitle>
          <CardDescription>
            Resumen unificado: plan, suscripción, usuarios, productos, ventas, clientes y última actividad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay empresas.
            </p>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-medium">Empresa</TableHead>
                    <TableHead className="font-medium">Plan</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="font-medium text-right">Usuarios</TableHead>
                    <TableHead className="font-medium text-right">Productos</TableHead>
                    <TableHead className="font-medium text-right">Ventas</TableHead>
                    <TableHead className="font-medium text-right">Clientes</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Última actividad</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id} className="border-border/50">
                      <TableCell>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{t.slug}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{t.plan?.name ?? '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.isActive && t.subscription?.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {t.isActive && (t.subscription == null || t.subscription.status === 'ACTIVE')
                            ? 'Activa'
                            : 'Suspendida'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.usersCount ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.productsCount ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.salesCount ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.customersCount ?? 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {t.lastActivityAt
                          ? new Date(t.lastActivityAt).toLocaleString('es-CO')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/provider/${t.id}`}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
