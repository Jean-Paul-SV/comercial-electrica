import { AsyncLocalStorage } from 'async_hooks';

/**
 * Contexto de auditoría por request: requestId, ip, userAgent.
 * Se establece en AuditContextInterceptor y se lee en AuditService.
 */
export interface AuditContextData {
  requestId: string;
  ip?: string;
  userAgent?: string;
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
