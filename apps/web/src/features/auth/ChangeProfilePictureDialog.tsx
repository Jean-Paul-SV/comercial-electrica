'use client';

import { useRef } from 'react';
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
import { useUploadProfilePicture } from './hooks';
import { useAuth } from '@shared/providers/AuthProvider';
import { Camera, User } from 'lucide-react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

function avatarUrl(profilePictureUrl: string | null | undefined): string | null {
  if (!profilePictureUrl) return null;
  if (profilePictureUrl.startsWith('http')) return profilePictureUrl;
  const base = API_BASE_URL.replace(/\/$/, '');
  return `${base}${profilePictureUrl.startsWith('/') ? '' : '/'}${profilePictureUrl}`;
}

type ChangeProfilePictureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Llamado tras subir la foto con éxito (ej. para refrescar datos del usuario). */
  onSuccess?: () => void;
};

export function ChangeProfilePictureDialog({
  open,
  onOpenChange,
  onSuccess,
}: ChangeProfilePictureDialogProps) {
  const { user, refreshMe } = useAuth();
  const uploadMutation = useUploadProfilePicture();
  const inputRef = useRef<HTMLInputElement>(null);

  const url = avatarUrl(user?.profilePictureUrl ?? null);

  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Solo se permiten imágenes (JPEG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede exceder 5MB');
      return;
    }
    try {
      await uploadMutation.mutateAsync(file);
      toast.success('Foto de perfil actualizada');
      await refreshMe();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al subir la foto';
      toast.error(message);
    }
    e.target.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Foto de perfil</DialogTitle>
          <DialogDescription>
            Sube una imagen (JPEG, PNG o WebP). Tamaño máximo: 5MB.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-muted-foreground">
            {url ? (
              <img
                src={url}
                alt="Tu foto de perfil"
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-12 w-12" />
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={handleSelectFile}
            aria-label="Seleccionar imagen"
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={uploadMutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {uploadMutation.isPending ? 'Subiendo…' : url ? 'Cambiar foto' : 'Subir foto'}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
