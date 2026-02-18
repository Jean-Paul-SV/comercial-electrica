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
import { Truck, Plus, Power, PowerOff, Search, FilterX, Pencil, Eye } from 'lucide-react';
import { useSuppliersList, useCreateSupplier, useUpdateSupplier } from '@features/suppliers/hooks';

const supplierSchema = z.object({
  nit: z.string().min(5, 'NIT mínimo 5 caracteres'),
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
  address: z.string().optional(),
});
type SupplierFormValues = z.infer<typeof supplierSchema>;

const SEARCH_DEBOUNCE_MS = 300;

const formInputClass =
  'rounded-xl border border-input bg-background/80 h-10 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary/50 transition-colors';
const formTextareaClass =
  'flex w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-colors';

export default function SuppliersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [openNewSupplier, setOpenNewSupplier] = useState(false);
  const [supplierToDisable, setSupplierToDisable] = useState<{ id: string; name: string } | null>(null);
  const [supplierToEdit, setSupplierToEdit] = useState<{
    id: string;
    nit: string;
    name: string;
    email: string | null;
    phone: string | null;
    contactPerson: string | null;
    address: string | null;
  } | null>(null);
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
      address: '',
    },
  });

  const editForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      nit: '',
      name: '',
      email: '',
      phone: '',
      contactPerson: '',
      address: '',
    },
  });

  useEffect(() => {
    if (supplierToEdit) {
      editForm.reset({
        nit: supplierToEdit.nit,
        name: supplierToEdit.name,
        email: supplierToEdit.email ?? '',
        phone: supplierToEdit.phone ?? '',
        contactPerson: supplierToEdit.contactPerson ?? '',
        address: supplierToEdit.address ?? '',
        description: '',
      });
    }
  }, [supplierToEdit, editForm]);

  const onNewSupplier = (values: SupplierFormValues) => {
    createSupplier.mutate(
      {
        nit: values.nit.trim(),
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        contactPerson: values.contactPerson?.trim() || undefined,
        address: values.address?.trim() || undefined,
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

  const onEditSupplier = (values: SupplierFormValues) => {
    if (!supplierToEdit) return;
    updateSupplier.mutate(
      {
        id: supplierToEdit.id,
        payload: {
          nit: values.nit.trim(),
          name: values.name.trim(),
          email: values.email?.trim() || undefined,
          phone: values.phone?.trim() || undefined,
          contactPerson: values.contactPerson?.trim() || undefined,
          address: values.address?.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Proveedor actualizado');
          setSupplierToEdit(null);
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo actualizar el proveedor');
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
                    <TableHead className="w-36 text-center font-medium">Acciones</TableHead>
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
                    <TableHead className="w-36 text-center font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-mono text-muted-foreground text-sm">
                        {s.nit}
                      </TableCell>
                      <TableCell className="font-medium">
                        {s.name}
                      </TableCell>
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
                        <div className="flex items-center justify-center gap-1">
                          <Button asChild variant="outline" size="sm" title="Ver detalle (descripción y datos)">
                            <Link href={`/suppliers/${s.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Editar proveedor"
                            onClick={() =>
                              setSupplierToEdit({
                                id: s.id,
                                nit: s.nit,
                                name: s.name,
                                email: s.email,
                                phone: s.phone,
                                contactPerson: s.contactPerson,
                                address: s.address,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title={s.isActive ? 'Deshabilitar proveedor' : 'Habilitar proveedor'}
                            onClick={() => {
                            if (s.isActive) {
                              setSupplierToDisable({ id: s.id, name: s.name });
                            } else {
                              updateSupplier.mutate(
                                { id: s.id, payload: { isActive: true } },
                                {
                                  onSuccess: () => {
                                    toast.success('Proveedor habilitado');
                                  },
                                  onError: (e: { message?: string }) => {
                                    toast.error(
                                      e?.message ?? 'No se pudo actualizar el estado'
                                    );
                                  },
                                }
                              );
                            }
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

      <Dialog
        open={!!supplierToDisable}
        onOpenChange={(open) => { if (!open) setSupplierToDisable(null); }}
      >
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PowerOff className="h-5 w-5 text-destructive" />
              Deshabilitar proveedor
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              ¿Está seguro de deshabilitar el proveedor{supplierToDisable?.name ? ` «${supplierToDisable.name}»` : ''}? No se eliminarán sus datos; podrá habilitarlo de nuevo cuando lo necesite.
            </p>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSupplierToDisable(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={updateSupplier.isPending}
              onClick={() => {
                if (!supplierToDisable) return;
                updateSupplier.mutate(
                  { id: supplierToDisable.id, payload: { isActive: false } },
                  {
                    onSuccess: () => {
                      toast.success('Proveedor deshabilitado');
                      setSupplierToDisable(null);
                    },
                    onError: (e: { message?: string }) => {
                      toast.error(
                        e?.message ?? 'No se pudo deshabilitar el proveedor'
                      );
                    },
                  }
                );
              }}
            >
              {updateSupplier.isPending ? 'Deshabilitando…' : 'Sí, deshabilitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!supplierToEdit}
        onOpenChange={(open) => { if (!open) setSupplierToEdit(null); }}
      >
        <DialogContent showClose className="sm:max-w-xl rounded-2xl border-border/80 shadow-xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Pencil className="h-4 w-4 text-primary" />
              Editar proveedor
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Modifique el nombre, NIT o datos de contacto del proveedor.
            </p>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit(onEditSupplier)}
            className="space-y-6 pt-1"
          >
            {/* Datos básicos */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary"></span>
                Datos básicos
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-nit" className="text-foreground font-medium">NIT *</Label>
                  <Input
                    id="edit-nit"
                    {...editForm.register('nit')}
                    placeholder="Ej: 900123456-7"
                    className={formInputClass}
                  />
                  {editForm.formState.errors.nit && (
                    <p className="text-sm text-destructive">
                      {editForm.formState.errors.nit.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-foreground font-medium">Razón social *</Label>
                  <Input
                    id="edit-name"
                    {...editForm.register('name')}
                    placeholder="Ej: Distribuidora Eléctrica S.A.S."
                    className={formInputClass}
                  />
                  {editForm.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {editForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Información de contacto */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary"></span>
                Información de contacto
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-foreground font-medium">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    {...editForm.register('email')}
                    placeholder="Ej: contacto@proveedor.com"
                    className={formInputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone" className="text-foreground font-medium">Teléfono</Label>
                  <Input
                    id="edit-phone"
                    {...editForm.register('phone')}
                    placeholder="Ej: 300 123 4567"
                    className={formInputClass}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-contactPerson" className="text-foreground font-medium">Persona de contacto</Label>
                  <Input
                    id="edit-contactPerson"
                    {...editForm.register('contactPerson')}
                    placeholder="Ej: Juan Pérez — Ventas"
                    className={formInputClass}
                  />
                </div>
              </div>
            </div>

            {/* Dirección */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary"></span>
                Ubicación
              </h3>
              <div className="space-y-2">
                <Label htmlFor="edit-address" className="text-foreground font-medium">Dirección</Label>
                <Input
                  id="edit-address"
                  {...editForm.register('address')}
                  placeholder="Ej: Carrera 54 #15-20, Bogotá"
                  className={formInputClass}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSupplierToEdit(null)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateSupplier.isPending}
                className="rounded-xl font-medium"
              >
                {updateSupplier.isPending ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openNewSupplier} onOpenChange={setOpenNewSupplier}>
        <DialogContent showClose className="sm:max-w-xl rounded-2xl border-border/80 shadow-xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-4 w-4 text-primary" />
              Nuevo proveedor
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Complete los datos del proveedor. Los campos opcionales pueden dejarse en blanco.
            </p>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onNewSupplier)}
            className="space-y-6 pt-1"
          >
            {/* Datos básicos */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary"></span>
                Datos básicos
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nit" className="text-foreground font-medium">NIT *</Label>
                  <Input
                    id="nit"
                    {...form.register('nit')}
                    placeholder="Ej: 900123456-7"
                    className={formInputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Número de identificación tributaria. Se usa en facturas y reportes.
                  </p>
                  {form.formState.errors.nit && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.nit.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground font-medium">Razón social *</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="Ej: Distribuidora Eléctrica S.A.S."
                    className={formInputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nombre legal de la empresa. Aparecerá en pedidos y facturas.
                  </p>
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description" className="text-foreground font-medium">Descripción (opcional)</Label>
                  <textarea
                    id="description"
                    {...form.register('description')}
                    placeholder="Ej: Proveedor de cables y materiales eléctricos. Horario de atención: 8am-5pm."
                    rows={3}
                    className={formTextareaClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Notas internas sobre el proveedor: productos que vende, condiciones, etc.
                  </p>
                </div>
              </div>
            </div>

            {/* Información de contacto */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary"></span>
                Información de contacto
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    placeholder="Ej: contacto@proveedor.com"
                    className={formInputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Opcional. Correo para pedidos o consultas.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-foreground font-medium">Teléfono</Label>
                  <Input
                    id="phone"
                    {...form.register('phone')}
                    placeholder="Ej: 300 123 4567"
                    className={formInputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Opcional. Número de contacto del proveedor.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contactPerson" className="text-foreground font-medium">Persona de contacto</Label>
                  <Input
                    id="contactPerson"
                    {...form.register('contactPerson')}
                    placeholder="Ej: Juan Pérez — Ventas"
                    className={formInputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Opcional. Nombre de quien atiende pedidos o facturación.
                  </p>
                </div>
              </div>
            </div>

            {/* Ubicación */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary"></span>
                Ubicación
              </h3>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-foreground font-medium">Dirección</Label>
                <Input
                  id="address"
                  {...form.register('address')}
                  placeholder="Ej: Carrera 54 #15-20, Bogotá"
                  className={formInputClass}
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Dirección física del proveedor.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNewSupplier(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createSupplier.isPending} className="rounded-xl font-medium">
                {createSupplier.isPending ? 'Guardando…' : 'Crear proveedor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
