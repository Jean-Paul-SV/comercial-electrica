import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CashService } from './cash.service';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';
import { TenantContextService } from '../common/services/tenant-context.service';

describe('CashService', () => {
  let service: CashService;
  let prisma: jest.Mocked<PrismaService>;

  const mockCashSession = {
    id: 'session-1',
    openedAt: new Date('2026-01-22T08:00:00Z'),
    closedAt: null,
    openingAmount: 50000,
    closingAmount: 0,
    openedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCashMovement = {
    id: 'movement-1',
    sessionId: 'session-1',
    type: 'IN' as const,
    method: 'CASH' as const,
    amount: 11900,
    reference: null,
    relatedSaleId: 'sale-1',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      cashSession: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      cashMovement: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      sale: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ValidationLimitsService,
          useValue: {
            validateCashAmount: jest.fn().mockResolvedValue(undefined),
            validateClosingAmount: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logCreate: jest.fn().mockResolvedValue(undefined),
            logUpdate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            ensureTenant: jest.fn((tenantId) => tenantId || 'tenant-default'),
          },
        },
      ],
    }).compile();

    service = module.get<CashService>(CashService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('openSession', () => {
    it('debe abrir una sesión de caja exitosamente', async () => {
      prisma.cashSession.create = jest.fn().mockResolvedValue(mockCashSession);

      const result = await service.openSession(50000, 'user-1');

      expect(result).toEqual(mockCashSession);
      expect(prisma.cashSession.create).toHaveBeenCalledWith({
        data: {
          openingAmount: 50000,
          openedBy: 'user-1',
          tenantId: 'tenant-default',
        },
      });
    });

    it('debe abrir sesión sin usuario si no se proporciona', async () => {
      const sessionSinUsuario = {
        ...mockCashSession,
        openedBy: null,
      };

      prisma.cashSession.create = jest
        .fn()
        .mockResolvedValue(sessionSinUsuario);

      const result = await service.openSession(50000);

      expect(result.openedBy).toBeNull();
      expect(prisma.cashSession.create).toHaveBeenCalledWith({
        data: {
          openingAmount: 50000,
          openedBy: null,
          tenantId: 'tenant-default',
        },
      });
    });
  });

  describe('closeSession', () => {
    it('debe cerrar una sesión de caja exitosamente', async () => {
      const sessionCerrada = {
        ...mockCashSession,
        closedAt: new Date('2026-01-22T18:00:00Z'),
        closingAmount: 61900,
      };

      prisma.cashSession.findFirst = jest
        .fn()
        .mockResolvedValue(mockCashSession);
      prisma.sale.count = jest.fn().mockResolvedValue(0);
      prisma.cashSession.update = jest.fn().mockResolvedValue(sessionCerrada);

      const result = await service.closeSession('session-1', 61900, undefined, 'tenant-1');

      expect(result.closedAt).toBeDefined();
      expect(result.closingAmount).toBe(61900);
      expect(prisma.cashSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          closedAt: expect.any(Date),
          closingAmount: 61900,
        },
      });
    });

    it('debe lanzar error si la sesión no existe', async () => {
      prisma.cashSession.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.closeSession('session-inexistente', 50000, undefined, 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.closeSession('session-inexistente', 50000, undefined, 'tenant-1'),
      ).rejects.toThrow('Caja no encontrada.');
    });

    it('debe lanzar error si la sesión ya está cerrada', async () => {
      const sessionCerrada = {
        ...mockCashSession,
        closedAt: new Date('2026-01-22T18:00:00Z'),
        closingAmount: 61900,
      };

      prisma.cashSession.findFirst = jest
        .fn()
        .mockResolvedValue(sessionCerrada);

      await expect(service.closeSession('session-1', 61900, undefined, 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.closeSession('session-1', 61900, undefined, 'tenant-1')).rejects.toThrow(
        'ya está cerrada',
      );
    });

    it('debe lanzar error si hay ventas pendientes de facturar en la sesión', async () => {
      prisma.cashSession.findFirst = jest
        .fn()
        .mockResolvedValue(mockCashSession);
      prisma.sale.count = jest.fn().mockResolvedValue(2);

      await expect(service.closeSession('session-1', 61900, undefined, 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.closeSession('session-1', 61900, undefined, 'tenant-1')).rejects.toThrow(
        'pendiente',
      );
    });
  });

  describe('getSession', () => {
    it('debe obtener una sesión existente', async () => {
      prisma.cashSession.findFirst = jest
        .fn()
        .mockResolvedValue(mockCashSession);

      const result = await service.getSession('session-1', 'tenant-1');

      expect(result).toEqual(mockCashSession);
      expect(prisma.cashSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session-1', tenantId: 'tenant-1' },
      });
    });

    it('debe lanzar error si la sesión no existe', async () => {
      prisma.cashSession.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getSession('session-inexistente')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getSession('session-inexistente')).rejects.toThrow(
        'Caja no encontrada.',
      );
    });
  });

  describe('listSessions', () => {
    it('debe listar sesiones ordenadas por fecha descendente', async () => {
      const mockSessions = [
        {
          ...mockCashSession,
          id: 'session-1',
          openedAt: new Date('2026-01-22'),
          movements: [mockCashMovement],
        },
        {
          ...mockCashSession,
          id: 'session-2',
          openedAt: new Date('2026-01-21'),
          movements: [],
        },
      ];

      prisma.cashSession.findMany = jest.fn().mockResolvedValue(mockSessions);
      prisma.cashSession.count = jest.fn().mockResolvedValue(2);

      const result = await service.listSessions();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toEqual(mockSessions);
      expect(result.meta.total).toBe(2);
      expect(prisma.cashSession.findMany).toHaveBeenCalled();
      expect(prisma.cashSession.count).toHaveBeenCalled();
    });
  });

  describe('listMovements', () => {
    it('debe listar movimientos de una sesión', async () => {
      const mockMovements = [
        mockCashMovement,
        {
          ...mockCashMovement,
          id: 'movement-2',
          type: 'OUT' as const,
          amount: 5000,
        },
      ];

      // Mock getSession (llama a findFirst)
      prisma.cashSession.findFirst = jest.fn().mockResolvedValue(mockCashSession);
      prisma.cashMovement.findMany = jest.fn().mockResolvedValue(mockMovements);
      prisma.cashMovement.count = jest.fn().mockResolvedValue(2);

      const result = await service.listMovements('session-1', 'tenant-1');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toEqual(mockMovements);
      expect(result.meta.total).toBe(2);
      expect(prisma.cashMovement.findMany).toHaveBeenCalled();
      expect(prisma.cashMovement.count).toHaveBeenCalled();
    });
  });
});
