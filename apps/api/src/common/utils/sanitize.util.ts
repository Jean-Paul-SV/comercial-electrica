/**
 * Utilidades para sanitizar y enmascarar datos sensibles en logs y respuestas.
 */

/**
 * Enmascara un valor sensible mostrando solo los últimos caracteres visibles.
 * @param value Valor a enmascarar
 * @param visibleChars Número de caracteres visibles al final (default: 4)
 * @returns Valor enmascarado (ej: "***1234")
 */
export function maskSensitive(
  value: string | null | undefined,
  visibleChars = 4,
): string {
  if (!value || value.length === 0) {
    return '***';
  }
  if (value.length <= visibleChars) {
    return '***';
  }
  return '***' + value.slice(-visibleChars);
}

/**
 * Enmascara un email mostrando solo el dominio y los primeros caracteres del usuario.
 * @param email Email a enmascarar
 * @returns Email enmascarado (ej: "j***@example.com")
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) {
    return '***@***';
  }
  const [user, domain] = email.split('@');
  if (user.length <= 1) {
    return `***@${domain}`;
  }
  return `${user[0]}***@${domain}`;
}

/**
 * Sanitiza metadatos de errores Prisma removiendo información sensible.
 * @param meta Metadatos de error Prisma
 * @returns Metadatos sanitizados
 */
export function sanitizePrismaMeta(meta: any): any {
  if (!meta || typeof meta !== 'object') {
    return meta;
  }
  const sanitized = { ...meta };
  // Remover nombres de tablas/columnas sensibles en producción
  if (sanitized.table) {
    sanitized.table = '[redacted]';
  }
  if (sanitized.column_name) {
    sanitized.column_name = '[redacted]';
  }
  if (sanitized.target && Array.isArray(sanitized.target)) {
    sanitized.target = sanitized.target.map(() => '[redacted]');
  }
  return sanitized;
}
