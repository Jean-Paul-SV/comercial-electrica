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
import { ArrowLeft, Package, Pencil } from 'lucide-react';
import { useProduct } from '@features/products/hooks';
import { formatMoney } from '@shared/utils/format';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data: product, isLoading, isError, error } = useProduct(id);

  if (!id) {
    router.replace('/products');
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
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="space-y-6">
        <Link href="/products">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a productos
          </Button>
        </Link>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {(error as { message?: string })?.message ?? 'Producto no encontrado.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cost = Number(product.cost ?? 0);
  const price = Number(product.price ?? 0);
  const taxRate = Number(product.taxRate ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/products">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a productos
          </Button>
        </Link>
        <Link href="/products">
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="h-4 w-4" />
            Ir a listado para editar
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Detalle del producto
        </h1>
        <p className="text-sm text-muted-foreground">
          {product.internalCode} · {product.name}
        </p>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
            <Package className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            {product.name}
          </CardTitle>
          <CardDescription>
            Código: {product.internalCode}
            {product.category ? ` · Categoría: ${product.category.name}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Código interno</dt>
              <dd className="text-sm font-mono text-foreground">{product.internalCode}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Categoría</dt>
              <dd className="text-sm text-foreground">{product.category?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Costo</dt>
              <dd className="text-sm tabular-nums text-foreground">{formatMoney(cost)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Precio de venta</dt>
              <dd className="text-sm tabular-nums font-medium text-foreground">{formatMoney(price)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">IVA (%)</dt>
              <dd className="text-sm text-foreground">{taxRate}%</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Estado</dt>
              <dd className="text-sm text-foreground">{product.isActive ? 'Activo' : 'Inactivo'}</dd>
            </div>
            {product.stock != null && (
              <>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Stock en mano</dt>
                  <dd className="text-sm tabular-nums text-foreground">{product.stock.qtyOnHand}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Reservado</dt>
                  <dd className="text-sm tabular-nums text-foreground">{product.stock.qtyReserved}</dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
