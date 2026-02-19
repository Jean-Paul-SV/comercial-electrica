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
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUsageEvents, useListTenants } from '@features/provider/hooks';

const PAGE_SIZE = 50;

export default function ProviderUsagePage() {
  const [page, setPage] = useState(0);
  const [tenantId, setTenantId] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: tenantsData, isLoading: tenantsLoading } = useListTenants({ limit: 500 });
  const tenants = tenantsData?.items ?? [];

  const { data, isLoading } = useUsageEvents({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    tenantId: tenantId || undefined,
    event: eventFilter || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/provider">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Datos de uso
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Eventos para mejorar el producto (pantallas visitadas, acciones). Solo uso interno, sin vender datos.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Resumen por empresa</CardTitle>
          <CardDescription>
            Conteos de datos (usuarios, productos, ventas, clientes) de cada empresa. Mismo dato que en el detalle de cada una.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenantsLoading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No hay empresas.</p>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-medium">Empresa</TableHead>
                    <TableHead className="font-medium text-right">Usuarios</TableHead>
                    <TableHead className="font-medium text-right">Productos</TableHead>
                    <TableHead className="font-medium text-right">Ventas</TableHead>
                    <TableHead className="font-medium text-right">Clientes</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Última actividad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id} className="border-border/50">
                      <TableCell>
                        <Link href={`/provider/${t.id}`} className="font-medium text-primary hover:underline">
                          {t.name}
                        </Link>
                        <div className="text-xs text-muted-foreground font-mono">{t.slug}</div>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Eventos</CardTitle>
          <CardDescription>
            Filtra por empresa, tipo de evento o rango de fechas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Empresa</Label>
              <select
                value={tenantId}
                onChange={(e) => {
                  setTenantId(e.target.value);
                  setPage(0);
                }}
                className="flex h-9 w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Todas</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Evento</Label>
              <select
                value={eventFilter}
                onChange={(e) => {
                  setEventFilter(e.target.value);
                  setPage(0);
                }}
                className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Todos</option>
                <option value="screen_view">screen_view</option>
                <option value="sale_created">sale_created</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(0);
                }}
                className="h-9 w-[140px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(0);
                }}
                className="h-9 w-[140px]"
              />
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay eventos con los filtros aplicados.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-border/60 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="font-medium">Fecha</TableHead>
                      <TableHead className="font-medium">Evento</TableHead>
                      <TableHead className="font-medium">Empresa</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Payload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="border-border/50">
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString('es-CO')}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs rounded bg-muted px-1.5 py-0.5">
                            {item.event}
                          </code>
                        </TableCell>
                        <TableCell>
                          {item.tenant ? (
                            <div>
                              <div className="font-medium">{item.tenant.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {item.tenant.slug}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {item.payload && Object.keys(item.payload).length > 0 ? (
                            <pre className="text-xs text-muted-foreground truncate overflow-hidden">
                              {JSON.stringify(item.payload)}
                            </pre>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    {total} evento{total !== 1 ? 's' : ''} en total
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages - 1}
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
    </div>
  );
}
