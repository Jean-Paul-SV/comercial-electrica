'use client';

import { useMemo, useState } from 'react';
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
import { Truck, Plus } from 'lucide-react';
import { useSuppliersList, useCreateSupplier } from '@features/suppliers/hooks';

const supplierSchema = z.object({
  nit: z.string().min(5, 'NIT mínimo 5 caracteres'),
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
});
type SupplierFormValues = z.infer<typeof supplierSchema>;

export default function SuppliersPage() {
  const [page, setPage] = useState(1);
  const [openNewSupplier, setOpenNewSupplier] = useState(false);
  const limit = 20;
  const query = useSuppliersList({ page, limit });
  const createSupplier = useCreateSupplier();

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

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Truck className="h-5 w-5 shrink-0" />
                Listado
              </CardTitle>
              <CardDescription>
                Proveedores paginados
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNewSupplier(true)}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Nuevo proveedor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Pagination meta={meta} onPageChange={setPage} label="Página" />

          {query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NIT</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
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
                  <TableRow>
                    <TableHead>NIT</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
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
                              ? 'font-medium text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {s.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
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
                  placeholder="900123456-7"
                  className="rounded-lg"
                />
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
                  placeholder="Distribuidora S.A.S."
                  className="rounded-lg"
                />
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
                  placeholder="Descripción o notas del proveedor"
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  placeholder="contacto@proveedor.com"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  {...form.register('phone')}
                  placeholder="3001234567"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contactPerson">Persona de contacto</Label>
                <Input
                  id="contactPerson"
                  {...form.register('contactPerson')}
                  placeholder="Juan Pérez"
                  className="rounded-lg"
                />
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
