'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, Pencil, Truck, FileText } from 'lucide-react';
import { useSupplier } from '@features/suppliers/hooks';
import { formatDate } from '@shared/utils/format';

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: supplier, isLoading, isError, error } = useSupplier(id);

  if (!id) {
    router.replace('/suppliers');
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-10">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
          <Skeleton className="h-5 w-full mt-4" />
          <Skeleton className="h-5 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="space-y-10">
        <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
          <Link href="/suppliers">
            <ArrowLeft className="h-4 w-4" />
            Volver a proveedores
          </Link>
        </Button>
        <div className="rounded-2xl border border-destructive/50 bg-card p-6">
          <p className="text-sm text-destructive">
            {(error as { message?: string })?.message ?? 'Proveedor no encontrado.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Truck className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            {supplier.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            NIT {supplier.nit}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
            <Link href="/suppliers">
              <ArrowLeft className="h-4 w-4" />
              Volver a proveedores
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href={`/supplier-invoices?supplierId=${supplier.id}`}>
              <FileText className="h-4 w-4" />
              Facturas
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href="/suppliers">
              <Pencil className="h-4 w-4" />
              Ir a listado para editar
            </Link>
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="pb-5 pt-6 px-6 sm:px-8 border-b border-border/60 bg-muted/20 flex flex-wrap items-center justify-end gap-3">
          <Badge
            variant={supplier.isActive ? 'default' : 'secondary'}
            className="shrink-0 font-medium px-3 py-1"
          >
            {supplier.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
        <div className="pt-6 pb-6 px-6 sm:px-8">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-sm font-medium text-muted-foreground">NIT</dt>
              <dd className="text-base font-medium text-foreground font-mono tabular-nums">{supplier.nit}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm font-medium text-muted-foreground">Nombre</dt>
              <dd className="text-base font-medium text-foreground">{supplier.name}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm font-medium text-muted-foreground">Email</dt>
              <dd className="text-base font-medium text-foreground break-all">{supplier.email ?? '—'}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm font-medium text-muted-foreground">Teléfono</dt>
              <dd className="text-base font-medium text-foreground">{supplier.phone ?? '—'}</dd>
            </div>
            {supplier.contactPerson ? (
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Contacto</dt>
                <dd className="text-base font-medium text-foreground">{supplier.contactPerson}</dd>
              </div>
            ) : (
              <div className="hidden sm:block" aria-hidden />
            )}
            <div className="flex flex-col gap-1 sm:col-start-2">
              <dt className="text-sm font-medium text-muted-foreground">Descripción</dt>
              <dd className="text-base text-foreground/90 whitespace-pre-wrap mt-0.5 min-h-[1.5rem]">
                {supplier.description?.trim() ? (
                  supplier.description
                ) : (
                  <span className="text-muted-foreground italic">Sin descripción</span>
                )}
              </dd>
            </div>
            {supplier.address && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">Dirección</dt>
                <dd className="text-base font-medium text-foreground">{supplier.address}</dd>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <dt className="text-sm font-medium text-muted-foreground">Creado</dt>
              <dd className="text-base font-medium text-foreground tabular-nums">{formatDate(supplier.createdAt)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm font-medium text-muted-foreground">Actualizado</dt>
              <dd className="text-base font-medium text-foreground tabular-nums">{formatDate(supplier.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
