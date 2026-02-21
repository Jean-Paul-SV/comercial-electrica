'use client';

import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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
import { getErrorMessage } from '@shared/utils/errors';
import { Users, Plus, Search, ChevronUp, ChevronDown, Eye, Pencil, ClipboardCheck } from 'lucide-react';
import { useCustomersList, useCreateCustomer, useUpdateCustomer } from '@features/customers/hooks';
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
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [pendingCreateValues, setPendingCreateValues] = useState<CustomerFormValues | null>(null);
  const [customerToEdit, setCustomerToEdit] = useState<{
    id: string;
    docType: CustomerDocType;
    docNumber: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null>(null);
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
  const updateCustomer = useUpdateCustomer();

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

  const editForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      docType: 'CC',
      docNumber: '',
      name: '',
      email: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (customerToEdit) {
      editForm.reset({
        docType: customerToEdit.docType,
        docNumber: customerToEdit.docNumber,
        name: customerToEdit.name,
        email: customerToEdit.email ?? '',
        phone: customerToEdit.phone ?? '',
      });
    }
  }, [customerToEdit, editForm]);

  const onNewCustomer = (values: CustomerFormValues) => {
    setPendingCreateValues(values);
    setShowCreateConfirm(true);
  };

  const onConfirmCreateCustomer = () => {
    if (!pendingCreateValues) return;
    createCustomer.mutate(
      {
        docType: pendingCreateValues.docType,
        docNumber: pendingCreateValues.docNumber.trim(),
        name: pendingCreateValues.name.trim(),
        email: pendingCreateValues.email?.trim() || undefined,
        phone: pendingCreateValues.phone?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Cliente creado');
          setShowCreateConfirm(false);
          setPendingCreateValues(null);
          setOpenNewCustomer(false);
          form.reset();
        },
        onError: (e: unknown) => {
          toast.error(getErrorMessage(e, 'No se pudo crear el cliente'));
        },
      }
    );
  };

  const onEditCustomer = (values: CustomerFormValues) => {
    if (!customerToEdit) return;
    updateCustomer.mutate(
      {
        id: customerToEdit.id,
        payload: {
          name: values.name.trim(),
          email: values.email?.trim() || undefined,
          phone: values.phone?.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Cliente actualizado');
          setCustomerToEdit(null);
        },
        onError: (e: unknown) => {
          toast.error(getErrorMessage(e, 'No se pudo actualizar el cliente'));
        },
      }
    );
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-2 pb-2">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Users className="h-7 w-7 shrink-0 text-primary" />
            Clientes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Clientes paginados. Busca por nombre, número o teléfono.
          </p>
        </div>
        <Button
          size="default"
          onClick={() => setOpenNewCustomer(true)}
          className="gap-2 shrink-0 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </header>

      <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm shadow-black/[0.03] dark:shadow-none overflow-x-auto">
          {query.isLoading && (
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
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-8 px-6">
              {(query.error as { message?: string })?.message ??
                'Error al cargar clientes'}
            </p>
          )}

          {!query.isLoading && (
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
                        <div className="flex items-center justify-center gap-1">
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Editar"
                            aria-label="Editar"
                            onClick={() =>
                              setCustomerToEdit({
                                id: c.id,
                                docType: c.docType,
                                docNumber: c.docNumber,
                                name: c.name,
                                email: c.email,
                                phone: c.phone,
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
          )}
      </div>

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

      <Dialog open={showCreateConfirm} onOpenChange={setShowCreateConfirm}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
              Confirmar datos del cliente
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1 leading-relaxed">
              Verifique que la información ingresada sea correcta antes de confirmar. Al aceptar, se registrará el nuevo cliente en el sistema.
            </p>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateConfirm(false);
                setPendingCreateValues(null);
              }}
              className="rounded-xl"
            >
              Volver
            </Button>
            <Button
              type="button"
              onClick={onConfirmCreateCustomer}
              disabled={createCustomer.isPending}
              className="rounded-xl font-medium"
            >
              {createCustomer.isPending ? 'Registrando…' : 'Confirmar y crear cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!customerToEdit}
        onOpenChange={(open) => { if (!open) setCustomerToEdit(null); }}
      >
        <DialogContent showClose className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Editar cliente
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Modifique nombre, email o teléfono. El tipo y número de documento no se pueden cambiar.
            </p>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit(onEditCustomer)}
            className="space-y-4"
          >
            {customerToEdit && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Tipo documento</Label>
                    <p className="flex h-10 items-center rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                      {DOC_LABELS[customerToEdit.docType] ?? customerToEdit.docType}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Nº documento</Label>
                    <p className="flex h-10 items-center rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm font-mono text-muted-foreground">
                      {customerToEdit.docNumber}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-name">Nombre / Razón social</Label>
                    <Input
                      id="edit-name"
                      {...editForm.register('name')}
                      placeholder="Ej: Juan Pérez o Empresa S.A.S."
                      className="rounded-lg"
                    />
                    {editForm.formState.errors.name && (
                      <p className="text-sm text-destructive">
                        {editForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      {...editForm.register('email')}
                      placeholder="Ej: cliente@correo.com"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Teléfono</Label>
                    <Input
                      id="edit-phone"
                      {...editForm.register('phone')}
                      placeholder="Ej: 300 123 4567"
                      className="rounded-lg"
                    />
                  </div>
                </div>
              </>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomerToEdit(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateCustomer.isPending}
              >
                {updateCustomer.isPending ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
