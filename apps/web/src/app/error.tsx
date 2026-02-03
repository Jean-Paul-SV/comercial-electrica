'use client';

import { useEffect } from 'react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
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

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle>Algo salió mal</CardTitle>
          </div>
          <CardDescription>
            Revisa que la API esté corriendo en http://localhost:3000 y vuelve a intentar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Si el error continúa, abre la consola del navegador (F12) para ver más detalles.
          </p>
          <Button onClick={reset} className="w-full">
            Reintentar
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <a href="/">Ir al inicio</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
