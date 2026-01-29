'use client';

import { useMemo, useState } from 'react';
import { useSalesList } from '@features/sales/hooks';

function money(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SalesPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const query = useSalesList({ page, limit });

  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const meta = query.data?.meta;

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Ventas</h2>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            Listado paginado desde `GET /sales`
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!meta?.hasPreviousPage}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: 10,
              border: '1px solid #334155',
              background: 'transparent',
              color: 'inherit',
              cursor: meta?.hasPreviousPage ? 'pointer' : 'default',
              opacity: meta?.hasPreviousPage ? 1 : 0.5,
            }}
          >
            Anterior
          </button>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            Página {meta?.page ?? page} / {meta?.totalPages ?? '—'}
          </div>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!meta?.hasNextPage}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: 10,
              border: '1px solid #334155',
              background: 'transparent',
              color: 'inherit',
              cursor: meta?.hasNextPage ? 'pointer' : 'default',
              opacity: meta?.hasNextPage ? 1 : 0.5,
            }}
          >
            Siguiente
          </button>
        </div>
      </div>

      {query.isLoading && (
        <div style={{ color: '#94a3b8' }}>Cargando ventas…</div>
      )}
      {query.isError && (
        <div style={{ color: '#f97316' }}>
          {(query.error as any)?.message ?? 'Error cargando ventas'}
        </div>
      )}

      <div style={{ border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#020617' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12, color: '#94a3b8' }}>
                Fecha
              </th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12, color: '#94a3b8' }}>
                Cliente
              </th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12, color: '#94a3b8' }}>
                Factura
              </th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12, color: '#94a3b8' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid #1e293b' }}>
                <td style={{ padding: 12, fontSize: 13 }}>
                  {new Date(s.soldAt).toLocaleString('es-CO')}
                </td>
                <td style={{ padding: 12, fontSize: 13, color: '#e5e7eb' }}>
                  {s.customer?.name ?? '—'}
                </td>
                <td style={{ padding: 12, fontSize: 13, color: '#94a3b8' }}>
                  {s.invoices?.[0]?.number ?? '—'}
                </td>
                <td style={{ padding: 12, textAlign: 'right', fontSize: 13 }}>
                  {money(Number(s.grandTotal))}
                </td>
              </tr>
            ))}
            {!query.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 16, color: '#94a3b8' }}>
                  No hay ventas para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

