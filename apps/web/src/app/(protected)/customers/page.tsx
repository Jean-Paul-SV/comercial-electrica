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
import { Users, Plus } from 'lucide-react';
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

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [openNewCustomer, setOpenNewCustomer] = useState(false);
  const limit = 20;
  const query = useCustomersList({ page, limit });
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

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Users className="h-5 w-5 shrink-0" />
                Listado
              </CardTitle>
              <CardDescription>
                Clientes paginados
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setOpenNewCustomer(true)}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Nuevo cliente
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
                    <TableHead>Documento</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
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
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {DOC_LABELS[c.docType] ?? c.docType} {c.docNumber}
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.email ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.phone ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay clientes. Crea uno para comenzar.
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
                <Label>Tipo documento</Label>
                <select
                  {...form.register('docType')}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docNumber">Nº documento</Label>
                <Input
                  id="docNumber"
                  {...form.register('docNumber')}
                  placeholder="1234567890"
                  className="rounded-lg"
                />
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
                  placeholder="Juan Pérez"
                  className="rounded-lg"
                />
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
                  placeholder="cliente@correo.com"
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
