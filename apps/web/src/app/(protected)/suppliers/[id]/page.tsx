'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
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
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="space-y-6">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a proveedores
          </Button>
        </Link>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {(error as { message?: string })?.message ?? 'Proveedor no encontrado.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver a proveedores
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/supplier-invoices?supplierId=${supplier.id}`}>
              <FileText className="h-4 w-4" />
              Facturas
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/suppliers">
              <Pencil className="h-4 w-4" />
              Ir a listado para editar
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
          Detalle del proveedor
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {supplier.name} · NIT {supplier.nit}
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card">
        <CardHeader className="pb-5 pt-6 px-6 sm:px-8 border-b border-border/60 bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Truck className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl font-semibold tracking-tight text-foreground truncate">
                  {supplier.name}
                </CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  NIT {supplier.nit}
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={supplier.isActive ? 'default' : 'secondary'}
              className="shrink-0 font-medium px-3 py-1"
            >
              {supplier.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-6 sm:px-8">
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
        </CardContent>
      </Card>
    </div>
  );
}
