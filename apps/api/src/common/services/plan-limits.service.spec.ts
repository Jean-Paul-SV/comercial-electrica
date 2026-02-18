import { Test, TestingModule } from '@nestjs/testing';
import { PlanLimitsService } from './plan-limits.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('PlanLimitsService', () => {
  let service: PlanLimitsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanLimitsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PlanLimitsService>(PlanLimitsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getMaxUsersForTenant', () => {
    it('debe retornar null si tenantId es null', async () => {
      const result = await service.getMaxUsersForTenant(null);
      expect(result).toBeNull();
      expect(mockPrismaService.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('debe retornar null si el tenant no tiene plan', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        planId: null,
        plan: null,
      });

      const result = await service.getMaxUsersForTenant('tenant-123');
      expect(result).toBeNull();
    });

    it('debe retornar maxUsers del plan', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        planId: 'plan-123',
        plan: { maxUsers: 10 },
      });

      const result = await service.getMaxUsersForTenant('tenant-123');
      expect(result).toBe(10);
    });

    it('debe retornar null si el plan no tiene maxUsers', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        planId: 'plan-123',
        plan: { maxUsers: null },
      });

      const result = await service.getMaxUsersForTenant('tenant-123');
      expect(result).toBeNull();
    });
  });

  describe('getCurrentUserCount', () => {
    it('debe retornar 0 si tenantId es null', async () => {
      const result = await service.getCurrentUserCount(null);
      expect(result).toBe(0);
      expect(mockPrismaService.user.count).not.toHaveBeenCalled();
    });

    it('debe retornar el conteo de usuarios activos', async () => {
      mockPrismaService.user.count.mockResolvedValue(5);

      const result = await service.getCurrentUserCount('tenant-123');
      expect(result).toBe(5);
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          isActive: true,
        },
      });
    });
  });

  describe('validateUserLimit', () => {
    it('no debe lanzar error si tenantId es null (platform admin)', async () => {
      await expect(service.validateUserLimit(null)).resolves.not.toThrow();
    });

    it('no debe lanzar error si no hay límite definido', async () => {
      jest.spyOn(service, 'getMaxUsersForTenant').mockResolvedValue(null);

      await expect(
        service.validateUserLimit('tenant-123'),
      ).resolves.not.toThrow();
    });

    it('no debe lanzar error si está por debajo del límite', async () => {
      jest.spyOn(service, 'getMaxUsersForTenant').mockResolvedValue(10);
      jest.spyOn(service, 'getCurrentUserCount').mockResolvedValue(5);

      await expect(
        service.validateUserLimit('tenant-123'),
      ).resolves.not.toThrow();
    });

    it('debe lanzar BadRequestException si se excede el límite', async () => {
      jest.spyOn(service, 'getMaxUsersForTenant').mockResolvedValue(10);
      jest.spyOn(service, 'getCurrentUserCount').mockResolvedValue(10);

      await expect(service.validateUserLimit('tenant-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateUserLimit('tenant-123')).rejects.toThrow(
        'límite de usuarios',
      );
    });
  });

  describe('getPlanSlugForTenant', () => {
    it('debe retornar null si tenantId es null', async () => {
      const result = await service.getPlanSlugForTenant(null);
      expect(result).toBeNull();
    });

    it('debe retornar el slug del plan', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        plan: { slug: 'plan-pro' },
      });

      const result = await service.getPlanSlugForTenant('tenant-123');
      expect(result).toBe('plan-pro');
    });

    it('debe retornar null si el tenant no tiene plan', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        plan: null,
      });

      const result = await service.getPlanSlugForTenant('tenant-123');
      expect(result).toBeNull();
    });
  });

  describe('getRateLimitForTenant', () => {
    beforeEach(() => {
      // Resetear variables de entorno
      delete process.env.THROTTLE_LIMIT_BASIC;
      delete process.env.THROTTLE_LIMIT_PRO;
      delete process.env.THROTTLE_LIMIT_ENTERPRISE;
      delete process.env.THROTTLE_LIMIT_DEFAULT;
    });

    it('debe retornar límite por defecto si no hay plan', async () => {
      jest.spyOn(service, 'getPlanSlugForTenant').mockResolvedValue(null);

      const result = await service.getRateLimitForTenant('tenant-123');
      expect(result).toBe(100); // Default
    });

    it('debe retornar límite para plan básico', async () => {
      jest
        .spyOn(service, 'getPlanSlugForTenant')
        .mockResolvedValue('plan-basico');

      const result = await service.getRateLimitForTenant('tenant-123');
      expect(result).toBe(100);
    });

    it('debe retornar límite para plan pro', async () => {
      jest.spyOn(service, 'getPlanSlugForTenant').mockResolvedValue('plan-pro');

      const result = await service.getRateLimitForTenant('tenant-123');
      expect(result).toBe(1000);
    });

    it('debe retornar límite para plan enterprise', async () => {
      jest
        .spyOn(service, 'getPlanSlugForTenant')
        .mockResolvedValue('plan-enterprise');

      const result = await service.getRateLimitForTenant('tenant-123');
      expect(result).toBe(5000);
    });

    it('debe usar variables de entorno si están configuradas', async () => {
      process.env.THROTTLE_LIMIT_PRO = '2000';
      jest.spyOn(service, 'getPlanSlugForTenant').mockResolvedValue('plan-pro');

      const result = await service.getRateLimitForTenant('tenant-123');
      expect(result).toBe(2000);
    });
  });
});
