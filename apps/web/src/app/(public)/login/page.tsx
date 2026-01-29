'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogin } from '@features/auth/hooks';
import { useAuth } from '@shared/providers/AuthProvider';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@example.com',
      password: 'Admin123!',
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values, {
      onSuccess: (data) => {
        auth.login(data.accessToken);
        router.replace('/app');
      },
    });
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#020617',
          padding: '2rem',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '380px',
          border: '1px solid #1e293b',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
          Comercial Eléctrica
        </h1>
        <p style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>
          Acceso al sistema de gestión
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="email" style={{ display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              {...register('email')}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#0b1220',
                color: 'inherit',
              }}
            />
            {errors.email && (
              <p style={{ color: '#f97316', fontSize: '0.75rem', marginTop: 6 }}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="password"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#0b1220',
                color: 'inherit',
              }}
            />
            {errors.password && (
              <p style={{ color: '#f97316', fontSize: '0.75rem', marginTop: 6 }}>
                {errors.password.message}
              </p>
            )}
          </div>

          {loginMutation.isError && (
            <p style={{ color: '#f97316', fontSize: '0.85rem', marginBottom: 10 }}>
              {(loginMutation.error as any)?.message ?? 'Error al iniciar sesión'}
            </p>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: loginMutation.isPending ? '#334155' : '#22c55e',
              color: '#020617',
              fontWeight: 700,
              cursor: loginMutation.isPending ? 'default' : 'pointer',
            }}
          >
            {loginMutation.isPending ? 'Accediendo…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </main>
  );
}

