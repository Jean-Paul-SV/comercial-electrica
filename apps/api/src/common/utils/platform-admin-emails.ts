/**
 * Emails que nunca deben asociarse a un tenant (Panel proveedor).
 * Variable de entorno: PLATFORM_ADMIN_EMAILS (lista separada por comas).
 */

function getPlatformAdminEmails(): string[] {
  const list = process.env.PLATFORM_ADMIN_EMAILS?.trim();
  if (!list) return [];
  return list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** true si el email está en PLATFORM_ADMIN_EMAILS (nunca debe tener tenant). */
export function emailIsPlatformAdminOnly(email: string): boolean {
  const emails = getPlatformAdminEmails();
  return emails.includes(email.toLowerCase());
}
