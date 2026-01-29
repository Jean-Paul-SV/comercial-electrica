'use client';

import { useAuth } from '@shared/providers/AuthProvider';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <h2 style={{ margin: 0 }}>Dashboard</h2>
      <div style={{ color: '#94a3b8' }}>
        Sesión activa: {user?.email} ({user?.role})
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div style={{ border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Módulo</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>Ventas</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
            Listado paginado desde API
          </div>
        </div>
        <div style={{ border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Siguiente</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>Inventario</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
            Pendiente de montar pantallas
          </div>
        </div>
      </div>
    </div>
  );
}

