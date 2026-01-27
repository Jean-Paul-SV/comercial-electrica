import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CashService } from './cash.service';
import { PrismaService } from '../prisma/prisma.service';

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
        create: jest.fn(),
        update: jest.fn(),
      },
      cashMovement: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
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
        },
      });
    });

    it('debe abrir sesión sin usuario si no se proporciona', async () => {
      const sessionSinUsuario = {
        ...mockCashSession,
        openedBy: null,
      };

      prisma.cashSession.create = jest.fn().mockResolvedValue(sessionSinUsuario);

      const result = await service.openSession(50000);

      expect(result.openedBy).toBeNull();
      expect(prisma.cashSession.create).toHaveBeenCalledWith({
        data: {
          openingAmount: 50000,
          openedBy: null,
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

      prisma.cashSession.findUnique = jest.fn().mockResolvedValue(mockCashSession);
      prisma.cashSession.update = jest.fn().mockResolvedValue(sessionCerrada);

      const result = await service.closeSession('session-1', 61900);

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
      prisma.cashSession.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.closeSession('session-inexistente', 50000)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.closeSession('session-inexistente', 50000)).rejects.toThrow(
        'Caja no encontrada.',
      );
    });

    it('debe lanzar error si la sesión ya está cerrada', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      const sessionCerrada = {
        ...mockCashSession,
        closedAt: new Date('2026-01-22T18:00:00Z'),
        closingAmount: 61900,
      };

      prisma.cashSession.findUnique = jest.fn().mockResolvedValue(sessionCerrada);

      await expect(service.closeSession('session-1', 61900)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.closeSession('session-1', 61900)).rejects.toThrow(
        'ya está cerrada',
      );
    });
  });

  describe('getSession', () => {
    it('debe obtener una sesión existente', async () => {
      prisma.cashSession.findUnique = jest.fn().mockResolvedValue(mockCashSession);

      const result = await service.getSession('session-1');

      expect(result).toEqual(mockCashSession);
      expect(prisma.cashSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('debe lanzar error si la sesión no existe', async () => {
      prisma.cashSession.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getSession('session-inexistente')).rejects.toThrow(NotFoundException);
      await expect(service.getSession('session-inexistente')).rejects.toThrow('Caja no encontrada.');
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

      const result = await service.listSessions();

      expect(result).toEqual(mockSessions);
      expect(prisma.cashSession.findMany).toHaveBeenCalledWith({
        orderBy: { openedAt: 'desc' },
        take: 100,
        include: { movements: { orderBy: { createdAt: 'desc' }, take: 50 } },
      });
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

      prisma.cashMovement.findMany = jest.fn().mockResolvedValue(mockMovements);

      const result = await service.listMovements('session-1');

      expect(result).toEqual(mockMovements);
      expect(prisma.cashMovement.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
    });
  });
});
