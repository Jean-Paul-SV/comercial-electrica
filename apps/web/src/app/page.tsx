'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hasCheckedStorage } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !hasCheckedStorage) return;
    router.replace(isAuthenticated ? '/app' : '/login');
  }, [mounted, hasCheckedStorage, isAuthenticated, router]);

  if (!mounted || !hasCheckedStorage) {
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
