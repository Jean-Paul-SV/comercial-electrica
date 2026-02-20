import { Test, TestingModule } from '@nestjs/testing';
import { DianCertMonitorService } from './dian-cert-monitor.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertService } from '../common/services/alert.service';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../mailer/mailer.service';
import { Logger } from '@nestjs/common';

describe('DianCertMonitorService', () => {
  let service: DianCertMonitorService;
  let prisma: jest.Mocked<PrismaService>;
  let alertService: jest.Mocked<AlertService>;
  let mailer: jest.Mocked<MailerService>;

  const mockPrismaService = {
    dianConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
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
        DianCertMonitorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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
              if (key === 'DIAN_CERT_ALERT_DAYS_BEFORE') return '30';
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

    service = module.get<DianCertMonitorService>(DianCertMonitorService);
    prisma = module.get(PrismaService);
    alertService = module.get(AlertService);
    mailer = module.get(MailerService);

    jest.clearAllMocks();
  });

  describe('detectExpiringCertificates', () => {
    it('debe detectar certificados vencidos', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // Vencido hace 5 días

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          id: 'config-1',
          tenantId: 'tenant-1',
          certValidUntil: pastDate,
          certEncrypted: 'encrypted-cert',
          tenant: {
            id: 'tenant-1',
            name: 'Tenant 1',
            users: [{ email: 'admin@tenant1.com' }],
          },
        },
      ]);

      const alerts = await service.detectExpiringCertificates();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].isExpired).toBe(true);
      expect(alerts[0].tenantId).toBe('tenant-1');
    });

    it('debe detectar certificados por vencer', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15); // Vence en 15 días

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          id: 'config-1',
          tenantId: 'tenant-1',
          certValidUntil: futureDate,
          certEncrypted: 'encrypted-cert',
          tenant: {
            id: 'tenant-1',
            name: 'Tenant 1',
            users: [{ email: 'admin@tenant1.com' }],
          },
        },
      ]);

      const alerts = await service.detectExpiringCertificates();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].isExpired).toBe(false);
      expect(alerts[0].daysUntilExpiration).toBeLessThanOrEqual(15);
    });

    it('debe omitir certificados que no vencen pronto', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60); // Vence en 60 días

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          id: 'config-1',
          tenantId: 'tenant-1',
          certValidUntil: futureDate,
          certEncrypted: 'encrypted-cert',
          tenant: {
            id: 'tenant-1',
            name: 'Tenant 1',
            users: [],
          },
        },
      ]);

      const alerts = await service.detectExpiringCertificates();

      expect(alerts).toHaveLength(0);
    });
  });

  describe('checkAndAlertCertificates', () => {
    it('debe enviar alertas para certificados vencidos', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          id: 'config-1',
          tenantId: 'tenant-1',
          certValidUntil: pastDate,
          certEncrypted: 'encrypted-cert',
          tenant: {
            id: 'tenant-1',
            name: 'Tenant 1',
            users: [{ email: 'admin@tenant1.com' }],
          },
        },
      ]);

      mockAlertService.sendAlert.mockResolvedValue(undefined);
      mockMailerService.sendMail.mockResolvedValue(undefined);

      const result = await service.checkAndAlertCertificates();

      expect(result.expired).toBe(1);
      expect(result.alertsSent).toBe(1);
      expect(mockAlertService.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
        }),
      );
    });

    it('debe retornar 0 si alertas están deshabilitadas', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DianCertMonitorService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
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

      const serviceWithAlertsDisabled = module.get<DianCertMonitorService>(
        DianCertMonitorService,
      );

      const result = await serviceWithAlertsDisabled.checkAndAlertCertificates();

      expect(result).toEqual({
        checked: 0,
        expiring: 0,
        expired: 0,
        alertsSent: 0,
      });
    });
  });

  describe('validateCertForTenant', () => {
    it('debe retornar válido si certificado no está vencido', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      mockPrismaService.dianConfig.findUnique.mockResolvedValue({
        certValidUntil: futureDate,
        certEncrypted: 'encrypted-cert',
      });

      const result = await service.validateCertForTenant('tenant-1');

      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
    });

    it('debe retornar inválido si certificado está vencido', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrismaService.dianConfig.findUnique.mockResolvedValue({
        certValidUntil: pastDate,
        certEncrypted: 'encrypted-cert',
      });

      const result = await service.validateCertForTenant('tenant-1');

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
    });

    it('debe retornar inválido si no hay certificado configurado', async () => {
      mockPrismaService.dianConfig.findUnique.mockResolvedValue({
        certValidUntil: null,
        certEncrypted: null,
      });

      const result = await service.validateCertForTenant('tenant-1');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('No hay certificado configurado');
    });
  });
});
