/**
 * Extrae la URL de Redis si REDIS_URL viene pegada como comando (p. ej. Upstash: "redis-cli --tls -u redis://...").
 * Para Upstash (upstash.io) fuerza rediss:// para evitar ECONNRESET por TLS requerido.
 */
export function normalizeRedisUrl(urlStr: string): string {
  const trimmed = urlStr.trim();
  const match =
    trimmed.match(/\s-u\s+(rediss?:\/\/[^\s]+)/i) ??
    trimmed.match(/(rediss?:\/\/[^\s]+)/);
  let url = match ? (match[1] ?? trimmed).trim() : trimmed;
  if (url.startsWith('redis://') && url.includes('upstash.io')) {
    url = 'rediss://' + url.slice(8);
  }
  return url;
}
