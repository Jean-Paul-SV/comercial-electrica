'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    router.replace(isAuthenticated ? '/app' : '/login');
  }, [mounted, isAuthenticated, router]);

  // Evitar hidratación que falle en servidor: mostrar carga mínima hasta montar en cliente
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
        <div className="animate-pulse text-muted-foreground text-sm">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
      <div className="animate-pulse text-muted-foreground text-sm">Redirigiendo…</div>
    </div>
  );
}
