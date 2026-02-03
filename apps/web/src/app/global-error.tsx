'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '32rem', margin: '0 auto' }}>
        <h1 style={{ color: '#b91c1c' }}>Algo salió mal</h1>
        <p>Revisa que la API esté corriendo en http://localhost:3000.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
