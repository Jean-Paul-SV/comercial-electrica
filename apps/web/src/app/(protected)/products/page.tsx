'use client';

import { useMemo, useState } from 'react';
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
import { EmptyState } from '@shared/components/EmptyState';
import { formatMoney } from '@shared/utils/format';
import { Package, Plus, Tag } from 'lucide-react';
import {
  useProductsList,
  useCreateProduct,
  useCategories,
  useCreateCategory,
} from '@features/products/hooks';

const productSchema = z.object({
  internalCode: z.string().min(1, 'Código requerido'),
  name: z.string().min(2, 'Nombre requerido'),
  categoryId: z.string().optional(),
  cost: z.coerce.number().min(0, 'Costo >= 0'),
  price: z.coerce.number().min(0, 'Precio >= 0'),
  taxRate: z.coerce.number().min(0).max(100).optional(),
});
type ProductFormValues = z.infer<typeof productSchema>;

const categorySchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [openNewProduct, setOpenNewProduct] = useState(false);
  const [openNewCategory, setOpenNewCategory] = useState(false);
  const limit = 20;
  const query = useProductsList({ page, limit });
  const categories = useCategories();
  const createProduct = useCreateProduct();
  const createCategory = useCreateCategory();

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;

  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      internalCode: '',
      name: '',
      cost: 0,
      price: 0,
      taxRate: 0,
    },
  });
  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' },
  });

  const onNewProduct = (values: ProductFormValues) => {
    createProduct.mutate(
      {
        internalCode: values.internalCode.trim(),
        name: values.name.trim(),
        categoryId: values.categoryId || undefined,
        cost: values.cost,
        price: values.price,
        taxRate: values.taxRate ?? 0,
      },
      {
        onSuccess: () => {
          toast.success('Producto creado');
          setOpenNewProduct(false);
          productForm.reset();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear el producto');
        },
      }
    );
  };

  const onNewCategory = (values: CategoryFormValues) => {
    createCategory.mutate(
      { name: values.name.trim() },
      {
        onSuccess: () => {
          toast.success('Categoría creada');
          setOpenNewCategory(false);
          categoryForm.reset();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear la categoría');
        },
      }
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Productos</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo y stock de productos
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-medium">
                Catálogo
              </CardTitle>
              <CardDescription>
                Listado paginado de productos
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenNewCategory(true)}
                className="gap-2 w-full sm:w-auto"
              >
                <Tag className="h-4 w-4 shrink-0" />
                Nueva categoría
              </Button>
              <Button size="sm" onClick={() => setOpenNewProduct(true)} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4 shrink-0" />
                Nuevo producto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Pagination
            meta={meta}
            onPageChange={setPage}
            label="Página"
          />

          {query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-4">
              {(query.error as { message?: string })?.message ??
                'Error al cargar productos'}
            </p>
          )}

          {!query.isLoading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-muted-foreground text-sm">
                        {p.internalCode}
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.category?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(p.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.stock?.qtyOnHand ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <EmptyState
                          message="No hay productos"
                          description="Crea uno para comenzar"
                          icon={Package}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openNewCategory} onOpenChange={setOpenNewCategory}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Nueva categoría
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={categoryForm.handleSubmit(onNewCategory)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nombre</Label>
              <Input
                id="cat-name"
                {...categoryForm.register('name')}
                placeholder="Ej: Cables"
                className="rounded-lg"
              />
              {categoryForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {categoryForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNewCategory(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createCategory.isPending}>
                {createCategory.isPending ? 'Guardando…' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openNewProduct} onOpenChange={setOpenNewProduct}>
        <DialogContent showClose className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo producto
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={productForm.handleSubmit(onNewProduct)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="internalCode">Código interno</Label>
                <Input
                  id="internalCode"
                  {...productForm.register('internalCode')}
                  placeholder="PROD-001"
                  className="rounded-lg"
                />
                {productForm.formState.errors.internalCode && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.internalCode.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  {...productForm.register('name')}
                  placeholder="Nombre del producto"
                  className="rounded-lg"
                />
                {productForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="categoryId">Categoría</Label>
                <select
                  id="categoryId"
                  {...productForm.register('categoryId')}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Sin categoría</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Costo (COP)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  {...productForm.register('cost')}
                  className="rounded-lg"
                />
                {productForm.formState.errors.cost && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.cost.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Precio (COP)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  {...productForm.register('price')}
                  className="rounded-lg"
                />
                {productForm.formState.errors.price && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.price.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">IVA (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  {...productForm.register('taxRate')}
                  className="rounded-lg"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNewProduct(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createProduct.isPending}>
                {createProduct.isPending ? 'Guardando…' : 'Crear producto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
