import { Logger } from '@nestjs/common';
import { getAuditContext } from '../common/audit/audit-context';

/**
 * Modelos que tienen tenantId y deben filtrarse por tenant en queries de lectura/escritura.
 * Excluye Tenant, Plan, User (User.tenantId puede ser null para platform admin), etc.
 * Alineado con schema.prisma.
 */
const TENANT_SCOPED_MODELS = new Set([
  'Category',
  'Product',
  'Customer',
  'Supplier',
  'Sale',
  'Quote',
  'Invoice',
  'PurchaseOrder',
  'SupplierInvoice',
  'CashSession',
  'Expense',
  'InventoryMovement',
  'DianConfig',
  'AuditLog',
  'BackupRun',
  'Payment',
  'TenantFeedback',
  'DianDocument',
  'TenantModule',
  'TenantAddOn',
  'Subscription',
]);
const ACTIONS_TO_CHECK = new Set([
  'findMany',
  'findFirst',
  'updateMany',
  'deleteMany',
]);

function hasTenantIdInWhere(args: { where?: Record<string, unknown> }): boolean {
  const where = args?.where;
  if (!where || typeof where !== 'object') return false;
  return 'tenantId' in where;
}

/**
 * Middleware de Prisma que registra cuando se ejecuta una query sobre un modelo
 * con alcance por tenant sin filtrar por tenantId (riesgo de fuga de datos).
 * Solo aplica cuando el request tiene tenantId (usuario de tenant autenticado).
 * En desarrollo loguea; en producción solo loguea (AlertService podría añadirse después).
 */
export function useTenantQueryAuditMiddleware(prisma: { $use: (fn: (params: any, next: (params: any) => Promise<any>) => Promise<any>) => void }) {
  const logger = new Logger('TenantQueryAudit');

  prisma.$use(async (params, next) => {
    if (!ACTIONS_TO_CHECK.has(params.action) || !TENANT_SCOPED_MODELS.has(params.model)) {
      return next(params);
    }

    const ctx = getAuditContext();
    const requestTenantId = ctx?.tenantId;
    // Si no hay tenant en el contexto, puede ser platform admin o request no autenticado: no auditar
    if (requestTenantId == null || requestTenantId === '') {
      return next(params);
    }

    if (!hasTenantIdInWhere(params.args)) {
      logger.warn(
        `Query sin tenantId: model=${params.model} action=${params.action} requestTenantId=${requestTenantId} requestId=${ctx?.requestId ?? 'n/a'}. Revisar aislamiento multi-tenant.`,
      );
    }

    return next(params);
  });
}
