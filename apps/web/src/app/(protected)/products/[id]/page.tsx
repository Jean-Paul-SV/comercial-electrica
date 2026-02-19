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
import { ArrowLeft, Package, Pencil, Hash, FolderOpen, DollarSign, Tag, TrendingUp, Percent, Boxes, Lock, Layers } from 'lucide-react';
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
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-6 w-32 rounded" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
        <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/60">
            <Skeleton className="h-6 w-36 rounded" />
            <Skeleton className="h-4 w-72 rounded mt-2" />
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <Link href="/products" className="inline-flex">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver a productos
          </Button>
        </Link>
        <Card className="border border-destructive/40 shadow-sm rounded-xl overflow-hidden bg-destructive/5">
          <CardContent className="pt-6 pb-6">
            <p className="text-sm text-destructive font-medium">
              {(error as { message?: string })?.message ?? 'Producto no encontrado.'}
            </p>
            <Link href="/products" className="inline-block mt-3">
              <Button variant="outline" size="sm">Ver listado</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cost = Number(product.cost ?? 0);
  const price = Number(product.price ?? 0);
  const taxRate = Number(product.taxRate ?? 0);
  const marginCurrent = cost > 0 ? ((price - cost) / cost) * 100 : 0;
  const qtyOnHand = product.stock?.qtyOnHand ?? null;
  const qtyReserved = product.stock?.qtyReserved ?? null;

  const dataCardClass =
    'rounded-lg border border-border/60 bg-muted/30 dark:bg-muted/20 p-4 flex items-center gap-3 min-w-0';
  const iconWrapClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/products" className="inline-flex">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a productos
          </Button>
        </Link>
        <Link href="/products" className="w-full sm:w-auto">
          <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
            <Pencil className="h-4 w-4" />
            Ir a listado para editar
          </Button>
        </Link>
      </div>

      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl flex items-center gap-2 flex-wrap">
          <span>{product.name}</span>
          <Badge variant={product.isActive ? 'success' : 'secondary'} className="font-medium">
            {product.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          {product.internalCode}
          {product.category ? ` · ${product.category.name}` : ''}
        </p>
      </header>

      <Card className="overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <span className={iconWrapClass}>
              <Package className="h-4 w-4" />
            </span>
            Parte actual
          </CardTitle>
          <CardDescription>
            {product.name} · Código: {product.internalCode}
            {product.category ? ` · Categoría: ${product.category.name}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Columna izquierda: Identificación + Inventario */}
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Identificación
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className={dataCardClass}>
                    <span className={iconWrapClass}>
                      <Hash className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Código interno</p>
                      <p className="text-sm font-mono font-medium text-foreground mt-0.5 truncate">{product.internalCode}</p>
                    </div>
                  </div>
                  <div className={dataCardClass}>
                    <span className={iconWrapClass}>
                      <FolderOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Categoría</p>
                      <p className="text-sm font-medium text-foreground mt-0.5 truncate" title={product.category?.name ?? undefined}>
                        {product.category?.name ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className={dataCardClass}>
                    <span className={iconWrapClass}>
                      <Tag className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Estado</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Inventario
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className={dataCardClass}>
                    <span className={iconWrapClass}>
                      <Boxes className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Stock en mano</p>
                      <p className="text-sm tabular-nums font-medium text-foreground mt-0.5">{qtyOnHand ?? '—'}</p>
                    </div>
                  </div>
                  <div className={dataCardClass}>
                    <span className={iconWrapClass}>
                      <Lock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Reservado</p>
                      <p className="text-sm tabular-nums font-medium text-foreground mt-0.5">{qtyReserved ?? '—'}</p>
                    </div>
                  </div>
                  <div className={dataCardClass}>
                    <span className={iconWrapClass}>
                      <Layers className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Stock mínimo</p>
                      <p className="text-sm tabular-nums font-medium text-foreground mt-0.5">
                        {product.minStock != null ? product.minStock : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Columna derecha: Precios */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Precios
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={dataCardClass}>
                  <span className={iconWrapClass}>
                    <DollarSign className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Costo</p>
                    <p className="text-sm tabular-nums font-medium text-foreground mt-0.5">{formatMoney(cost)}</p>
                  </div>
                </div>
                <div className={dataCardClass}>
                  <span className={iconWrapClass}>
                    <Tag className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Precio de venta</p>
                    <p className="text-sm tabular-nums font-medium text-foreground mt-0.5">{formatMoney(price)}</p>
                  </div>
                </div>
                <div className={dataCardClass}>
                  <span className={iconWrapClass}>
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Margen actual</p>
                    <p className="text-sm tabular-nums font-medium text-foreground mt-0.5">{marginCurrent.toFixed(1)}%</p>
                  </div>
                </div>
                <div className={dataCardClass}>
                  <span className={iconWrapClass}>
                    <Percent className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">IVA</p>
                    <p className="text-sm tabular-nums font-medium text-foreground mt-0.5">{taxRate}%</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
