import { Test, TestingModule } from '@nestjs/testing';
import { DianReconciliationService } from './dian-reconciliation.service';
import { PrismaService } from '../prisma/prisma.service';
import { DianService } from './dian.service';
import { AlertService } from '../common/services/alert.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DianDocumentStatus } from '@prisma/client';

describe('DianReconciliationService', () => {
  let service: DianReconciliationService;
  let prisma: jest.Mocked<PrismaService>;
  let dianService: jest.Mocked<DianService>;
  let alertService: jest.Mocked<AlertService>;

  const mockPrismaService = {
    dianDocument: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    dianConfig: {
      findUnique: jest.fn(),
    },
  };

  const mockDianService = {
    syncDocumentStatusFromDian: jest.fn(),
  };

  const mockAlertService = {
    sendAlert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DianReconciliationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: DianService,
          useValue: mockDianService,
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
              if (key === 'DIAN_RECONCILIATION_MIN_HOURS') return '1';
              return undefined;
            }),
          },
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

    service = module.get<DianReconciliationService>(DianReconciliationService);
    prisma = module.get(PrismaService);
    dianService = module.get(DianService);
    alertService = module.get(AlertService);

    jest.clearAllMocks();
  });

  describe('reconcileSentDocuments', () => {
    it('debe reconciliar documentos SENT y actualizar estado', async () => {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 2);

      mockPrismaService.dianDocument.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          status: DianDocumentStatus.SENT,
          cufe: 'CUFE-123',
          sentAt: cutoffTime,
          invoice: {
            tenantId: 'tenant-1',
            number: 'INV-001',
          },
        },
      ]);

      mockPrismaService.dianConfig.findUnique.mockResolvedValue({
        softwareId: 'SW-123',
        softwarePin: 'PIN-123',
        env: 'test',
      });

      mockDianService.syncDocumentStatusFromDian.mockResolvedValue(undefined);

      // Después de sync, el documento cambia a ACCEPTED
      mockPrismaService.dianDocument.findUnique.mockResolvedValue({
        status: DianDocumentStatus.ACCEPTED,
      });

      const result = await service.reconcileSentDocuments();

      expect(result.checked).toBe(1);
      expect(result.synced).toBe(1);
      expect(result.accepted).toBe(1);
      expect(mockDianService.syncDocumentStatusFromDian).toHaveBeenCalledWith(
        'doc-1',
        'tenant-1',
      );
    });

    it('debe enviar alerta crítica si documento fue rechazado', async () => {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 2);

      mockPrismaService.dianDocument.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          status: DianDocumentStatus.SENT,
          cufe: 'CUFE-123',
          sentAt: cutoffTime,
          invoice: {
            tenantId: 'tenant-1',
            number: 'INV-001',
          },
        },
      ]);

      mockPrismaService.dianConfig.findUnique.mockResolvedValue({
        softwareId: 'SW-123',
        softwarePin: 'PIN-123',
        env: 'test',
      });

      mockDianService.syncDocumentStatusFromDian.mockResolvedValue(undefined);

      // Después de sync, el documento cambia a REJECTED
      mockPrismaService.dianDocument.findUnique.mockResolvedValue({
        status: DianDocumentStatus.REJECTED,
      });

      mockAlertService.sendAlert.mockResolvedValue(undefined);

      const result = await service.reconcileSentDocuments();

      expect(result.rejected).toBe(1);
      expect(mockAlertService.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
        }),
      );
    });

    it('debe omitir documentos sin tenantId', async () => {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 2);

      mockPrismaService.dianDocument.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          status: DianDocumentStatus.SENT,
          cufe: 'CUFE-123',
          sentAt: cutoffTime,
          invoice: null,
        },
      ]);

      const result = await service.reconcileSentDocuments();

      expect(result.checked).toBe(1);
      expect(result.synced).toBe(0);
      expect(mockDianService.syncDocumentStatusFromDian).not.toHaveBeenCalled();
    });
  });

  describe('reconcileDocument', () => {
    it('debe reconciliar documento específico exitosamente', async () => {
      mockPrismaService.dianDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        status: DianDocumentStatus.SENT,
        cufe: 'CUFE-123',
      });

      mockDianService.syncDocumentStatusFromDian.mockResolvedValue(undefined);

      mockPrismaService.dianDocument.findUnique.mockResolvedValue({
        status: DianDocumentStatus.ACCEPTED,
      });

      const result = await service.reconcileDocument('doc-1', 'tenant-1');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(DianDocumentStatus.ACCEPTED);
    });

    it('debe retornar error si documento no existe', async () => {
      mockPrismaService.dianDocument.findFirst.mockResolvedValue(null);

      const result = await service.reconcileDocument('doc-1', 'tenant-1');

      expect(result.success).toBe(false);
    });

    it('debe retornar error si documento no tiene CUFE', async () => {
      mockPrismaService.dianDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        status: DianDocumentStatus.SENT,
        cufe: null,
      });

      const result = await service.reconcileDocument('doc-1', 'tenant-1');

      expect(result.success).toBe(false);
    });
  });
});
