/**
 * Setup global de entorno para tests E2E.
 *
 * Objetivo pragmático:
 * - Asegurar que Prisma tenga una DATABASE_URL válida
 * - Asegurar que Redis tenga REDIS_URL configurado
 * - Evitar que los tests fallen por configuración local incompleta
 *
 * NOTA: Estos valores están alineados con `env.example` y con la
 * configuración de Docker (`npm run db:up`).
 */
(() => {
  // Solo establecer valores por defecto si no existen ya en el entorno
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public';
  }

  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379';
  }

  if (!process.env.PORT) {
    process.env.PORT = '3000';
  }
})();
