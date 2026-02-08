export type JwtClaims = {
  sub?: string;
  email?: string;
  role?: 'ADMIN' | 'USER';
  exp?: number;
};

function base64UrlDecode(input: string): string {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    const normalized = padded + '='.repeat(padLength);
    if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { atob?: (s: string) => string }).atob === 'function') {
      return (globalThis as unknown as { atob: (s: string) => string }).atob(normalized);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(normalized, 'base64').toString('utf-8');
    }
    return '';
  } catch {
    return '';
  }
}

export function decodeJwtClaims(token: string): JwtClaims | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const decoded = base64UrlDecode(parts[1]);
    if (!decoded) return null;
    const payload = JSON.parse(decoded) as JwtClaims;
    return payload;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, nowMs = Date.now()): boolean {
  const claims = decodeJwtClaims(token);
  if (!claims?.exp) return false;
  return nowMs >= claims.exp * 1000;
}

