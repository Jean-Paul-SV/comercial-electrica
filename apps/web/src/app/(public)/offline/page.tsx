'use client';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Sin conexión
        </h1>
        <p className="text-sm text-muted-foreground">
          No pudimos conectar con el servidor. Algunas secciones de Orion
          funcionan solo con conexión a internet.
        </p>
        <p className="text-xs text-muted-foreground">
          Si ya visitaste recientemente la sección de ventas, inventario, caja
          o clientes, es posible que veas los datos guardados aunque sigas sin
          conexión.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}

