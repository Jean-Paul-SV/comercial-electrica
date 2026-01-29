'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@shared/providers/AuthProvider';

const nav = [
  { href: '/app', label: 'Dashboard' },
  { href: '/sales', label: 'Ventas' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: '100vh' }}>
      <aside
        style={{
          borderRight: '1px solid #1e293b',
          padding: '1rem',
          background: '#020617',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '1rem' }}>
          Comercial Eléctrica
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {user ? `${user.email} (${user.role})` : '—'}
        </div>
        <nav style={{ display: 'grid', gap: '0.25rem' }}>
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: active ? '#0f172a' : 'transparent',
                  border: active ? '1px solid #1e293b' : '1px solid transparent',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto' }} />
        <button
          onClick={logout}
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '0.55rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #334155',
            background: 'transparent',
            color: '#e5e7eb',
            cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </aside>

      <div style={{ display: 'grid', gridTemplateRows: '56px 1fr' }}>
        <header
          style={{
            borderBottom: '1px solid #1e293b',
            padding: '0 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#0b1220',
          }}
        >
          <div style={{ color: '#94a3b8' }}>{pathname}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            API: {process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'}
          </div>
        </header>

        <main style={{ padding: '1rem', overflow: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}

