'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';
import { AppShell } from '@shared/ui/AppShell';
import { SidebarProvider } from '@shared/ui/sidebar';
import { canAccessPath } from '@shared/auth/roles';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user?.role && !canAccessPath(pathname ?? '', user.role)) {
      router.replace('/app');
    }
  }, [isAuthenticated, user?.role, pathname, router]);

  if (!isAuthenticated) return null;
  if (user?.role && pathname && !canAccessPath(pathname, user.role)) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}

