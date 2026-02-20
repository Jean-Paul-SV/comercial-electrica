import { useTenantQueryAuditMiddleware } from './tenant-query-audit.middleware';
import * as auditContext from '../common/audit/audit-context';

describe('TenantQueryAuditMiddleware', () => {
  let mockPrisma: { $use: jest.Mock };
  let capturedMiddleware: (params: any, next: (params: any) => Promise<any>) => Promise<any>;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn').mockImplementation();
    mockPrisma = {
      $use: jest.fn((fn: (params: any, next: (params: any) => Promise<any>) => Promise<any>) => {
        capturedMiddleware = fn;
      }),
    };
    jest.spyOn(auditContext, 'getAuditContext').mockReturnValue(undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('registra el middleware en el cliente Prisma', () => {
    useTenantQueryAuditMiddleware(mockPrisma as any);
    expect(mockPrisma.$use).toHaveBeenCalledTimes(1);
    expect(capturedMiddleware).toBeDefined();
  });

  it('no loguea si el contexto no tiene tenantId', async () => {
    (auditContext.getAuditContext as jest.Mock).mockReturnValue({ tenantId: null, requestId: 'req-1' });
    useTenantQueryAuditMiddleware(mockPrisma as any);
    const next = jest.fn().mockResolvedValue([{ id: '1' }]);
    await capturedMiddleware(
      { model: 'Sale', action: 'findMany', args: {} },
      next,
    );
    expect(next).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('loguea WARN cuando hay tenantId en contexto pero la query no tiene where.tenantId', async () => {
    (auditContext.getAuditContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-123',
      requestId: 'req-1',
    });
    useTenantQueryAuditMiddleware(mockPrisma as any);
    const next = jest.fn().mockResolvedValue([{ id: '1' }]);
    await capturedMiddleware(
      { model: 'Sale', action: 'findMany', args: {} },
      next,
    );
    expect(next).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('Query sin tenantId');
    expect(warnSpy.mock.calls[0][0]).toContain('Sale');
    expect(warnSpy.mock.calls[0][0]).toContain('findMany');
    expect(warnSpy.mock.calls[0][0]).toContain('tenant-123');
  });

  it('no loguea si la query tiene where.tenantId', async () => {
    (auditContext.getAuditContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-123',
      requestId: 'req-1',
    });
    useTenantQueryAuditMiddleware(mockPrisma as any);
    const next = jest.fn().mockResolvedValue([{ id: '1' }]);
    await capturedMiddleware(
      { model: 'Sale', action: 'findMany', args: { where: { tenantId: 'tenant-123' } } },
      next,
    );
    expect(next).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('no loguea si el modelo no es tenant-scoped', async () => {
    (auditContext.getAuditContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-123',
      requestId: 'req-1',
    });
    useTenantQueryAuditMiddleware(mockPrisma as any);
    const next = jest.fn().mockResolvedValue([]);
    await capturedMiddleware(
      { model: 'Tenant', action: 'findMany', args: {} },
      next,
    );
    expect(next).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('no loguea si la acción no es de las auditable', async () => {
    (auditContext.getAuditContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-123',
      requestId: 'req-1',
    });
    useTenantQueryAuditMiddleware(mockPrisma as any);
    const next = jest.fn().mockResolvedValue({ id: '1' });
    await capturedMiddleware(
      { model: 'Sale', action: 'findUnique', args: {} },
      next,
    );
    expect(next).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('invoca next(params) y devuelve el resultado', async () => {
    (auditContext.getAuditContext as jest.Mock).mockReturnValue({ tenantId: 't1', requestId: 'r1' });
    useTenantQueryAuditMiddleware(mockPrisma as any);
    const result = { id: '1', total: 100 };
    const next = jest.fn().mockResolvedValue(result);
    const out = await capturedMiddleware(
      { model: 'Sale', action: 'findMany', args: {} },
      next,
    );
    expect(out).toBe(result);
    expect(next).toHaveBeenCalledWith({ model: 'Sale', action: 'findMany', args: {} });
  });
});
