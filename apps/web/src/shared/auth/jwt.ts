export type JwtClaims = {
  sub?: string;
  email?: string;
  role?: 'ADMIN' | 'USER';
  exp?: number;
};

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = padded + '='.repeat(padLength);
  return atob(normalized);
}

export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload as JwtClaims;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, nowMs = Date.now()): boolean {
  const claims = decodeJwtClaims(token);
  if (!claims?.exp) return false;
  return nowMs >= claims.exp * 1000;
}

