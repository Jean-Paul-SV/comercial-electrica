'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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

  if (isError || !customer) {
    return (
      <div className="space-y-10">
        <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
          <Link href="/customers">
            <ArrowLeft className="h-4 w-4" />
            Volver a clientes
          </Link>
        </Button>
        <div className="rounded-2xl border border-destructive/50 bg-card p-6">
          <p className="text-sm text-destructive">
            {(error as { message?: string })?.message ?? 'Cliente no encontrado.'}
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
            <Users className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            {customer.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {DOC_LABELS[customer.docType] ?? customer.docType}: {customer.docNumber}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
            <Link href="/customers">
              <ArrowLeft className="h-4 w-4" />
              Volver a clientes
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href="/customers">
              <Pencil className="h-4 w-4" />
              Ir a listado para editar
            </Link>
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="pb-4 border-b border-border/60 px-6 pt-6">
          <h2 className="text-lg font-medium text-foreground">Datos del cliente</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {customer.name} · {DOC_LABELS[customer.docType] ?? customer.docType} {customer.docNumber}
          </p>
        </div>
        <div className="pt-6 px-6 pb-6 space-y-4">
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
        </div>
      </div>
    </div>
  );
}
