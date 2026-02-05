'use client';

import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@shared/components/ui/dialog';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Pagination } from '@shared/components/Pagination';
import Link from 'next/link';
import { Users, Plus, Search, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { useCustomersList, useCreateCustomer } from '@features/customers/hooks';
import type { CustomerDocType } from '@features/customers/types';

const DOC_LABELS: Record<string, string> = {
  CC: 'Cédula',
  CE: 'Cédula ext.',
  NIT: 'NIT',
  PASSPORT: 'Pasaporte',
  OTHER: 'Otro',
};

const DOC_TYPES: { value: CustomerDocType; label: string }[] = [
  { value: 'CC', label: 'Cédula' },
  { value: 'CE', label: 'Cédula ext.' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro' },
];

const customerSchema = z.object({
  docType: z.enum(['CC', 'CE', 'NIT', 'PASSPORT', 'OTHER']),
  docNumber: z.string().min(3, 'Mínimo 3 caracteres'),
  name: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
});
type CustomerFormValues = z.infer<typeof customerSchema>;

const SEARCH_DEBOUNCE_MS = 300;

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [openNewCustomer, setOpenNewCustomer] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = useCustomersList({
    page,
    limit,
    search: search || undefined,
    sortOrder: sortOrder ?? undefined,
  });
  const createCustomer = useCreateCustomer();

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      docType: 'CC',
      docNumber: '',
      name: '',
      email: '',
      phone: '',
    },
  });

  const onNewCustomer = (values: CustomerFormValues) => {
    createCustomer.mutate(
      {
        docType: values.docType,
        docNumber: values.docNumber.trim(),
        name: values.name.trim(),
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Cliente creado');
          setOpenNewCustomer(false);
          form.reset();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear el cliente');
        },
      }
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Clientes
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestión de clientes
        </p>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Users className="h-5 w-5 shrink-0 text-primary" />
                Listado
              </CardTitle>
              <CardDescription>
                Clientes paginados. Busca por nombre, número o teléfono.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNewCustomer(true)}
              className="gap-2 w-full sm:w-auto shadow-sm"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Nuevo cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-muted/20 border border-border/50 p-3">
            <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                <Label htmlFor="search-customer" className="text-sm text-muted-foreground whitespace-nowrap">
                  Buscar:
                </Label>
                <Input
                  id="search-customer"
                  type="search"
                  placeholder="Nombre o número de identificación del cliente"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-lg bg-background border-border/80 text-sm flex-1 min-w-0"
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">
                  Ordenar:
                </Label>
                <div className="flex items-center gap-1 border border-input rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (sortOrder === 'asc') {
                      setSortOrder(null);
                    } else {
                      setSortOrder('asc');
                    }
                    setPage(1);
                  }}
                  className={`h-7 px-2 flex items-center gap-1 rounded text-xs transition-colors ${
                    sortOrder === 'asc'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                  title="Nombre A-Z"
                >
                  <ChevronUp className="h-3 w-3" />
                  Mayor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sortOrder === 'desc') {
                      setSortOrder(null);
                    } else {
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                  className={`h-7 px-2 flex items-center gap-1 rounded text-xs transition-colors ${
                    sortOrder === 'desc'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                  title="Nombre Z-A"
                >
                  <ChevronDown className="h-3 w-3" />
                  Menor
                </button>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setSortOrder(null);
                  setPage(1);
                }}
                disabled={!searchInput.trim() && !search && sortOrder === null}
                className="h-9 shrink-0 border-border bg-background text-foreground hover:bg-muted/50 disabled:opacity-50"
                aria-label="Limpiar filtros"
              >
                Limpiar filtros
              </Button>
            </div>
            <Pagination meta={meta} onPageChange={setPage} label="Página" />
          </div>

          {query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-medium">Documento</TableHead>
                    <TableHead className="font-medium">Nombre</TableHead>
                    <TableHead className="font-medium">Email</TableHead>
                    <TableHead className="font-medium">Teléfono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-4">
              {(query.error as { message?: string })?.message ??
                'Error al cargar clientes'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-medium">Documento</TableHead>
                    <TableHead className="font-medium">Nombre</TableHead>
                    <TableHead className="font-medium">Email</TableHead>
                    <TableHead className="font-medium">Teléfono</TableHead>
                    <TableHead className="w-20 text-center font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="text-muted-foreground text-sm">
                        {DOC_LABELS[c.docType] ?? c.docType} {c.docNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/customers/${c.id}`} className="hover:underline text-foreground">
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.email ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.phone ?? '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={`/customers/${c.id}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Ver detalle"
                            aria-label="Ver detalle"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {search
                          ? 'Ningún cliente coincide con la búsqueda.'
                          : 'No hay clientes. Crea uno para comenzar.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openNewCustomer} onOpenChange={setOpenNewCustomer}>
        <DialogContent showClose className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onNewCustomer)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="docType">Tipo documento</Label>
                <select
                  id="docType"
                  {...form.register('docType')}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Tipo de identificación: cédula, NIT, pasaporte, etc.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docNumber">Nº documento</Label>
                <Input
                  id="docNumber"
                  {...form.register('docNumber')}
                  placeholder="Ej: 1234567890"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Número del documento, sin puntos ni espacios. Se usa en facturas.
                </p>
                {form.formState.errors.docNumber && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.docNumber.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nombre / Razón social</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  placeholder="Ej: Juan Pérez o Empresa S.A.S."
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Nombre completo de la persona o razón social de la empresa. Aparecerá en facturas y cotizaciones.
                </p>
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  placeholder="Ej: cliente@correo.com"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Para envío de facturas electrónicas o notificaciones.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  {...form.register('phone')}
                  placeholder="Ej: 300 123 4567"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Número de contacto del cliente.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNewCustomer(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? 'Guardando…' : 'Crear cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
