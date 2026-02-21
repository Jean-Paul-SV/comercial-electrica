'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { MoneyInput } from '@shared/components/ui/money-input';
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
import Link from 'next/link';
import { Package, Plus, Tag, Pencil, Eye, BookOpen, Trash2, AlertTriangle, ArrowLeft } from 'lucide-react';
import {
  useProductsList,
  useCreateProduct,
  useUpdateProduct,
  useProduct,
  useCategories,
  useCreateCategory,
  useCreateProductDictionaryEntry,
  useDeleteProduct,
} from '@features/products/hooks';
import { useCreateMovement } from '@features/inventory/hooks';
import { useLowStockThreshold } from '@shared/hooks/useLowStockThreshold';

const productSchema = z.object({
  internalCode: z.string().min(1, 'Código requerido'),
  name: z.string().min(2, 'Nombre requerido'),
  categoryId: z.string().optional(),
  cost: z.coerce.number().min(0, 'Costo >= 0'),
  marginPercent: z.coerce.number().min(0, 'Margen >= 0'),
  salePrice: z.optional(
    z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number().min(0, 'Precio >= 0').optional()
    )
  ),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  minStock: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0, 'Mínimo >= 0').optional()
  ),
  initialQuantity: z.coerce.number().min(0, 'Cantidad >= 0').optional(),
});
type ProductFormValues = z.infer<typeof productSchema>;

const categorySchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const urlLowStock = searchParams.get('lowStock') === 'true' || searchParams.get('lowStock') === '1';
  const urlThreshold = searchParams.get('lowStockThreshold');
  const [lowStockThreshold] = useLowStockThreshold();
  const [page, setPage] = useState(1);
  const [openNewProduct, setOpenNewProduct] = useState(false);
  const [openNewCategory, setOpenNewCategory] = useState(false);
  const [openAddTerm, setOpenAddTerm] = useState(false);
  const [addTermText, setAddTermText] = useState('');
  const [addTermProductId, setAddTermProductId] = useState<string>('');
  const [addCategoryFromProductForm, setAddCategoryFromProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string; stockQty: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const limit = 20;
  const threshold = useMemo(() => {
    if (urlThreshold != null) {
      const n = parseInt(urlThreshold, 10);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
    return lowStockThreshold;
  }, [urlThreshold, lowStockThreshold]);
  const listParams = useMemo(
    () => ({
      page,
      limit,
      search: searchTerm.trim() || undefined,
      ...(urlLowStock ? { lowStock: true as const, lowStockThreshold: threshold } : {}),
    }),
    [page, limit, searchTerm, urlLowStock, threshold]
  );
  const query = useProductsList(listParams);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);
  const queryClient = useQueryClient();
  const categories = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const createCategory = useCreateCategory();
  const createDictionaryEntry = useCreateProductDictionaryEntry();
  const createMovement = useCreateMovement();
  const productToEdit = useProduct(editingProductId);
  const deleteProduct = useDeleteProduct();
  const productsForDictionary = useProductsList({ page: 1, limit: 100 });

  const rowsRaw = useMemo(() => query.data?.data ?? [], [query.data]);
  const rows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term || rowsRaw.length === 0) return rowsRaw;
    return [...rowsRaw].sort((a, b) => {
      const nameA = (a.name ?? '').toLowerCase();
      const nameB = (b.name ?? '').toLowerCase();
      const codeA = (a.internalCode ?? '').toLowerCase();
      const codeB = (b.internalCode ?? '').toLowerCase();
      const score = (name: string, code: string) => {
        if (name === term || code === term) return 0;
        if (name.startsWith(term) || code.startsWith(term)) return 1;
        if (name.includes(term) || code.includes(term)) return 2;
        return 3;
      };
      return score(nameA, codeA) - score(nameB, codeB);
    });
  }, [rowsRaw, searchTerm]);
  const meta = query.data?.meta;

  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      internalCode: '',
      name: '',
      cost: undefined as number | undefined,
      marginPercent: undefined as number | undefined,
      salePrice: undefined as number | undefined,
      taxRate: undefined as number | undefined,
      minStock: undefined as number | undefined,
      initialQuantity: undefined as number | undefined,
    },
  });

  // Sincronizar Margen (%) ↔ Precio de venta: al cambiar uno se actualiza el otro
  const syncProgrammaticRef = useRef(false);
  const costW = productForm.watch('cost');
  const marginW = productForm.watch('marginPercent');
  const salePriceW = productForm.watch('salePrice');

  useEffect(() => {
    if (syncProgrammaticRef.current) {
      syncProgrammaticRef.current = false;
      return;
    }
    const costNum = Number(costW) || 0;
    const marginNum = Number(marginW) || 0;
    if (costNum > 0) {
      const price = Math.round(costNum * (1 + marginNum / 100) * 100) / 100;
      syncProgrammaticRef.current = true;
      productForm.setValue('salePrice', price);
    }
  }, [costW, marginW]);

  useEffect(() => {
    if (syncProgrammaticRef.current) {
      syncProgrammaticRef.current = false;
      return;
    }
    const costNum = Number(costW) || 0;
    const saleNum = typeof salePriceW === 'number' ? salePriceW : Number(salePriceW);
    if (costNum > 0 && saleNum > 0 && Number.isFinite(saleNum)) {
      const margin = Math.round(((saleNum / costNum) - 1) * 10000) / 100;
      syncProgrammaticRef.current = true;
      productForm.setValue('marginPercent', Math.max(0, margin));
    }
  }, [costW, salePriceW]);

  // Cargar datos del producto cuando se abre el modal de edición
  useEffect(() => {
    if (productToEdit.data && editingProductId) {
      const cost = productToEdit.data.cost ? Number(productToEdit.data.cost) : 0;
      const price = productToEdit.data.price ? Number(productToEdit.data.price) : 0;
      const marginPercent = cost > 0 ? ((price / cost) - 1) * 100 : 0;
      productForm.reset({
        internalCode: productToEdit.data.internalCode ?? '',
        name: productToEdit.data.name ?? '',
        categoryId: productToEdit.data.categoryId ?? '',
        cost,
        marginPercent: Math.max(0, Math.round(marginPercent * 100) / 100),
        salePrice: price > 0 ? price : undefined,
        taxRate: productToEdit.data.taxRate ? Number(productToEdit.data.taxRate) : 0,
        minStock: productToEdit.data.minStock != null ? Number(productToEdit.data.minStock) : undefined,
        initialQuantity: 0,
      });
    } else if (!editingProductId) {
      productForm.reset({
        internalCode: '',
        name: '',
        cost: 0,
        marginPercent: 0,
        salePrice: undefined,
        taxRate: 0,
        minStock: undefined,
        initialQuantity: 0,
      });
    }
  }, [productToEdit.data, editingProductId, productForm]);
  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' },
  });

  const getPrice = (values: ProductFormValues) => {
    const manual = values.salePrice;
    if (typeof manual === 'number' && manual > 0 && Number.isFinite(manual)) return manual;
    return values.cost * (1 + values.marginPercent / 100);
  };

  const onNewProduct = (values: ProductFormValues) => {
    const price = getPrice(values);
    const initialQty = Number(values.initialQuantity) || 0;
    const minStock =
      typeof values.minStock === 'number' && Number.isFinite(values.minStock) && values.minStock >= 0
        ? values.minStock
        : undefined;
    createProduct.mutate(
      {
        internalCode: values.internalCode.trim(),
        name: values.name.trim(),
        categoryId: values.categoryId || undefined,
        cost: values.cost,
        price,
        taxRate: values.taxRate ?? 0,
        minStock: minStock ?? null,
      },
      {
        onSuccess: (data) => {
          setOpenNewProduct(false);
          productForm.reset();
          if (initialQty > 0 && data?.id) {
            createMovement.mutate(
              {
                type: 'IN',
                reason: 'Stock inicial al crear producto',
                items: [{ productId: data.id, qty: initialQty, unitCost: values.cost }],
              },
              {
                onSuccess: () => {
                  toast.success(`Producto creado y ${initialQty} unidad(es) agregada(s) al inventario.`);
                },
                onError: () => {
                  toast.success('Producto creado.');
                  toast.warning('No se pudo registrar la cantidad inicial. Regístrala desde Inventario.');
                },
              }
            );
          } else {
            toast.success('Producto creado');
          }
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear el producto');
        },
      }
    );
  };

  const onUpdateProduct = (values: ProductFormValues) => {
    if (!editingProductId) return;
    const price = getPrice(values);
    const minStock =
      typeof values.minStock === 'number' && Number.isFinite(values.minStock) && values.minStock >= 0
        ? values.minStock
        : null;
    updateProduct.mutate(
      {
        id: editingProductId,
        payload: {
          internalCode: values.internalCode.trim(),
          name: values.name.trim(),
          categoryId: values.categoryId || undefined,
          cost: values.cost,
          price,
          taxRate: values.taxRate ?? 0,
          minStock,
        },
      },
      {
        onSuccess: () => {
          toast.success('Producto actualizado');
          setEditingProductId(null);
          productForm.reset();
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo actualizar el producto');
        },
      }
    );
  };

  const onNewCategory = (values: CategoryFormValues) => {
    createCategory.mutate(
      { name: values.name.trim() },
      {
        onSuccess: async (data) => {
          toast.success('Categoría creada');
          setOpenNewCategory(false);
          categoryForm.reset();
          if (addCategoryFromProductForm && data?.id) {
            await queryClient.refetchQueries({ queryKey: ['categories'] });
            productForm.setValue('categoryId', data.id);
            setAddCategoryFromProductForm(false);
          }
        },
        onError: (e: { message?: string }) => {
          toast.error(e?.message ?? 'No se pudo crear la categoría');
        },
      }
    );
  };

  const openNewCategoryFromProductForm = () => {
    setAddCategoryFromProductForm(true);
    setOpenNewCategory(true);
  };

  const totalProducts = meta?.total ?? 0;
  const hasData = rows.length > 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pt-2 pb-2">
        <div className="flex items-center gap-4 min-w-0 w-full sm:flex-1 sm:min-w-0">
          <Button variant="ghost" size="icon" asChild className="shrink-0 rounded-lg">
            <Link href="/app">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver al inicio</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <Package className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Productos
            </h1>
            <p className="mt-2 text-sm text-muted-foreground w-full">
              Catálogo de productos (código, nombre, categoría, precios). El stock se gestiona en Inventario.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setOpenNewCategory(true)} className="gap-2 rounded-xl">
            <Tag className="h-4 w-4 shrink-0" />
            Nueva categoría
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-2 rounded-xl">
            <Link href="/products/dictionary" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 shrink-0" />
              Diccionario
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpenAddTerm(true)} className="gap-2 rounded-xl">
            <BookOpen className="h-4 w-4 shrink-0" />
            Agregar término
          </Button>
          <Button size="sm" onClick={() => setOpenNewProduct(true)} className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-4 w-4 shrink-0" />
            Nuevo producto
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-muted/20 p-5 shadow-sm dark:bg-[#111827] dark:border-[#1F2937] sm:p-6">
        <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Label htmlFor="search-product" className="text-xs text-muted-foreground whitespace-nowrap">
                Buscar:
              </Label>
              <Input
                id="search-product"
                type="text"
                placeholder="Nombre o código del producto"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            {searchTerm.trim() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar búsqueda
              </Button>
            )}
            {searchTerm.trim() && (
              <p className="text-xs text-muted-foreground w-full">
                Buscando «<span className="font-medium text-foreground">{searchTerm.trim()}</span>» — {rows.length} resultado{rows.length !== 1 ? 's' : ''} (ordenados por lo más parecido)
              </p>
            )}
            {urlLowStock && (
              <p className="text-xs text-muted-foreground w-full">
                Filtro activo: stock bajo (≤ {threshold} unidades).
              </p>
            )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm shadow-black/[0.03] dark:shadow-none overflow-x-auto">
          {query.isLoading && (
            <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-muted-foreground">Código</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Nombre</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Categoría</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Precio</TableHead>
                    <TableHead className="w-20 text-center font-medium text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-20 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto rounded" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 mx-auto rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}

          {query.isError && (
            <p className="text-sm text-destructive py-8 px-6">
              {(query.error as { message?: string })?.message ??
                'Error al cargar productos'}
            </p>
          )}

          {!query.isLoading && !query.isError && (
            <>
              <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="font-medium text-muted-foreground">Código</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Nombre</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Categoría</TableHead>
                      <TableHead className="text-right font-medium text-muted-foreground">Precio</TableHead>
                      <TableHead className="w-20 text-center font-medium text-muted-foreground">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => (
                      <TableRow
                        key={p.id}
                        className="transition-colors hover:bg-muted/40"
                      >
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {p.internalCode}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          <Link
                            href={`/products/${p.id}`}
                            className="hover:underline text-foreground"
                          >
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.category?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-foreground">
                          {formatMoney(p.price)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <Link href={`/products/${p.id}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Ver detalle"
                                aria-label="Ver detalle"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingProductId(p.id)}
                              title="Editar producto"
                              aria-label="Editar producto"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setProductToDelete({ id: p.id, name: p.name, stockQty: p.stock?.qtyOnHand ?? 0 })}
                              title="Eliminar producto"
                              aria-label="Eliminar producto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="p-0 align-top">
                          <EmptyState
                            message="No hay productos"
                            description="Crea un producto o una categoría para organizar tu catálogo."
                            icon={Package}
                            className="py-16"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              {meta && (meta.total > 0 || meta.totalPages > 1) && (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {meta.total > 0
                      ? `Mostrando ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total}`
                      : '0 resultados'}
                  </p>
                  <Pagination meta={meta} onPageChange={setPage} label="Página" />
                </div>
              )}
            </>
          )}
      </div>

      <Dialog
        open={openNewCategory}
        onOpenChange={(open) => {
          if (!open) setAddCategoryFromProductForm(false);
          setOpenNewCategory(open);
        }}
      >
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Nueva categoría
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Las categorías sirven para organizar productos (ej. Cables, Iluminación, Herrajes).
            </p>
          </DialogHeader>
          <form
            onSubmit={categoryForm.handleSubmit(onNewCategory)}
            className="space-y-4"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
              Nombre de la categoría
            </p>
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nombre</Label>
              <Input
                id="cat-name"
                {...categoryForm.register('name')}
                placeholder="Ej: Cables"
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">
                Nombre corto y claro para filtrar y agrupar productos.
              </p>
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

      <Dialog open={openAddTerm} onOpenChange={setOpenAddTerm}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Agregar término al diccionario
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              El término se agregará al diccionario. Opcionalmente puedes vincularlo a un producto.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-term-text">Término o frase</Label>
              <Input
                id="add-term-text"
                value={addTermText}
                onChange={(e) => setAddTermText(e.target.value)}
                placeholder="Ej: cable 2.5, foco led"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-term-product">Producto vinculado (opcional)</Label>
              <select
                id="add-term-product"
                value={addTermProductId}
                onChange={(e) => setAddTermProductId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Ninguno</option>
                {(productsForDictionary.data?.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.internalCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenAddTerm(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!addTermText.trim() || createDictionaryEntry.isPending}
              onClick={() => {
                const term = addTermText.trim();
                if (!term) return;
                createDictionaryEntry.mutate(
                  { term, productId: addTermProductId || undefined },
                  {
                    onSuccess: () => {
                      toast.success('Término agregado al diccionario');
                      setOpenAddTerm(false);
                      setAddTermText('');
                      setAddTermProductId('');
                    },
                    onError: (e) =>
                      toast.error((e as Error)?.message ?? 'Error al agregar al diccionario'),
                  }
                );
              }}
            >
              {createDictionaryEntry.isPending ? 'Agregando…' : 'Agregar al diccionario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openNewProduct || editingProductId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenNewProduct(false);
            setEditingProductId(null);
          }
        }}
      >
        <DialogContent showClose className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingProductId ? (
                <>
                  <Pencil className="h-4 w-4" />
                  Editar producto
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Nuevo producto
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={productForm.handleSubmit(
              editingProductId ? onUpdateProduct : onNewProduct
            )}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="internalCode">Código interno</Label>
                <Input
                  id="internalCode"
                  {...productForm.register('internalCode')}
                  placeholder="Ej: PROD-001, CBL-2024"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Identificador único del producto. Úsalo para referencia interna o códigos de barras.
                </p>
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
                  placeholder="Ej: Cable THHN 12 AWG"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Nombre descriptivo del producto que aparecerá en facturas y cotizaciones.
                </p>
                {productForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="categoryId">Categoría</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-primary hover:text-primary"
                    onClick={openNewCategoryFromProductForm}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Agregar categoría
                  </Button>
                </div>
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
                <p className="text-xs text-muted-foreground">
                  Opcional. Si no existe la categoría, usa &quot;Agregar categoría&quot; para crearla y asignarla.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Costo (COP)</Label>
                <Controller
                  control={productForm.control}
                  name="cost"
                  render={({ field }) => (
                    <MoneyInput
                      id="cost"
                      className="rounded-lg"
                      placeholder="15.000"
                      value={field.value ?? undefined}
                      onChangeValue={(val) => field.onChange(val ?? undefined)}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Costo de compra o producción del producto. Se usa para calcular márgenes de ganancia.
                </p>
                {productForm.formState.errors.cost && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.cost.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginPercent">Margen (%)</Label>
                <Input
                  id="marginPercent"
                  type="number"
                  step="0.01"
                  min={0}
                  {...productForm.register('marginPercent')}
                  placeholder="30"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Porcentaje de ganancia sobre el costo. El precio de venta se calcula: costo × (1 + margen %).
                </p>
                {productForm.formState.errors.marginPercent && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.marginPercent.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="salePrice">Precio de venta (COP)</Label>
                <Controller
                  control={productForm.control}
                  name="salePrice"
                  render={({ field }) => (
                    <MoneyInput
                      id="salePrice"
                      className="rounded-lg"
                      placeholder="Ej: 25.000"
                      value={field.value ?? undefined}
                      onChangeValue={(val) => field.onChange(val ?? undefined)}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Precio que piensas colocar. Si lo ingresas, se usará este valor en lugar del calculado por costo y margen.
                </p>
                {productForm.formState.errors.salePrice && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.salePrice.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">IVA (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  {...productForm.register('taxRate')}
                  placeholder="19"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Porcentaje de impuesto sobre el valor añadido. Opcional. Por defecto es 0% si no se especifica.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Stock mínimo (opcional)</Label>
                <Input
                  id="minStock"
                  type="number"
                  min={0}
                  step={1}
                  {...productForm.register('minStock')}
                  placeholder="Ej: 5"
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Alerta cuando el stock en mano sea ≤ este valor. Si no se define, se usa el umbral global de Inventario.
                </p>
                {productForm.formState.errors.minStock && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.minStock.message}
                  </p>
                )}
              </div>
              {!editingProductId && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="initialQuantity">Cantidad inicial (opcional)</Label>
                  <Input
                    id="initialQuantity"
                    type="number"
                    min={0}
                    step={1}
                    {...productForm.register('initialQuantity')}
                    placeholder="Ej: 0"
                    className="rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Unidades que entran al inventario al crear el producto. Si indicas un valor mayor a 0, se registrará una entrada de stock automáticamente.
                  </p>
                </div>
              )}
              {(() => {
                const cost = Number(productForm.watch('cost')) || 0;
                const marginPercent = Number(productForm.watch('marginPercent')) || 0;
                const salePriceRaw = productForm.watch('salePrice');
                const salePrice = typeof salePriceRaw === 'number' && salePriceRaw > 0 && Number.isFinite(salePriceRaw) ? salePriceRaw : undefined;
                const taxRate = Number(productForm.watch('taxRate')) || 0;
                const price = salePrice ?? cost * (1 + marginPercent / 100);
                const totalWithTax = price * (1 + taxRate / 100);
                return (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex justify-between items-center text-sm sm:col-span-2">
                    <span className="font-medium text-muted-foreground">Valor total (precio + IVA)</span>
                    <span className="tabular-nums font-semibold text-base">{formatMoney(totalWithTax)}</span>
                  </div>
                );
              })()}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenNewProduct(false);
                  setEditingProductId(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  editingProductId
                    ? updateProduct.isPending || productToEdit.isLoading
                    : createProduct.isPending
                }
              >
                {editingProductId
                  ? updateProduct.isPending
                    ? 'Guardando…'
                    : 'Guardar cambios'
                  : createProduct.isPending
                    ? 'Guardando…'
                    : 'Crear producto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar producto */}
      <Dialog
        open={!!productToDelete}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
      >
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Eliminar producto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              ¿Eliminar el producto <strong>{productToDelete?.name}</strong>?
            </p>
            {productToDelete && productToDelete.stockQty > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-warning-foreground">
                      Este producto tiene {productToDelete.stockQty} unidad(es) en stock.
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Al eliminar el producto, el stock se perderá y no podrás recuperarlo. Si prefieres mantener el historial, considera desactivar el producto en lugar de eliminarlo.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. El producto se desactivará y dejará de aparecer en el catálogo.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setProductToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!productToDelete) return;
                deleteProduct.mutate(productToDelete.id, {
                  onSuccess: () => {
                    toast.success('Producto eliminado');
                    setProductToDelete(null);
                  },
                  onError: (e: { message?: string }) => {
                    toast.error(e?.message ?? 'No se pudo eliminar el producto');
                  },
                });
              }}
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending ? 'Eliminando…' : 'Eliminar producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
