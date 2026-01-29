'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';
import { Button } from '@shared/components/ui/button';
import { cn } from '@lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  FileText,
  LogOut,
  Zap,
} from 'lucide-react';

const nav = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales', label: 'Ventas', icon: ShoppingCart },
  { href: '/products', label: 'Productos', icon: Package },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/cash', label: 'Caja', icon: Wallet },
  { href: '/reports', label: 'Reportes', icon: FileText },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="grid grid-cols-[260px_1fr] h-screen">
      <aside className="flex flex-col border-r border-border bg-card p-4">
        <div className="flex items-center gap-2 font-semibold text-lg mb-6">
          <Zap className="h-6 w-6 text-primary" />
          Comercial Eléctrica
        </div>
        <div className="text-sm text-muted-foreground mb-4 truncate">
          {user ? `${user.email}` : '—'}
        </div>
        {user && (
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded mb-4 w-fit">
            {user.role}
          </span>
        )}
        <nav className="flex flex-col gap-1 flex-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4 justify-start gap-2"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </aside>

      <div className="flex flex-col min-h-0">
        <header className="h-14 border-b border-border bg-background/95 px-6 flex items-center justify-between shrink-0">
          <div className="text-sm text-muted-foreground capitalize">
            {pathname === '/app' ? 'Dashboard' : pathname.replace('/', '')}
          </div>
          <div className="text-xs text-muted-foreground">
            API: {process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'}
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
