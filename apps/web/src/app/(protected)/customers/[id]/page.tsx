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
import { Skeleton } from '@shared/components/ui/skeleton';
import { ArrowLeft, Pencil, Users } from 'lucide-react';
import { useCustomer } from '@features/customers/hooks';

const DOC_LABELS: Record<string, string> = {
  CC: 'Cédula',
  CE: 'Cédula ext.',
  NIT: 'NIT',
  PASSPORT: 'Pasaporte',
  OTHER: 'Otro',
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: customer, isLoading, isError, error } = useCustomer(id);

  if (!id) {
    router.replace('/customers');
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

  if (isError || !customer) {
    return (
      <div className="space-y-6">
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a clientes
          </Button>
        </Link>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {(error as { message?: string })?.message ?? 'Cliente no encontrado.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a clientes
          </Button>
        </Link>
        <Link href="/customers">
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="h-4 w-4" />
            Ir a listado para editar
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Detalle del cliente
        </h1>
        <p className="text-sm text-muted-foreground">
          {customer.name} · {DOC_LABELS[customer.docType] ?? customer.docType} {customer.docNumber}
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            {customer.name}
          </CardTitle>
          <CardDescription>
            {DOC_LABELS[customer.docType] ?? customer.docType}: {customer.docNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Tipo de documento</dt>
              <dd className="text-sm text-foreground">{DOC_LABELS[customer.docType] ?? customer.docType}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Número</dt>
              <dd className="text-sm font-mono text-foreground">{customer.docNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Nombre</dt>
              <dd className="text-sm text-foreground">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Email</dt>
              <dd className="text-sm text-foreground">{customer.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Teléfono</dt>
              <dd className="text-sm text-foreground">{customer.phone ?? '—'}</dd>
            </div>
            {customer.address && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Dirección</dt>
                <dd className="text-sm text-foreground">{customer.address}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
