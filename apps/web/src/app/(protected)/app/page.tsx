'use client';

import dynamic from 'next/dynamic';

/** Carga solo en cliente (ssr: false) para evitar 500 por recharts/hooks/reportes en SSR. */
const DashboardView = dynamic(
  () => import('./DashboardView'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando dashboard…</p>
      </div>
    ),
  }
);

export default function DashboardPage() {
  return <DashboardView />;
}
