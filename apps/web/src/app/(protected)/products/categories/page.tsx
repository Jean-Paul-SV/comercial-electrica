'use client';

import { useState } from 'react';
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
import { EmptyState } from '@shared/components/EmptyState';
import { Tag, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@features/products/hooks';

export default function CategoriesPage() {
  const categoriesQuery = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<null | { id: string; name: string }>(
    null,
  );
  const [newName, setNewName] = useState('');
  const [editName, setEditName] = useState('');

  const categories = categoriesQuery.data ?? [];

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Escribe el nombre de la categoría');
      return;
    }
    createCategory.mutate(
      { name },
      {
        onSuccess: () => {
          toast.success('Categoría creada');
          setNewName('');
          setOpenNew(false);
        },
        onError: (e: unknown) => {
          const msg =
            (e as { message?: string })?.message ??
            'No se pudo crear la categoría';
          toast.error(msg);
        },
      },
    );
  };

  const handleUpdate = () => {
    if (!openEdit) return;
    const name = editName.trim();
    if (!name) {
      toast.error('Escribe el nombre de la categoría');
      return;
    }
    updateCategory.mutate(
      { id: openEdit.id, payload: { name } },
      {
        onSuccess: () => {
          toast.success('Categoría actualizada');
          setOpenEdit(null);
        },
        onError: (e: unknown) => {
          const msg =
            (e as { message?: string })?.message ??
            'No se pudo actualizar la categoría';
          toast.error(msg);
        },
      },
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (
      !confirm(
        `¿Eliminar la categoría "${name}"? Solo se pueden eliminar categorías sin productos asociados.`,
      )
    )
      return;
    deleteCategory.mutate(id, {
      onSuccess: () => {
        toast.success('Categoría eliminada');
      },
      onError: (e: unknown) => {
        const msg =
          (e as { message?: string })?.message ??
          'No se pudo eliminar la categoría. Verifica que no tenga productos asociados.';
        toast.error(msg);
      },
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Tag className="h-5 w-5 shrink-0 text-primary" />
            Categorías
          </h1>
          <p className="text-sm text-muted-foreground">
            Organiza productos por categoría (Cables, Iluminación, Herrajes, etc.).
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setNewName('');
            setOpenNew(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de categorías</CardTitle>
          <CardDescription>
            Puedes renombrar o eliminar categorías. Solo se pueden borrar si no
            tienen productos asociados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categoriesQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-1/2 rounded-lg" />
            </div>
          ) : categoriesQuery.isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {(categoriesQuery.error as { message?: string })?.message ??
                'No se pudieron cargar las categorías.'}
            </div>
          ) : categories.length === 0 ? (
            <EmptyState
              message="Sin categorías"
              description="Crea tu primera categoría para organizar el catálogo."
              icon={Tag}
              action={
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setNewName('');
                    setOpenNew(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Nueva categoría
                </Button>
              }
              className="py-10"
            />
          ) : (
            <div className="rounded-lg border border-border/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/80">
                    <TableHead className="font-medium text-muted-foreground">
                      Nombre
                    </TableHead>
                    <TableHead className="w-32 text-center font-medium text-muted-foreground">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/40">
                      <TableCell>{c.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setOpenEdit({ id: c.id, name: c.name });
                              setEditName(c.name);
                            }}
                            aria-label="Renombrar categoría"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(c.id, c.name)}
                            aria-label="Eliminar categoría"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Dialog nueva categoría */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-category-name">Nombre</Label>
              <Input
                id="new-category-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Cables"
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenNew(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createCategory.isPending}
            >
              {createCategory.isPending ? 'Guardando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar categoría */}
      <Dialog
        open={openEdit != null}
        onOpenChange={(open) => {
          if (!open) setOpenEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renombrar categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">Nombre</Label>
              <Input
                id="edit-category-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ej: Cables"
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenEdit(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleUpdate}
              disabled={updateCategory.isPending}
            >
              {updateCategory.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

