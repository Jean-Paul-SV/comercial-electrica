'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { Select } from '@shared/components/ui/select';
import { Skeleton } from '@shared/components/ui/skeleton';
import { EmptyState } from '@shared/components/EmptyState';
import { BookOpen, Plus, ArrowLeft, Pencil, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProductDictionary,
  useCreateProductDictionaryEntry,
  useUpdateProductDictionaryEntry,
  useDeleteProductDictionaryEntry,
  useCategories,
  useCreateCategory,
} from '@features/products/hooks';

export default function ProductDictionaryPage() {
  const [search, setSearch] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTerm, setNewTerm] = useState('');
  const [newCategoryId, setNewCategoryId] = useState<string>('');
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [openNewCategory, setOpenNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addCategoryContext, setAddCategoryContext] = useState<'create' | 'edit' | null>(null);

  const dictionary = useProductDictionary({ search: search.trim() || undefined });
  const createEntry = useCreateProductDictionaryEntry();
  const updateEntry = useUpdateProductDictionaryEntry();
  const deleteEntry = useDeleteProductDictionaryEntry();
  const categoriesQuery = useCategories();
  const createCategory = useCreateCategory();

  const entries = dictionary.data?.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const categoriesLoading = categoriesQuery.isLoading;
  const categoriesError = categoriesQuery.isError;

  const handleCreate = () => {
    const term = newTerm.trim();
    if (!term) {
      toast.error('Escribe el término o frase');
      return;
    }
    createEntry.mutate(
      { term, categoryId: newCategoryId || undefined },
      {
        onSuccess: () => {
          toast.success('Término agregado al diccionario');
          setOpenCreate(false);
          setNewTerm('');
          setNewCategoryId('');
        },
        onError: (e) =>
          toast.error((e as Error)?.message ?? 'Error al agregar'),
      }
    );
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateEntry.mutate(
      { id: editingId, payload: { categoryId: editCategoryId || null } },
      {
        onSuccess: () => {
          toast.success('Entrada actualizada');
          setEditingId(null);
        },
        onError: (e) =>
          toast.error((e as Error)?.message ?? 'Error al actualizar'),
      }
    );
  };

  const handleDelete = (id: string, term: string) => {
    if (!confirm(`¿Eliminar "${term}" del diccionario?`)) return;
    deleteEntry.mutate(id, {
      onSuccess: () => toast.success('Entrada eliminada'),
      onError: (e) =>
        toast.error((e as Error)?.message ?? 'Error al eliminar'),
    });
  };

  const openEdit = (entry: { id: string; categoryId: string | null }) => {
    setEditingId(entry.id);
    setEditCategoryId(entry.categoryId ?? '');
  };

  const openAddCategoryFrom = (context: 'create' | 'edit') => {
    setAddCategoryContext(context);
    setNewCategoryName('');
    setOpenNewCategory(true);
  };

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Escribe el nombre de la categoría');
      return;
    }
    createCategory.mutate(
      { name },
      {
        onSuccess: (data) => {
          toast.success('Categoría creada');
          setOpenNewCategory(false);
          setNewCategoryName('');
          if (data?.id && addCategoryContext) {
            if (addCategoryContext === 'create') setNewCategoryId(data.id);
            else setEditCategoryId(data.id);
          }
          setAddCategoryContext(null);
        },
        onError: (e) =>
          toast.error((e as Error)?.message ?? 'Error al crear la categoría'),
      }
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
            Diccionario de búsqueda
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Términos o frases que los clientes escriben al preguntar por productos. Opcionalmente puedes vincular cada término a un producto.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
          <Link href="/products" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a productos
          </Link>
        </Button>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60">
          <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Términos que preguntan
          </CardTitle>
          <CardDescription>
            Agrega palabras o frases que la gente usa al buscar productos (ej. &quot;cable 2.5&quot;, &quot;foco led&quot;) y opcionalmente asígnales un producto.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] flex-wrap">
              <Label htmlFor="dict-search" className="text-xs text-muted-foreground whitespace-nowrap">
                Buscar término:
              </Label>
              <Input
                id="dict-search"
                type="text"
                placeholder="Filtrar por texto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg text-sm max-w-xs"
              />
              {search.trim() && !dictionary.isLoading && entries.length === 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2 shrink-0"
                  onClick={() => {
                    setNewTerm(search.trim());
                    setOpenCreate(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Agregar &quot;{search.trim()}&quot;
                </Button>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => {
                setNewTerm('');
                setOpenCreate(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Agregar término
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {dictionary.isLoading && (
            <div className="rounded-lg border border-border/80 overflow-hidden">
              <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-muted-foreground">Término</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Categoría vinculada</TableHead>
                    <TableHead className="w-24 text-right font-medium text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-48 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20 ml-auto rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {dictionary.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">
                {(dictionary.error as { message?: string })?.message ??
                  'Error al cargar el diccionario'}
              </p>
            </div>
          )}

          {!dictionary.isLoading && !dictionary.isError && entries.length === 0 && (
            <EmptyState
              icon={BookOpen}
              message={search.trim() ? 'No hay resultados para tu búsqueda' : 'No hay términos en el diccionario'}
              description={
                search.trim()
                  ? `No se encontró "${search.trim()}". Puedes agregarlo al diccionario.`
                  : 'Agrega términos o frases que los clientes escriben al preguntar por productos.'
              }
              action={
                search.trim() ? (
                  <Button
                    onClick={() => {
                      setNewTerm(search.trim());
                      setOpenCreate(true);
                    }}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar &quot;{search.trim()}&quot;
                  </Button>
                ) : (
                  <Button onClick={() => setOpenCreate(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Agregar término
                  </Button>
                )
              }
            />
          )}

          {!dictionary.isLoading && !dictionary.isError && entries.length > 0 && (
            <div className="rounded-lg border border-border/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-medium">Término</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Categoría vinculada</TableHead>
                    <TableHead className="w-28 text-right font-medium text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{entry.term}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.category ? entry.category.name : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEdit({ id: entry.id, categoryId: entry.categoryId ?? null })}
                            title="Editar vinculación"
                            aria-label="Editar vinculación"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(entry.id, entry.term)}
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog crear */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar término al diccionario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-term">Término o frase</Label>
              <Input
                id="new-term"
                placeholder="Ej. cable 2.5 rojo, foco led"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="new-category">Categoría vinculada (opcional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-primary hover:text-primary gap-1"
                  onClick={() => openAddCategoryFrom('create')}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Agregar categoría
                </Button>
              </div>
              {categoriesLoading ? (
                <p className="text-sm text-muted-foreground py-2">Cargando categorías…</p>
              ) : (
                <Select
                  id="new-category"
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                >
                  <option value="">Ninguna</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createEntry.isPending || !newTerm.trim()}
            >
              {createEntry.isPending ? 'Guardando…' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar (categoría vinculada) */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Categoría vinculada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Categoría vinculada</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-primary hover:text-primary gap-1"
                  onClick={() => openAddCategoryFrom('edit')}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Agregar categoría
                </Button>
              </div>
              {categoriesLoading ? (
                <p className="text-sm text-muted-foreground py-2">Cargando categorías…</p>
              ) : categoriesError ? (
                <p className="text-sm text-destructive py-2">
                  No se pudieron cargar las categorías. Revisa la conexión e intenta de nuevo.
                </p>
              ) : (
                <Select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                >
                  <option value="">Ninguna</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateEntry.isPending || categoriesLoading}
            >
              {updateEntry.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nueva categoría (desde diccionario) */}
      <Dialog
        open={openNewCategory}
        onOpenChange={(open) => {
          if (!open) setAddCategoryContext(null);
          setOpenNewCategory(open);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Nueva categoría
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-cat-name">Nombre</Label>
              <Input
                id="new-cat-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ej: Cables, Iluminación"
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewCategory(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim() || createCategory.isPending}
            >
              {createCategory.isPending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
