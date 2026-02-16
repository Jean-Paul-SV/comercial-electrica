'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
        <div className="animate-pulse text-muted-foreground text-sm">Cargando…</div>
      </div>
    );
  }

  return (
    <HomeRedirect router={router} />
  );
}

function HomeRedirect({ router }: { router: ReturnType<typeof useRouter> }) {
  const { isAuthenticated, hasCheckedStorage, isPlatformAdmin, isRestoringSession } = useAuth();

  useEffect(() => {
    if (!hasCheckedStorage) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    // No redirigir hasta tener sesión restaurada (JWT decodificado / getMe) para saber si es platform admin
    if (isRestoringSession) return;
    router.replace(isPlatformAdmin ? '/provider' : '/app');
  }, [hasCheckedStorage, isAuthenticated, isPlatformAdmin, isRestoringSession, router]);

  if (!hasCheckedStorage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
        <div className="animate-pulse text-muted-foreground text-sm">Cargando…</div>
      </div>
    );
  }
  if (isAuthenticated && isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
        <div className="animate-pulse text-muted-foreground text-sm">Cargando sesión…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
      <div className="animate-pulse text-muted-foreground text-sm">Redirigiendo…</div>
    </div>
  );
}
