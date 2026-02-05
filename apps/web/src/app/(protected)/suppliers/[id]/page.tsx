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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a proveedores
          </Button>
        </Link>
        <div className="flex gap-2">
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
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Detalle del proveedor
        </h1>
        <p className="text-sm text-muted-foreground">
          {supplier.name} · NIT {supplier.nit}
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
              <Truck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              {supplier.name}
            </CardTitle>
            <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
              {supplier.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <CardDescription>
            NIT {supplier.nit}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">NIT</dt>
              <dd className="text-sm font-mono text-foreground">{supplier.nit}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Nombre</dt>
              <dd className="text-sm text-foreground">{supplier.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Email</dt>
              <dd className="text-sm text-foreground">{supplier.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Teléfono</dt>
              <dd className="text-sm text-foreground">{supplier.phone ?? '—'}</dd>
            </div>
            {supplier.contactPerson && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Contacto</dt>
                <dd className="text-sm text-foreground">{supplier.contactPerson}</dd>
              </div>
            )}
            {supplier.address && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Dirección</dt>
                <dd className="text-sm text-foreground">{supplier.address}</dd>
              </div>
            )}
            {supplier.cityCode && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Código ciudad</dt>
                <dd className="text-sm text-foreground">{supplier.cityCode}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Creado</dt>
              <dd className="text-sm text-foreground">{formatDate(supplier.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Actualizado</dt>
              <dd className="text-sm text-foreground">{formatDate(supplier.updatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
