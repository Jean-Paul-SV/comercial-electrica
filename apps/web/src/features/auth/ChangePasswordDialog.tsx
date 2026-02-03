'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useChangeMyPassword } from './hooks';

const schema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
  confirmNew: z.string(),
}).refine((data) => data.newPassword === data.confirmNew, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmNew'],
});
type FormValues = z.infer<typeof schema>;

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Llamado tras cambiar la contraseña con éxito (ej. para limpiar mustChangePassword). */
  onSuccess?: () => void;
  /** Si true, no se puede cerrar sin cambiar la contraseña (ej. primer login con temporal). */
  forceOpen?: boolean;
};

export function ChangePasswordDialog({ open, onOpenChange, onSuccess, forceOpen }: ChangePasswordDialogProps) {
  const changePassword = useChangeMyPassword();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNew: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Contraseña actualizada');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al cambiar la contraseña';
      toast.error(message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={forceOpen ? undefined : onOpenChange}>
      <DialogContent onPointerDownOutside={forceOpen ? (e) => e.preventDefault() : undefined} onEscapeKeyDown={forceOpen ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            {forceOpen
              ? 'Tu contraseña es temporal. Debes establecer una nueva para continuar.'
              : 'Ingresa tu contraseña actual y la nueva. Debe tener al menos 8 caracteres.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              {...form.register('currentPassword')}
            />
            {form.formState.errors.currentPassword && (
              <p className="text-destructive text-sm">
                {form.formState.errors.currentPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              {...form.register('newPassword')}
            />
            {form.formState.errors.newPassword && (
              <p className="text-destructive text-sm">
                {form.formState.errors.newPassword.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new">Confirmar nueva contraseña</Label>
            <Input
              id="confirm-new"
              type="password"
              autoComplete="new-password"
              {...form.register('confirmNew')}
            />
            {form.formState.errors.confirmNew && (
              <p className="text-destructive text-sm">
                {form.formState.errors.confirmNew.message}
              </p>
            )}
          </div>
          <DialogFooter>
            {!forceOpen && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
