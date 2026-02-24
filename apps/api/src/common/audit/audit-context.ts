import { AsyncLocalStorage } from 'async_hooks';

/**
 * Contexto de auditoría por request: requestId, ip, userAgent, tenantId, isPlatformAdmin.
 * Se establece en AuditContextInterceptor y se lee en AuditService y en el middleware de tenant.
 * isPlatformAdmin permite que el middleware de tenant permita queries sin tenantId (panel proveedor).
 */
export interface AuditContextData {
  requestId: string;
  ip?: string;
  userAgent?: string;
  tenantId?: string | null;
  isPlatformAdmin?: boolean;
}

const auditStorage = new AsyncLocalStorage<AuditContextData>();

export function runWithAuditContext<T>(
  context: AuditContextData,
  fn: () => T,
): T {
  return auditStorage.run(context, fn);
}

export function getAuditContext(): AuditContextData | undefined {
  return auditStorage.getStore();
}
