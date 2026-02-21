'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
      <div className="space-y-10 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-72 mt-2" />
          <div className="grid gap-4 sm:grid-cols-3 mt-6">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="space-y-10 max-w-5xl mx-auto">
        <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            Volver a productos
          </Link>
        </Button>
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm text-destructive font-medium">
            {(error as { message?: string })?.message ?? 'Producto no encontrado.'}
          </p>
          <Link href="/products" className="inline-block mt-3">
            <Button variant="outline" size="sm">Ver listado</Button>
          </Link>
        </div>
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
    <div className="space-y-10 max-w-5xl mx-auto">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2 flex-wrap">
            <Package className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            <span>{product.name}</span>
            <Badge variant={product.isActive ? 'success' : 'secondary'} className="font-medium">
              {product.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-mono">
            {product.internalCode}
            {product.category ? ` · ${product.category.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
            <Link href="/products">
              <ArrowLeft className="h-4 w-4" />
              Volver a productos
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link href="/products">
              <Pencil className="h-4 w-4" />
              Ir a listado para editar
            </Link>
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
        <div className="pb-4 border-b border-border/60 px-6 pt-6">
          <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
            <span className={iconWrapClass}>
              <Package className="h-4 w-4" />
            </span>
            Parte actual
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {product.name} · Código: {product.internalCode}
            {product.category ? ` · Categoría: ${product.category.name}` : ''}
          </p>
        </div>
        <div className="pt-6 px-6 pb-6">
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
        </div>
      </div>
    </div>
  );
}
