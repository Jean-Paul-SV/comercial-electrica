'use client';

import Link from 'next/link';
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
import { ArrowLeft, Eye, Building2, FileCode, AlertCircle } from 'lucide-react';
import { usePageVisitsAnalytics } from '@features/provider/hooks';
import { useState } from 'react';

export default function ProviderVisitsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, isError, refetch } = usePageVisitsAnalytics({
    from: from || undefined,
    to: to || undefined,
  });

  const total = data?.total ?? 0;
  const byTenant = data?.byTenant ?? [];
  const byPath = data?.byPath ?? [];

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
              <Eye className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Contador de visitas
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Visitas a páginas por empresa y por ruta. Contador universal de toda la plataforma.
            </p>
          </div>
        </div>
      </header>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm">No se pudieron cargar los datos. Revisa la conexión.</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-[140px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-[140px]"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Sin fechas: se cuentan todas las visitas registradas.
        </p>
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : isError ? null : (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 dark:bg-primary/10">
          <p className="text-sm font-medium text-muted-foreground">Total de visitas</p>
          <p className="text-4xl font-semibold tabular-nums text-foreground mt-1">{total.toLocaleString('es-CO')}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Por empresa
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Número de visitas registradas por cada empresa (tenant).
          </p>
        </div>
        {isLoading && !data ? (
          <Skeleton className="h-48 mx-6 mb-6 rounded-lg" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground py-6 px-6">Error al cargar. Usa Reintentar arriba.</p>
        ) : byTenant.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-6">No hay visitas por empresa en el periodo.</p>
        ) : (
          <div className="rounded-lg border-t border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="font-medium">Empresa</TableHead>
                  <TableHead className="font-medium text-right">Visitas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byTenant.map((row) => (
                  <TableRow key={row.tenantId ?? 'null'} className="border-border/50">
                    <TableCell>
                      {row.tenantId ? (
                        <>
                          <Link
                            href={`/provider/${row.tenantId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.tenantName ?? '—'}
                          </Link>
                          {row.tenantSlug && (
                            <div className="text-xs text-muted-foreground font-mono">{row.tenantSlug}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.count.toLocaleString('es-CO')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
            <FileCode className="h-5 w-5 text-muted-foreground" />
            Por página (ruta)
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Entradas por ruta de la aplicación (ej. /app, /sales, /inventory).
          </p>
        </div>
        {isLoading && !data ? (
          <Skeleton className="h-48 mx-6 mb-6 rounded-lg" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground py-6 px-6">Error al cargar. Usa Reintentar arriba.</p>
        ) : byPath.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 px-6">No hay visitas por ruta en el periodo.</p>
        ) : (
          <div className="rounded-lg border-t border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="font-medium">Ruta</TableHead>
                  <TableHead className="font-medium text-right">Visitas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPath.map((row) => (
                  <TableRow key={row.path} className="border-border/50">
                    <TableCell>
                      <code className="text-sm rounded bg-muted px-1.5 py-0.5">{row.path}</code>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.count.toLocaleString('es-CO')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
