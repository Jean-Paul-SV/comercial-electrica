'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { UserPlus, ShieldAlert, Pencil, Mail } from 'lucide-react';
import { useRegisterUser, useUsersList, useUpdateUser, useInviteUser } from '@features/auth/hooks';
import type { UserListItem } from '@features/auth/types';
import { useAuth } from '@shared/providers/AuthProvider';

const createUserSchema = z
  .object({
    email: z.string().email('Correo electrónico inválido'),
    password: z.string().optional(),
    role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
    generateTempPassword: z.boolean().optional().default(false),
  })
  .refine(
    (data) =>
      data.generateTempPassword === true || (typeof data.password === 'string' && data.password.length >= 8),
    { message: 'La contraseña debe tener al menos 8 caracteres', path: ['password'] },
  );
type CreateUserFormValues = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  role: z.enum(['ADMIN', 'USER']),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
});
type EditUserFormValues = z.infer<typeof editUserSchema>;

const inviteUserSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
});
type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

export default function UsersPage() {
  const { permissions } = useAuth();
  const canCreate = permissions?.includes('users:create') ?? false;
  const canRead = permissions?.includes('users:read') ?? false;
  const canUpdate = permissions?.includes('users:update') ?? false;
  const registerUser = useRegisterUser();
  const usersList = useUsersList();
  const updateUserMutation = useUpdateUser();
  const inviteUserMutation = useInviteUser();
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [inviteResult, setInviteResult] = useState<{ inviteToken: string; tempPassword?: string } | null>(null);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'USER',
    },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    values: editUser
      ? { role: editUser.role, password: '' }
      : undefined,
    defaultValues: { role: 'USER', password: '' },
  });

  const inviteForm = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { email: '', role: 'USER' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await registerUser.mutateAsync({
        email: values.email,
        password: values.generateTempPassword ? undefined : (values.password ?? ''),
        role: values.role,
        generateTempPassword: values.generateTempPassword,
      });
      toast.success('Usuario creado correctamente');
      if (values.generateTempPassword && 'tempPassword' in res && typeof (res as { tempPassword?: string }).tempPassword === 'string') {
        toast.info(`Contraseña temporal (guárdala): ${(res as { tempPassword: string }).tempPassword}`, { duration: 15000 });
      }
      form.reset({ email: '', password: '', role: 'USER', generateTempPassword: false });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al crear el usuario';
      toast.error(message);
    }
  });

  const onInviteSubmit = inviteForm.handleSubmit(async (values) => {
    try {
      const res = await inviteUserMutation.mutateAsync({
        email: values.email,
        role: values.role,
      });
      setInviteResult({
        inviteToken: res.inviteToken,
        tempPassword: res.tempPassword,
      });
      inviteForm.reset();
      toast.success('Invitación creada. Envía el enlace al usuario.');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al invitar';
      toast.error(message);
    }
  });

  const onEditOpen = (user: UserListItem) => {
    setEditUser(user);
    editForm.reset({ role: user.role, password: '' });
  };

  const onEditSubmit = editForm.handleSubmit(async (values) => {
    if (!editUser) return;
    try {
      await updateUserMutation.mutateAsync({
        id: editUser.id,
        payload: {
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
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">Usuarios</h1>
        </div>
        <Card className="border border-border/80 shadow-sm rounded-xl max-w-md">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
            <ShieldAlert className="h-12 w-12 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground text-center text-sm">
              No tienes permiso para gestionar usuarios. Solo los administradores pueden ver y crear usuarios.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
          Usuarios
        </h1>
        <p className="text-sm text-muted-foreground">
          {canCreate
            ? 'Crear y gestionar usuarios de tu empresa. El rol define los permisos de acceso.'
            : 'Lista de usuarios de tu empresa.'}
        </p>
      </div>

      {canRead && (
        <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/60">
            <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
              <UserPlus className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              Lista de usuarios
            </CardTitle>
            <CardDescription>
              Usuarios del mismo tenant. Puedes editar el rol o restablecer la contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {usersList.isLoading && (
              <div className="rounded-lg border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-medium text-muted-foreground">Correo</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Rol</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Fecha alta</TableHead>
                      {canUpdate && <TableHead className="w-[100px] font-medium text-muted-foreground">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-48 rounded" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 rounded" /></TableCell>
                        {canUpdate && <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {usersList.isError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive">
                  {(usersList.error as { message?: string })?.message ?? 'Error al cargar usuarios'}
                </p>
              </div>
            )}
            {usersList.data && usersList.data.length === 0 && !usersList.isLoading && (
              <p className="text-sm text-muted-foreground py-6">No hay usuarios aún.</p>
            )}
            {usersList.data && usersList.data.length > 0 && !usersList.isLoading && (
              <div className="rounded-lg border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/80">
                      <TableHead className="font-medium text-muted-foreground">Correo</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Rol</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Fecha alta</TableHead>
                      {canUpdate && <TableHead className="w-[100px] font-medium text-muted-foreground">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersList.data.map((u) => (
                      <TableRow key={u.id} className="transition-colors hover:bg-muted/40">
                        <TableCell className="font-medium text-foreground">{u.email}</TableCell>
                        <TableCell className="text-muted-foreground">{u.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </TableCell>
                        {canUpdate && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => onEditOpen(u)}
                              aria-label={`Editar ${u.email}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canCreate && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/60">
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
                <UserPlus className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                Crear usuario
              </CardTitle>
              <CardDescription className="text-sm">
                Alta directa con correo y contraseña. El correo debe ser único en el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ej. nombre@empresa.com"
                    autoComplete="email"
                    className="rounded-lg"
                    {...form.register('email')}
                  />
                  {form.formState.errors.email && (
                    <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-medium">Rol</Label>
                  <Select
                    id="role"
                    value={form.watch('role')}
                    {...form.register('role')}
                    className="w-full"
                  >
                    <option value="USER">Usuario</option>
                    <option value="ADMIN">Administrador</option>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Los administradores pueden crear usuarios y acceder a todas las secciones.
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="generate-temp"
                      {...form.register('generateTempPassword')}
                      className="h-4 w-4 mt-0.5 rounded border-input"
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="generate-temp" className="font-medium cursor-pointer text-sm text-foreground">
                        Generar contraseña temporal
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        El usuario la recibirá y deberá cambiarla en el primer acceso.
                      </p>
                    </div>
                  </div>
                  {form.watch('generateTempPassword') ? (
                    <p className="text-sm text-muted-foreground bg-muted/40 rounded-md px-2.5 py-2">
                      No hace falta escribir contraseña; se generará una automáticamente.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Escribe una contraseña"
                        autoComplete="new-password"
                        className="rounded-lg"
                        {...form.register('password')}
                      />
                      <p className="text-sm text-muted-foreground">
                        Mínimo 8 caracteres. El usuario podrá cambiarla después.
                      </p>
                      {form.formState.errors.password && (
                        <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
                      )}
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={registerUser.isPending} className="w-full sm:w-auto">
                  {registerUser.isPending ? 'Creando…' : 'Crear usuario'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/60">
              <CardTitle className="text-lg font-medium flex items-center gap-2 text-foreground">
                <Mail className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                Invitar usuario
              </CardTitle>
              <CardDescription className="text-sm">
                Envía una invitación por correo. La persona recibirá un enlace para crear su contraseña (válido 7 días).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {inviteResult ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-foreground">Enlace de invitación</p>
                  <p className="text-sm text-muted-foreground">
                    Copia y envía este enlace al usuario invitado:
                  </p>
                  <p className="text-sm break-all rounded-lg border border-border/80 bg-muted/20 p-3">
                    <Link
                      href={`${typeof window !== 'undefined' ? window.location.origin : ''}/accept-invite?token=${encodeURIComponent(inviteResult.inviteToken)}`}
                      className="text-primary underline hover:no-underline"
                    >
                      Aceptar invitación
                    </Link>
                  </p>
                  {inviteResult.tempPassword && (
                    <p className="text-xs text-muted-foreground">
                      En desarrollo: contraseña temporal (para pruebas): <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{inviteResult.tempPassword}</code>
                    </p>
                  )}
                  <Button variant="outline" onClick={() => setInviteResult(null)}>
                    Invitar a otra persona
                  </Button>
                </div>
              ) : (
                <form onSubmit={onInviteSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email" className="text-sm font-medium">Correo electrónico</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="ej. nombre@empresa.com"
                      className="rounded-lg"
                      {...inviteForm.register('email')}
                    />
                    {inviteForm.formState.errors.email && (
                      <p className="text-destructive text-sm">{inviteForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role" className="text-sm font-medium">Rol</Label>
                    <Select
                      id="invite-role"
                      value={inviteForm.watch('role')}
                      {...inviteForm.register('role')}
                      className="w-full"
                    >
                      <option value="USER">Usuario</option>
                      <option value="ADMIN">Administrador</option>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Mismo criterio que en Crear usuario: Administrador tiene acceso completo.
                    </p>
                  </div>
                  <Button type="submit" disabled={inviteUserMutation.isPending} className="w-full sm:w-auto">
                    {inviteUserMutation.isPending ? 'Enviando…' : 'Enviar invitación'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
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
    </div>
  );
}
