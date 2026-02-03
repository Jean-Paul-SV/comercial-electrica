/**
 * Extrae la URL de Redis si REDIS_URL viene pegada como comando (p. ej. Upstash: "redis-cli --tls -u redis://...").
 */
export function normalizeRedisUrl(urlStr: string): string {
  const trimmed = urlStr.trim();
  const match =
    trimmed.match(/\s-u\s+(rediss?:\/\/[^\s]+)/i) ??
    trimmed.match(/(rediss?:\/\/[^\s]+)/);
  return match ? (match[1] ?? trimmed).trim() : trimmed;
}
