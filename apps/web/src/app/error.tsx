'use client';

import { useEffect } from 'react';
import { Button } from '@shared/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border/50 border-destructive/30 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
        <div className="space-y-1 pb-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-semibold text-foreground">Algo salió mal</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Revisa que la API esté corriendo en http://localhost:3000 y vuelve a intentar.
          </p>
        </div>
        <div className="space-y-4 pt-4">
          {isDev && error?.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm">
              <p className="font-medium text-destructive">{error.message}</p>
              {error.stack && (
                <pre className="mt-2 text-xs overflow-auto max-h-32 whitespace-pre-wrap break-words">{error.stack}</pre>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Si el error continúa, abre la consola del navegador (F12) o la terminal de <code className="rounded bg-muted px-1">npm run dev</code> para ver más detalles.
          </p>
          <Button onClick={reset} className="w-full">
            Reintentar
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <a href="/">Ir al inicio</a>
          </Button>
        </div>
      </div>
    </main>
  );
}
