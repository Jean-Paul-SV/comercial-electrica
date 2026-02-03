'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useResetPassword } from '@features/auth/hooks';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Zap, ArrowLeft } from 'lucide-react';

const schema = z
  .object({
    newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmNew: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNew, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmNew'],
  });
type FormValues = z.infer<typeof schema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const resetPassword = useResetPassword();
  const [success, setSuccess] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmNew: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) return;
    try {
      await resetPassword.mutateAsync({
        token,
        newPassword: values.newPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al restablecer la contraseña';
      form.setError('root', { message });
    }
  });

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Zap className="h-6 w-6 text-primary" />
              Contraseña actualizada
            </CardTitle>
            <CardDescription>
              Tu contraseña se ha restablecido correctamente. Ya puedes iniciar sesión.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Zap className="h-6 w-6 text-primary" />
              Enlace inválido
            </CardTitle>
            <CardDescription>
              Falta el token de restablecimiento. Solicita uno nuevo desde la pantalla de olvidé mi contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/forgot-password">Solicitar enlace</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full mt-2">
              <Link href="/login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al inicio de sesión
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-6 w-6 text-primary" />
            Nueva contraseña
          </CardTitle>
          <CardDescription>
            Ingresa tu nueva contraseña (mínimo 8 caracteres).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                {...form.register('newPassword')}
              />
              {form.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new">Confirmar contraseña</Label>
              <Input
                id="confirm-new"
                type="password"
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                {...form.register('confirmNew')}
              />
              {form.formState.errors.confirmNew && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.confirmNew.message}
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
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending ? 'Guardando…' : 'Restablecer contraseña'}
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al inicio de sesión
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6 bg-background">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground animate-pulse">Cargando…</p>
            </CardContent>
          </Card>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
