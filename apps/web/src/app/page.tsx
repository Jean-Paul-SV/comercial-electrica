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
  const { isAuthenticated, hasCheckedStorage } = useAuth();

  useEffect(() => {
    if (!hasCheckedStorage) return;
    router.replace(isAuthenticated ? '/app' : '/login');
  }, [hasCheckedStorage, isAuthenticated, router]);

  if (!hasCheckedStorage) {
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
