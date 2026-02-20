import { Test, TestingModule } from '@nestjs/testing';
import { DianReconciliationScheduler } from './dian-reconciliation.scheduler';
import { DianReconciliationService } from './dian-reconciliation.service';
import { Logger } from '@nestjs/common';

describe('DianReconciliationScheduler', () => {
  let scheduler: DianReconciliationScheduler;
  let reconciliationService: jest.Mocked<DianReconciliationService>;

  const mockReconciliationService = {
    reconcileSentDocuments: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DianReconciliationScheduler,
        {
          provide: DianReconciliationService,
          useValue: mockReconciliationService,
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

    scheduler = module.get<DianReconciliationScheduler>(
      DianReconciliationScheduler,
    );
    reconciliationService = module.get(DianReconciliationService);

    jest.clearAllMocks();
  });

  describe('reconcileDianDocuments', () => {
    it('debe ejecutar reconciliación exitosamente', async () => {
      mockReconciliationService.reconcileSentDocuments.mockResolvedValue({
        checked: 10,
        synced: 8,
        accepted: 7,
        rejected: 1,
        errors: 0,
      });

      await scheduler.reconcileDianDocuments();

      expect(
        mockReconciliationService.reconcileSentDocuments,
      ).toHaveBeenCalledTimes(1);
    });

    it('debe manejar errores en reconciliación', async () => {
      mockReconciliationService.reconcileSentDocuments.mockRejectedValue(
        new Error('Error de DIAN'),
      );

      await expect(scheduler.reconcileDianDocuments()).resolves.not.toThrow();
    });
  });
});
