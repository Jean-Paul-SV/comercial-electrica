import { AsyncLocalStorage } from 'async_hooks';

/**
 * Contexto de auditoría por request: requestId, ip, userAgent, tenantId.
 * Se establece en AuditContextInterceptor y se lee en AuditService.
 * tenantId se rellena cuando el request es autenticado (tras TenantContextInterceptor).
 */
export interface AuditContextData {
  requestId: string;
  ip?: string;
  userAgent?: string;
  tenantId?: string | null;
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
