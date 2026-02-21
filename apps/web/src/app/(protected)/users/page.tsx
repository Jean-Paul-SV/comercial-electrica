'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Select } from '@shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@shared/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/components/ui/table';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Badge } from '@shared/components/ui/badge';
import Link from 'next/link';
import { UserPlus, ShieldAlert, Pencil, Trash2, Users, Camera, User, KeyRound, ArrowLeft } from 'lucide-react';
import { useRegisterUser, useUsersList, useUpdateUser, useDeleteUser, useUploadEmployeePicture } from '@features/auth/hooks';
import type { UserListItem } from '@features/auth/types';
import { useAuth } from '@shared/providers/AuthProvider';

const createUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
});
type CreateUserFormValues = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['ADMIN', 'USER']),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
});
type EditUserFormValues = z.infer<typeof editUserSchema>;

export default function UsersPage() {
  const { permissions, user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canCreate = isAdmin || (permissions?.includes('users:create') ?? false);
  const canRead = isAdmin || (permissions?.includes('users:read') ?? false);
  const canUpdate = isAdmin || (permissions?.includes('users:update') ?? false);
  const canDelete = isAdmin || (permissions?.includes('users:delete') ?? false);
  const registerUser = useRegisterUser();
  const usersList = useUsersList();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const uploadEmployeePictureMutation = useUploadEmployeePicture();
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserListItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [userToChangePicture, setUserToChangePicture] = useState<UserListItem | null>(null);
  const [userPhotoPreview, setUserPhotoPreview] = useState<UserListItem | null>(null);
  const pictureInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'USER',
    },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    values: editUser
      ? { name: editUser.name ?? '', role: editUser.role, password: '' }
      : undefined,
    defaultValues: { name: '', role: 'USER', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await registerUser.mutateAsync({
        email: values.email,
        name: values.name?.trim() || undefined,
        password: values.password,
        role: values.role,
      });
      toast.success('Usuario creado correctamente');
      form.reset({ name: '', email: '', password: '', role: 'USER' });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al crear el usuario';
      toast.error(message);
    }
  });

  const onEditOpen = (user: UserListItem) => {
    setEditUser(user);
    editForm.reset({ name: user.name ?? '', role: user.role, password: '' });
  };

  const onDeleteOpen = (u: UserListItem) => {
    setUserToDelete(u);
    setDeleteConfirmText('');
  };

  const onDeleteConfirm = async () => {
    if (!userToDelete || deleteConfirmText !== 'BORRAR') return;
    try {
      await deleteUserMutation.mutateAsync(userToDelete.id);
      toast.success('Usuario eliminado');
      setUserToDelete(null);
      setDeleteConfirmText('');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al eliminar el usuario';
      toast.error(message);
    }
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const employeeAvatarUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const base = API_BASE.replace(/\/$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const onEmployeePictureSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userToChangePicture) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Solo se permiten imágenes (JPEG, PNG, WebP)');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede exceder 5MB');
      e.target.value = '';
      return;
    }
    try {
      await uploadEmployeePictureMutation.mutateAsync({ userId: userToChangePicture.id, file });
      toast.success(`Foto de ${userToChangePicture.email} actualizada`);
      setUserToChangePicture(null);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al subir la foto';
      toast.error(message);
    }
    e.target.value = '';
  };

  const onEditSubmit = editForm.handleSubmit(async (values) => {
    if (!editUser) return;
    try {
      await updateUserMutation.mutateAsync({
        id: editUser.id,
        payload: {
          name: values.name?.trim() || undefined,
          role: values.role,
          ...(values.password?.trim() ? { password: values.password.trim() } : {}),
        },
      });
      toast.success('Usuario actualizado');
      setEditUser(null);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al actualizar';
      toast.error(message);
    }
  });

  if (!canCreate && !canRead) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-1 border-l-4 border-primary pl-4">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gestión de usuarios del tenant.</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] max-w-md p-6 dark:border-[#1F2937]">
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <ShieldAlert className="h-14 w-14 text-muted-foreground/80" aria-hidden />
            <p className="text-muted-foreground text-center text-sm max-w-sm">
              No tienes permiso para gestionar usuarios. Solo los administradores pueden ver y crear usuarios.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-4 pt-2 pb-2">
        <Button variant="ghost" size="icon" asChild className="shrink-0 rounded-lg">
          <Link href="/app">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver al inicio</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Users className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Usuarios
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            {canCreate
              ? 'Crear y gestionar usuarios de tu empresa. El rol define los permisos de acceso.'
              : 'Lista de usuarios de tu empresa.'}
          </p>
        </div>
      </header>

      {canRead && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] overflow-hidden dark:border-[#1F2937]">
          <div className="p-6 pb-5 border-b border-border/60">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-5 w-5" aria-hidden />
                  </div>
                  Lista de usuarios
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Usuarios del mismo tenant. Puedes editar el rol o restablecer la contraseña.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2 rounded-xl"
                onClick={() => window.dispatchEvent(new CustomEvent('open-change-password'))}
              >
                <KeyRound className="h-4 w-4" />
                Cambiar contraseña
              </Button>
            </div>
          </div>
          <div className="pt-5 px-6 pb-6">
            {usersList.isLoading && (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80 bg-muted/30">
                      <TableHead className="font-medium text-muted-foreground py-3.5">Usuario</TableHead>
                      <TableHead className="font-medium text-muted-foreground py-3.5">Rol</TableHead>
                      <TableHead className="font-medium text-muted-foreground py-3.5">Fecha alta</TableHead>
                      {(canUpdate || canDelete) && <TableHead className="w-[120px] font-medium text-muted-foreground py-3.5 text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-border/40">
                        <TableCell className="py-3.5"><Skeleton className="h-5 w-48 rounded-md" /></TableCell>
                        <TableCell className="py-3.5"><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                        <TableCell className="py-3.5"><Skeleton className="h-5 w-20 rounded-md" /></TableCell>
                        {(canUpdate || canDelete) && <TableCell className="py-3.5 text-right"><Skeleton className="h-8 w-16 rounded-md ml-auto" /></TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {usersList.isError && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
                <p className="text-sm text-destructive font-medium">
                  {(usersList.error as { message?: string })?.message ?? 'Error al cargar usuarios'}
                </p>
              </div>
            )}
            {usersList.data && usersList.data.length === 0 && !usersList.isLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <p className="text-sm text-muted-foreground">No hay usuarios aún.</p>
                <p className="text-xs text-muted-foreground/80">Crea el primero con el formulario de abajo.</p>
              </div>
            )}
            {usersList.data && usersList.data.length > 0 && !usersList.isLoading && (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80 bg-muted/30">
                      <TableHead className="font-medium text-muted-foreground py-3.5">Usuario</TableHead>
                      <TableHead className="font-medium text-muted-foreground py-3.5">Rol</TableHead>
                      <TableHead className="font-medium text-muted-foreground py-3.5">Fecha alta</TableHead>
                      {(canUpdate || canDelete) && <TableHead className="w-[120px] font-medium text-muted-foreground py-3.5 text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersList.data.map((u) => (
                      <TableRow key={u.id} className="transition-colors hover:bg-muted/30 border-b border-border/40 last:border-0">
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted text-muted-foreground">
                              {employeeAvatarUrl(u.profilePictureUrl) ? (
                                <img
                                  src={employeeAvatarUrl(u.profilePictureUrl)!}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <User className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              {u.name && (
                                <p className="font-medium text-foreground truncate">{u.name}</p>
                              )}
                              <p className={`text-sm text-muted-foreground truncate ${u.name ? '' : 'font-medium text-foreground'}`} title={u.email}>
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          {u.role === 'ADMIN' ? (
                            <Badge variant="default" className="font-medium">Administrador</Badge>
                          ) : (
                            <Badge variant="outline" className="font-medium">Usuario</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-3.5">
                          {new Date(u.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </TableCell>
                        {(canUpdate || canDelete) && (
                          <TableCell className="py-3.5">
                            <div className="flex items-center justify-end gap-0.5">
                              {canUpdate && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    onClick={() => setUserToChangePicture(u)}
                                    aria-label={`Cambiar foto de ${u.email}`}
                                    title="Cambiar foto de perfil"
                                  >
                                    <Camera className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    onClick={() => onEditOpen(u)}
                                    aria-label={`Editar ${u.email}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {canDelete && u.id !== user?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => onDeleteOpen(u)}
                                  aria-label={`Eliminar ${u.email}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {canCreate && (
        <div className="flex justify-center">
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] w-full max-w-2xl overflow-hidden dark:border-[#1F2937]">
          <div className="p-6 pb-5 border-b border-border/60">
            <p className="text-lg font-semibold text-foreground flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserPlus className="h-5 w-5" aria-hidden />
              </div>
              Crear usuario
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              Alta directa con correo y contraseña. El correo debe ser único en el sistema.
            </p>
          </div>
          <div className="pt-6 px-6 pb-6">
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-foreground">Nombre</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="ej. Juan Pérez"
                  autoComplete="name"
                  className="rounded-lg h-10 border-border/80 focus-visible:ring-2"
                  {...form.register('name')}
                />
                <p className="text-xs text-muted-foreground">Nombre real para mostrar en la lista de usuarios.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ej. nombre@empresa.com"
                  autoComplete="email"
                  className="rounded-lg h-10 border-border/80 focus-visible:ring-2"
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-medium text-foreground">Rol</Label>
                <Select
                  id="role"
                  value={form.watch('role')}
                  {...form.register('role')}
                  className="w-full h-10 rounded-lg"
                >
                  <option value="USER">Usuario</option>
                  <option value="ADMIN">Administrador</option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Los administradores pueden crear usuarios y acceder a todas las secciones.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Escribe una contraseña"
                  autoComplete="new-password"
                  className="rounded-lg h-10 border-border/80 focus-visible:ring-2"
                  {...form.register('password')}
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres. El usuario podrá cambiarla después.
                </p>
                {form.formState.errors.password && (
                  <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={registerUser.isPending}
                className="h-10 px-6 rounded-lg font-medium shadow-sm"
              >
                {registerUser.isPending ? 'Creando…' : 'Crear usuario'}
              </Button>
            </form>
          </div>
        </div>
        </div>
      )}

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription className="text-sm">
              {editUser?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium">Nombre</Label>
              <Input
                id="edit-name"
                type="text"
                placeholder="ej. Juan Pérez"
                className="rounded-lg"
                {...editForm.register('name')}
              />
              <p className="text-xs text-muted-foreground">Nombre real para mostrar en la lista.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role" className="text-sm font-medium">Rol</Label>
              <Select
                id="edit-role"
                value={editForm.watch('role')}
                {...editForm.register('role')}
              >
                <option value="USER">Usuario</option>
                <option value="ADMIN">Administrador</option>
              </Select>
              <p className="text-sm text-muted-foreground">
                Administrador: acceso completo. Usuario: permisos limitados.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password" className="text-sm font-medium">Nueva contraseña (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Dejar en blanco para no cambiar"
                autoComplete="new-password"
                className="rounded-lg"
                {...editForm.register('password')}
              />
              <p className="text-sm text-muted-foreground">
                Mínimo 8 caracteres. Solo rellena si quieres cambiar la contraseña actual.
              </p>
              {editForm.formState.errors.password && (
                <p className="text-destructive text-sm">{editForm.formState.errors.password.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && (setUserToDelete(null), setDeleteConfirmText(''))}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription className="text-sm">
              Esta acción desactivará al usuario y ya no podrá iniciar sesión. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {userToDelete && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Para confirmar, escribe <strong className="text-foreground">BORRAR</strong> a continuación:
              </p>
              <Input
                type="text"
                placeholder="Escriba BORRAR"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="rounded-lg font-mono"
                autoComplete="off"
                aria-label="Confirmar eliminación escribiendo BORRAR"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setUserToDelete(null); setDeleteConfirmText(''); }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteConfirmText !== 'BORRAR' || deleteUserMutation.isPending}
              onClick={onDeleteConfirm}
            >
              {deleteUserMutation.isPending ? 'Eliminando…' : 'Eliminar usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToChangePicture} onOpenChange={(open) => !open && setUserToChangePicture(null)}>
        <DialogContent showClose className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar foto de perfil</DialogTitle>
            <DialogDescription className="text-sm">
              {userToChangePicture?.email}
            </DialogDescription>
          </DialogHeader>
          {userToChangePicture && (
            <div className="flex flex-col items-center gap-4 py-4">
              <button
                type="button"
                onClick={() => {
                  if (employeeAvatarUrl(userToChangePicture.profilePictureUrl)) {
                    setUserPhotoPreview(userToChangePicture);
                  }
                }}
                className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none cursor-pointer hover:opacity-90 transition-opacity"
                disabled={!employeeAvatarUrl(userToChangePicture.profilePictureUrl)}
                title={employeeAvatarUrl(userToChangePicture.profilePictureUrl) ? 'Ver foto ampliada' : undefined}
              >
                {employeeAvatarUrl(userToChangePicture.profilePictureUrl) ? (
                  <img
                    src={employeeAvatarUrl(userToChangePicture.profilePictureUrl)!}
                    alt={`Foto de ${userToChangePicture.email}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-12 w-12" />
                )}
              </button>
              <input
                ref={pictureInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={onEmployeePictureSelect}
                aria-label="Seleccionar imagen"
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={uploadEmployeePictureMutation.isPending}
                onClick={() => pictureInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {uploadEmployeePictureMutation.isPending ? 'Subiendo…' : userToChangePicture.profilePictureUrl ? 'Cambiar foto' : 'Subir foto'}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setUserToChangePicture(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userPhotoPreview} onOpenChange={(open) => !open && setUserPhotoPreview(null)}>
        <DialogContent showClose className="sm:max-w-lg p-0 overflow-hidden">
          {userPhotoPreview && employeeAvatarUrl(userPhotoPreview.profilePictureUrl) && (
            <>
              <DialogHeader className="px-6 pt-6 pb-2">
                <DialogTitle className="text-base">Foto de perfil</DialogTitle>
                <DialogDescription className="text-sm">
                  {userPhotoPreview.name ?? userPhotoPreview.email}
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 pb-6 flex justify-center bg-muted/30">
                <img
                  src={employeeAvatarUrl(userPhotoPreview.profilePictureUrl)!}
                  alt={`Foto de ${userPhotoPreview.email}`}
                  className="max-h-[70vh] max-w-full w-auto object-contain rounded-lg"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
