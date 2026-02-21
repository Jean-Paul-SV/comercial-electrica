'use client';

import { useMemo, useState, useEffect } from 'react';
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
import { Pagination } from '@shared/components/Pagination';
import { EmptyState } from '@shared/components/EmptyState';
import { cn } from '@lib/utils';
import { formatMoney, formatDateTime, formatDate } from '@shared/utils/format';
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, DollarSign, Wallet, FilterX, Search } from 'lucide-react';
import { useAllCashMovements, useCashSessionsList } from '@features/cash/hooks';
import type { CashMovementWithSession } from '@features/cash/types';

const MOVEMENT_TYPES: { value: 'IN' | 'OUT' | 'ADJUST'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'IN', label: 'Entrada', icon: ArrowDownToLine },
  { value: 'OUT', label: 'Salida', icon: ArrowUpFromLine },
  { value: 'ADJUST', label: 'Ajuste', icon: SlidersHorizontal },
];

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

const SEARCH_DEBOUNCE_MS = 300;

export default function CashMovementsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchRef, setSearchRef] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [typeFilter, setTypeFilter] = useState<'IN' | 'OUT' | 'ADJUST' | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchRef(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(
    () => ({
      page,
      limit,
      sessionId: sessionId || undefined,
      type: typeFilter || undefined,
      startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
      endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
    }),
    [page, limit, sessionId, typeFilter, startDate, endDate]
  );

  const query = useAllCashMovements(params);
  const sessionsQuery = useCashSessionsList({ page: 1, limit: 100 });

  const rawRows = useMemo(() => query.data?.data ?? [], [query.data]);
  const rows = useMemo(() => {
    if (!searchRef) return rawRows;
    const lower = searchRef.toLowerCase();
    return rawRows.filter(
      (m) =>
        (m.reference && m.reference.toLowerCase().includes(lower)) ||
        m.id.toLowerCase().includes(lower)
    );
  }, [rawRows, searchRef]);
  const meta = query.data?.meta;
  const sessions = useMemo(() => sessionsQuery.data?.data ?? [], [sessionsQuery.data]);

  const hasActiveFilters = Boolean(
    searchInput.trim() || sessionId || typeFilter || startDate || endDate
  );

  const clearFilters = () => {
    setSearchInput('');
    setSearchRef('');
    setSessionId('');
    setTypeFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const typeIcon = (type: 'IN' | 'OUT' | 'ADJUST') => {
    const config = MOVEMENT_TYPES.find((t) => t.value === type);
    const Icon = config?.icon ?? SlidersHorizontal;
    return <Icon className="h-4 w-4 shrink-0" />;
  };

  const sessionLabel = (m: CashMovementWithSession) => {
    const s = m.session;
    if (!s) return m.sessionId.slice(0, 8) + '…';
    const opened = formatDate(s.openedAt);
    return s.closedAt ? `Sesión ${opened}` : `Sesión ${opened} (abierta)`;
  };

  const totalMovements = meta?.total ?? 0;
  const hasData = rows.length > 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-2 pb-2">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <DollarSign className="h-7 w-7 shrink-0 text-primary" strokeWidth={2} aria-hidden />
            Movimientos de caja
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            {hasData
              ? `${totalMovements} movimiento${totalMovements !== 1 ? 's' : ''}`
              : 'Historial de entradas, salidas y ajustes por sesión'}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-2 shrink-0 rounded-xl">
          <Link href="/cash">
            <Wallet className="h-4 w-4 shrink-0" />
            Volver a Caja
          </Link>
        </Button>
      </header>

      <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center gap-x-4 gap-y-3 min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center gap-x-4 gap-y-3 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xs">
                <Label htmlFor="search-ref" className="text-sm font-medium text-muted-foreground shrink-0">
                  Buscar
                </Label>
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="search-ref"
                    type="search"
                    placeholder="Por referencia o ID"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="h-9 pl-8 rounded-lg bg-background border-border/80 text-sm w-full focus-visible:ring-2 focus-visible:ring-primary/20"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Sesión</Label>
                <select
                  value={sessionId}
                  onChange={(e) => {
                    setSessionId(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Todas</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatDate(s.openedAt)}
                      {s.closedAt ? '' : ' (abierta)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Tipo</Label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as 'IN' | 'OUT' | 'ADJUST' | '');
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm min-w-[100px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Todos</option>
                  {MOVEMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Desde</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-[140px] rounded-lg bg-background border-border/80 text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Hasta</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-[140px] rounded-lg bg-background border-border/80 text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="h-9 shrink-0 gap-1.5 rounded-lg"
                aria-label="Limpiar filtros"
              >
                <FilterX className="h-4 w-4" />
                Limpiar filtros
              </Button>
            </div>
          </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
          {query.isLoading && (
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Sesión</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Tipo</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Método</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Monto</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-28 rounded-md" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-md" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-md" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 ml-auto rounded-md" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32 rounded-md" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <div className="py-8 px-6">
              <p className="text-sm text-destructive">
                {(query.error as { message?: string })?.message ?? 'Error al cargar movimientos'}
              </p>
            </div>
          )}

          {!query.isLoading && !query.isError && (
            <>
              <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Sesión</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Tipo</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Método</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">Monto</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Referencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((m) => (
                      <TableRow
                        key={m.id}
                        className="transition-colors hover:bg-muted/40"
                      >
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                          {formatDateTime(m.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sessionLabel(m)}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {typeIcon(m.type)}
                            {MOVEMENT_TYPES.find((t) => t.value === m.type)?.label ?? m.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {METHOD_LABELS[m.method] ?? m.method}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-semibold tabular-nums',
                            m.type === 'IN' && 'text-emerald-600 dark:text-emerald-400',
                            m.type === 'OUT' && 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : ''}
                          {formatMoney(m.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {m.reference ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0 align-top">
                          <EmptyState
                            message={rawRows.length === 0 ? 'No hay movimientos' : 'Sin coincidencias en esta página'}
                            description={
                              rawRows.length === 0
                                ? 'Ajusta los filtros o registra movimientos desde Caja.'
                                : 'Ningún movimiento coincide con la búsqueda en esta página.'
                            }
                            icon={DollarSign}
                            action={
                              <Button variant="outline" size="sm" asChild className="gap-2">
                                <Link href="/cash">
                                  <Wallet className="h-4 w-4" />
                                  Ir a Caja
                                </Link>
                              </Button>
                            }
                            className="py-16"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              {meta && (meta.total > 0 || meta.totalPages > 1) && (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <Pagination meta={meta} onPageChange={setPage} label="Página" />
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}
