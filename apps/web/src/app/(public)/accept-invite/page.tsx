'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAcceptInvite } from '@features/auth/hooks';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Zap, ArrowLeft } from 'lucide-react';

const schema = z
  .object({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof schema>;

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const acceptInvite = useAcceptInvite();
  const [success, setSuccess] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) return;
    try {
      await acceptInvite.mutateAsync({
        token,
        password: values.password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al aceptar la invitación';
      form.setError('root', { message });
    }
  });

  const cardClass = 'w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]';

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className={cardClass}>
          <div className="space-y-1 pb-2">
            <p className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Zap className="h-6 w-6 text-primary" />
              Invitación aceptada
            </p>
            <p className="text-sm text-muted-foreground">
              Tu contraseña se ha establecido correctamente. Ya puedes iniciar sesión.
            </p>
          </div>
          <div className="pt-4">
            <Button asChild className="w-full">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className={cardClass}>
          <div className="space-y-1 pb-2">
            <p className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Zap className="h-6 w-6 text-primary" />
              Enlace inválido
            </p>
            <p className="text-sm text-muted-foreground">
              Falta el token de invitación. Pide a quien te invitó que te envíe de nuevo el enlace.
            </p>
          </div>
          <div className="pt-4">
            <Button asChild className="w-full">
              <Link href="/login">Ir al inicio de sesión</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className={cardClass}>
        <div className="space-y-1 pb-2">
          <p className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Zap className="h-6 w-6 text-primary" />
            Aceptar invitación
          </p>
          <p className="text-sm text-muted-foreground">
            Establece tu contraseña para acceder (mínimo 8 caracteres).
          </p>
        </div>
        <div className="pt-4">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={acceptInvite.isPending}
            >
              {acceptInvite.isPending ? 'Guardando…' : 'Establecer contraseña'}
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al inicio de sesión
              </Link>
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
            <p className="text-sm text-muted-foreground animate-pulse">Cargando…</p>
          </div>
        </main>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
