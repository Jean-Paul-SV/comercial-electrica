function requiredString(
  cfg: Record<string, unknown>,
  key: string,
  opts?: { allowEmpty?: boolean },
): string {
  const v = cfg[key];
  if (typeof v !== 'string') {
    throw new Error(`Falta variable de entorno requerida: ${key}`);
  }
  if (!opts?.allowEmpty && v.trim().length === 0) {
    throw new Error(`Falta variable de entorno requerida: ${key}`);
  }
  return v;
}

function optionalString(
  cfg: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = cfg[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

function optionalNumber(
  cfg: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = cfg[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Validación ligera de envs sin dependencias externas.
 * - En producción: falla rápido si faltan variables críticas.
 * - En desarrollo/test: permite defaults donde aplica.
 */
export function validateEnv(config: Record<string, unknown>) {
  const nodeEnv = (
    optionalString(config, 'NODE_ENV') ?? 'development'
  ).toLowerCase();
  const isProd = nodeEnv === 'production';

  // Siempre requeridas
  requiredString(config, 'DATABASE_URL');
  requiredString(config, 'REDIS_URL');
  requiredString(config, 'JWT_ACCESS_SECRET');

  // Recomendadas / opcionales (pero tipadas si existen)
  optionalNumber(config, 'PORT');
  optionalNumber(config, 'CACHE_TTL_SECONDS');

  if (isProd) {
    // ALLOWED_ORIGINS opcional: si no está, la API usa CORS permitiendo todos (main.ts). Configurar en Render/Vercel para restringir.
    optionalString(config, 'ALLOWED_ORIGINS');
    requiredString(config, 'JWT_REFRESH_SECRET');
  }

  return config;
}
