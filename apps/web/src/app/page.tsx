'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogin } from '@features/auth/hooks';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Page() {
  const [token, setToken] = useState<string | null>(null);
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

  const loginMutation = useLogin();

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values, {
      onSuccess: (data) => {
        setToken(data.accessToken);
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
        background: '#0f172a',
        color: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          background: '#020617',
          padding: '2rem',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '380px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
          border: '1px solid #1e293b',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
          Comercial Eléctrica
        </h1>
        <p style={{ marginBottom: '1.5rem', color: '#9ca3af' }}>
          Acceso al sistema de gestión
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: '0.25rem' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              {...register('email')}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #4b5563',
                background: '#020617',
                color: 'inherit',
              }}
            />
            {errors.email && (
              <p style={{ color: '#f97316', fontSize: '0.75rem', marginTop: 4 }}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="password"
              style={{ display: 'block', marginBottom: '0.25rem' }}
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
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #4b5563',
                background: '#020617',
                color: 'inherit',
              }}
            />
            {errors.password && (
              <p style={{ color: '#f97316', fontSize: '0.75rem', marginTop: 4 }}>
                {errors.password.message}
              </p>
            )}
          </div>

          {loginMutation.isError && (
            <p
              style={{
                color: '#f97316',
                fontSize: '0.8rem',
                marginBottom: '0.75rem',
              }}
            >
              {(loginMutation.error as any)?.message ??
                'Error al iniciar sesión'}
            </p>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: loginMutation.isPending ? '#4b5563' : '#22c55e',
              color: '#020617',
              fontWeight: 600,
              cursor: loginMutation.isPending ? 'default' : 'pointer',
            }}
          >
            {loginMutation.isPending ? 'Accediendo…' : 'Iniciar sesión'}
          </button>
        </form>

        {token && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: '#022c22',
              border: '1px solid #16a34a',
              fontSize: '0.75rem',
              wordBreak: 'break-all',
            }}
          >
            <strong>Login OK.</strong>
            <div style={{ marginTop: '0.25rem' }}>
              Token recibido (truncado): {token.slice(0, 32)}…
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

