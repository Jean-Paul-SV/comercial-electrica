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
import { Truck, Plus, Power, PowerOff, Search, FilterX } from 'lucide-react';
import { useSuppliersList, useCreateSupplier, useUpdateSupplier } from '@features/suppliers/hooks';

const supplierSchema = z.object({
  nit: z.string().min(5, 'NIT mínimo 5 caracteres'),
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
});
type SupplierFormValues = z.infer<typeof supplierSchema>;

const SEARCH_DEBOUNCE_MS = 300;

export default function SuppliersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [openNewSupplier, setOpenNewSupplier] = useState(false);
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = useSuppliersList({
    page,
    limit,
    search: search || undefined,
  });
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      nit: '',
      name: '',
      email: '',
      phone: '',
      contactPerson: '',
    },
  });

  const onNewSupplier = (values: SupplierFormValues) => {
    createSupplier.mutate(
      {
        nit: values.nit.trim(),
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        contactPerson: values.contactPerson?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Proveedor creado');
          setOpenNewSupplier(false);
          form.reset();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear el proveedor');
        },
      }
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Proveedores
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestión de proveedores
        </p>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Truck className="h-5 w-5 shrink-0 text-primary" />
                Listado
              </CardTitle>
              <CardDescription>
                Proveedores paginados
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNewSupplier(true)}
              className="gap-2 w-full sm:w-auto shadow-sm"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Nuevo proveedor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-muted/20 border border-border/50 p-3">
            <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                <label htmlFor="suppliers-search" className="text-sm font-medium text-muted-foreground whitespace-nowrap shrink-0">
                  Buscar
                </label>
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                  <Input
                    id="suppliers-search"
                    type="search"
                    placeholder="Por NIT, nombre, contacto o email"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="h-9 pl-8 rounded-lg bg-background border-border/80 text-sm w-full focus-visible:ring-2 focus-visible:ring-primary/20"
                    autoComplete="off"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                disabled={!searchInput && !search}
                className="h-9 shrink-0 gap-1.5"
                aria-label="Limpiar búsqueda"
              >
                <FilterX className="h-4 w-4" />
                Limpiar búsqueda
              </Button>
            </div>
            <Pagination meta={meta} onPageChange={setPage} label="Página" />
          </div>

          {query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-medium">NIT</TableHead>
                    <TableHead className="font-medium">Nombre</TableHead>
                    <TableHead className="font-medium">Contacto</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="w-24 text-center font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 mx-auto rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-4">
              {(query.error as { message?: string })?.message ??
                'Error al cargar proveedores'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-medium">NIT</TableHead>
                    <TableHead className="font-medium">Nombre</TableHead>
                    <TableHead className="font-medium">Contacto</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="w-24 text-center font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-mono text-muted-foreground text-sm">
                        {s.nit}
                      </TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.contactPerson ?? s.email ?? s.phone ?? '—'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            s.isActive
                              ? 'font-medium text-success'
                              : 'text-muted-foreground'
                          }
                        >
                          {s.isActive ? 'Activo' : 'Deshabilitado'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          title={s.isActive ? 'Deshabilitar proveedor' : 'Habilitar proveedor'}
                          onClick={() => {
                            updateSupplier.mutate(
                              { id: s.id, payload: { isActive: !s.isActive } },
                              {
                                onSuccess: () => {
                                  toast.success(
                                    s.isActive
                                      ? 'Proveedor deshabilitado'
                                      : 'Proveedor habilitado'
                                  );
                                },
                                onError: (e: { message?: string }) => {
                                  toast.error(
                                    e?.message ?? 'No se pudo actualizar el estado'
                                  );
                                },
                              }
                            );
                          }}
                          disabled={updateSupplier.isPending && updateSupplier.variables?.id === s.id}
                          className={
                            s.isActive
                              ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                              : 'border-primary/30 text-primary hover:bg-primary/10'
                          }
                        >
                          {s.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay proveedores. Crea uno para comenzar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openNewSupplier} onOpenChange={setOpenNewSupplier}>
        <DialogContent showClose className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo proveedor
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onNewSupplier)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nit">NIT</Label>
                <Input
                  id="nit"
                  {...form.register('nit')}
                  placeholder="Ej: 900123456-7"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Número de identificación tributaria del proveedor. Se usa en facturas y reportes.
                </p>
                {form.formState.errors.nit && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.nit.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Razón social</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  placeholder="Ej: Distribuidora Eléctrica S.A.S."
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Nombre legal de la empresa. Aparecerá en pedidos de compra y facturas.
                </p>
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Descripción del proveedor</Label>
                <textarea
                  id="description"
                  {...form.register('description')}
                  placeholder="Ej: Proveedor de cables y materiales eléctricos. Horario de atención: 8am-5pm."
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Notas internas sobre el proveedor: productos que vende, condiciones, etc.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  placeholder="Ej: contacto@proveedor.com"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Correo para pedidos o consultas.
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
                  Opcional. Número de contacto del proveedor.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contactPerson">Persona de contacto</Label>
                <Input
                  id="contactPerson"
                  {...form.register('contactPerson')}
                  placeholder="Ej: Juan Pérez — Ventas"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Nombre de quien atiende pedidos o facturación.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNewSupplier(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createSupplier.isPending}>
                {createSupplier.isPending ? 'Guardando…' : 'Crear proveedor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
