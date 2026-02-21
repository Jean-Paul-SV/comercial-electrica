'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForgotPassword } from '@features/auth/hooks';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Zap, ArrowLeft } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Correo electrónico inválido'),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [done, setDone] = useState<{ message: string; resetLink?: string } | null>(null);
  const forgotPassword = useForgotPassword();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await forgotPassword.mutateAsync({ email: values.email });
      setDone({
        message: res.message,
        resetLink:
          res.resetToken != null
            ? `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password?token=${encodeURIComponent(res.resetToken)}`
            : undefined,
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al solicitar el restablecimiento';
      setDone({ message });
    }
  });

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <div className="space-y-1 pb-2">
            <p className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Zap className="h-6 w-6 text-primary" />
              Restablecer contraseña
            </p>
            <p className="text-sm text-muted-foreground">{done.message}</p>
          </div>
          <div className="space-y-4 pt-4">
            {done.resetLink && (
              <p className="text-sm text-muted-foreground break-all">
                Para pruebas, usa este enlace:{' '}
                <Link href={done.resetLink} className="text-primary underline">
                  Restablecer contraseña
                </Link>
              </p>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al inicio de sesión
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
        <div className="space-y-1 pb-2">
          <p className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Zap className="h-6 w-6 text-primary" />
            ¿Olvidaste tu contraseña?
          </p>
          <p className="text-sm text-muted-foreground">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
          </p>
        </div>
        <div className="pt-4">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="tu@ejemplo.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={forgotPassword.isPending}
            >
              {forgotPassword.isPending ? 'Enviando…' : 'Enviar enlace'}
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
