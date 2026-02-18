'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLogin } from '@features/auth/hooks';
import { useAuth } from '@shared/providers/AuthProvider';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { OrionLogo } from '@shared/ui/OrionLogo';

const LoginVideoBackground = dynamic(
  () => import('./LoginVideoBackground').then((m) => ({ default: m.LoginVideoBackground })),
  { ssr: false }
);

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values, {
      onSuccess: (data) => {
        auth.login(data.accessToken, data.mustChangePassword);
        router.replace(data.isPlatformAdmin ? '/provider' : '/app');
      },
    });
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
      {/* Fondo por defecto oscuro (sin blanco); el video se monta solo en cliente */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" aria-hidden />
      <LoginVideoBackground />

      <Card className="relative z-10 w-full max-w-md border border-border/50 rounded-2xl overflow-hidden shadow-none">
        {/* Línea de acento superior */}
        <div className="h-1 bg-gradient-to-r from-primary to-primary/80" />

        <CardHeader className="space-y-1 pb-6 pt-8 px-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <OrionLogo size={28} withCircle />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
              Orion
            </CardTitle>
          </div>
          <CardDescription className="text-center text-muted-foreground">
            Acceso al sistema de gestión
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-10">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/90 font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="tu@empresa.com"
                className="h-11 rounded-lg border-input/80 bg-background focus-visible:ring-2"
                disabled={loginMutation.isPending}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground/90 font-medium">
                  Contraseña
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11 rounded-lg border-input/80 bg-background focus-visible:ring-2 pr-10"
                  disabled={loginMutation.isPending}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  onMouseLeave={() => setShowPassword(false)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {loginMutation.isError && (
              <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                {(loginMutation.error as { message?: string })?.message ?? 'Error al iniciar sesión'}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 rounded-lg font-medium shadow-sm"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Accediendo…' : 'Iniciar sesión'}
            </Button>
          </form>
          <div className="mt-6 pt-4 border-t border-border/60 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/80">¿Aún no eres cliente de Orion?</p>
            <p>
              Conoce cómo adquirir nuestros servicios escribiendo a{' '}
              <a
                href="mailto:soporte@orion-app.cloud?subject=Quiero%20adquirir%20Orion"
                className="text-primary hover:underline underline-offset-2"
              >
                soporte@orion-app.cloud
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
