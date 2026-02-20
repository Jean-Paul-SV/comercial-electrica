import { Test, TestingModule } from '@nestjs/testing';
import { PlanLimitsMonitorService } from './plan-limits-monitor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanLimitsService } from './plan-limits.service';
import { AlertService } from './alert.service';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../mailer/mailer.service';
import { Logger } from '@nestjs/common';

describe('PlanLimitsMonitorService', () => {
  let service: PlanLimitsMonitorService;
  let prisma: jest.Mocked<PrismaService>;
  let alertService: jest.Mocked<AlertService>;
  let mailer: jest.Mocked<MailerService>;

  const mockPrismaService = {
    tenant: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  const mockAlertService = {
    sendAlert: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanLimitsMonitorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PlanLimitsService,
          useValue: {
            getCurrentUserCount: jest.fn(),
            getMaxUsersForTenant: jest.fn(),
          },
        },
        {
          provide: AlertService,
          useValue: mockAlertService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ALERTS_ENABLED') return 'true';
              if (key === 'PLAN_LIMITS_ALERT_AFTER_DAYS') return '7';
              if (key === 'FRONTEND_URL') return 'https://app.example.com';
              return undefined;
            }),
          },
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlanLimitsMonitorService>(PlanLimitsMonitorService);
    prisma = module.get(PrismaService);
    alertService = module.get(AlertService);
    mailer = module.get(MailerService);

    jest.clearAllMocks();
  });

  describe('detectLimitViolations', () => {
    it('debe detectar tenants que exceden límites', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([
        {
          id: 'tenant-1',
          name: 'Tenant 1',
          planId: 'plan-1',
          plan: {
            id: 'plan-1',
            name: 'Basic',
            maxUsers: 5,
          },
          users: [
            { id: 'user-1' },
            { id: 'user-2' },
            { id: 'user-3' },
            { id: 'user-4' },
            { id: 'user-5' },
            { id: 'user-6' }, // Excede límite
          ],
        },
        {
          id: 'tenant-2',
          name: 'Tenant 2',
          planId: 'plan-2',
          plan: {
            id: 'plan-2',
            name: 'Pro',
            maxUsers: 10,
          },
          users: [{ id: 'user-1' }], // Dentro del límite
        },
      ]);

      const violations = await service.detectLimitViolations();

      expect(violations).toHaveLength(1);
      expect(violations[0].tenantId).toBe('tenant-1');
      expect(violations[0].exceededBy).toBe(1);
    });

    it('debe retornar array vacío si no hay violaciones', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([
        {
          id: 'tenant-1',
          planId: 'plan-1',
          plan: {
            id: 'plan-1',
            name: 'Basic',
            maxUsers: 5,
          },
          users: [{ id: 'user-1' }],
        },
      ]);

      const violations = await service.detectLimitViolations();

      expect(violations).toHaveLength(0);
    });

    it('debe omitir tenants sin límite (maxUsers null)', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([
        {
          id: 'tenant-1',
          planId: 'plan-1',
          plan: {
            id: 'plan-1',
            name: 'Unlimited',
            maxUsers: null,
          },
          users: [{ id: 'user-1' }, { id: 'user-2' }],
        },
      ]);

      const violations = await service.detectLimitViolations();

      expect(violations).toHaveLength(0);
    });
  });

  describe('checkAndAlertLimitViolations', () => {
    it('debe enviar alertas cuando hay violaciones', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([
        {
          id: 'tenant-1',
          name: 'Tenant 1',
          planId: 'plan-1',
          plan: {
            id: 'plan-1',
            name: 'Basic',
            maxUsers: 5,
          },
          users: [
            { id: 'user-1' },
            { id: 'user-2' },
            { id: 'user-3' },
            { id: 'user-4' },
            { id: 'user-5' },
            { id: 'user-6' },
          ],
        },
      ]);

      mockPrismaService.user.findFirst.mockResolvedValue({
        email: 'admin@tenant1.com',
      });

      mockPrismaService.tenant.count.mockResolvedValue(1);
      mockAlertService.sendAlert.mockResolvedValue(undefined);
      mockMailerService.sendMail.mockResolvedValue(undefined);

      const result = await service.checkAndAlertLimitViolations();

      expect(result.violations).toBe(1);
      expect(result.alertsSent).toBe(1);
      expect(mockAlertService.sendAlert).toHaveBeenCalled();
      expect(mockMailerService.sendMail).toHaveBeenCalled();
    });

    it('debe retornar 0 si alertas están deshabilitadas', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PlanLimitsMonitorService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: PlanLimitsService,
            useValue: {},
          },
          {
            provide: AlertService,
            useValue: mockAlertService,
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'ALERTS_ENABLED') return 'false';
                return undefined;
              }),
            },
          },
          {
            provide: MailerService,
            useValue: mockMailerService,
          },
          {
            provide: Logger,
            useValue: {
              log: jest.fn(),
              error: jest.fn(),
              warn: jest.fn(),
              debug: jest.fn(),
            },
          },
        ],
      }).compile();

      const serviceWithAlertsDisabled = module.get<PlanLimitsMonitorService>(
        PlanLimitsMonitorService,
      );

      const result =
        await serviceWithAlertsDisabled.checkAndAlertLimitViolations();

      expect(result).toEqual({
        checked: 0,
        violations: 0,
        alertsSent: 0,
        blocked: 0,
      });
    });
  });

  describe('blockTenantsExceedingLimits', () => {
    it('debe retornar 0 si auto-block está deshabilitado', async () => {
      const result = await service.blockTenantsExceedingLimits();
      expect(result).toBe(0);
    });
  });
});
