// Setup global de entorno para tests E2E (Jest, ejecutado antes de los tests).
// Importante: archivo en JS plano para que Jest lo cargue sin depender de ts-jest.

(function () {
  // Base de datos del proyecto (contenedor ce_postgres)
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public';
  }

  // Redis del proyecto (contenedor ce_redis)
  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379';
  }

  // Puerto por defecto de la API en tests (no crítico, pero consistente)
  if (!process.env.PORT) {
    process.env.PORT = '3000';
  }
})();

