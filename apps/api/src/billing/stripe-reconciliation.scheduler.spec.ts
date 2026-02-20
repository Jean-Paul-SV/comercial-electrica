import { Test, TestingModule } from '@nestjs/testing';
import { StripeReconciliationScheduler } from './stripe-reconciliation.scheduler';
import { BillingService } from './billing.service';
import { Logger } from '@nestjs/common';

describe('StripeReconciliationScheduler', () => {
  let scheduler: StripeReconciliationScheduler;
  let billingService: jest.Mocked<BillingService>;

  const mockBillingService = {
    reconcileStripeSubscriptions: jest.fn(),
    reconcileOpenInvoices: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeReconciliationScheduler,
        {
          provide: BillingService,
          useValue: mockBillingService,
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

    scheduler = module.get<StripeReconciliationScheduler>(
      StripeReconciliationScheduler,
    );
    billingService = module.get(BillingService);

    jest.clearAllMocks();
  });

  describe('reconcileStripeSubscriptions', () => {
    it('debe ejecutar reconciliación exitosamente', async () => {
      mockBillingService.reconcileStripeSubscriptions.mockResolvedValue({
        checked: 5,
        synced: 4,
        errors: 1,
      });

      await scheduler.reconcileStripeSubscriptions();

      expect(
        mockBillingService.reconcileStripeSubscriptions,
      ).toHaveBeenCalledTimes(1);
    });

    it('debe manejar errores en reconciliación', async () => {
      mockBillingService.reconcileStripeSubscriptions.mockRejectedValue(
        new Error('Error de Stripe'),
      );

      await expect(
        scheduler.reconcileStripeSubscriptions(),
      ).resolves.not.toThrow();
    });
  });

  describe('reconcileOpenInvoices', () => {
    it('debe ejecutar reconciliación de facturas exitosamente', async () => {
      mockBillingService.reconcileOpenInvoices.mockResolvedValue({
        checked: 10,
        openInvoices: 2,
        notified: 2,
      });

      await scheduler.reconcileOpenInvoices();

      expect(mockBillingService.reconcileOpenInvoices).toHaveBeenCalledTimes(1);
    });

    it('debe manejar errores en reconciliación de facturas', async () => {
      mockBillingService.reconcileOpenInvoices.mockRejectedValue(
        new Error('Error de Stripe'),
      );

      await expect(scheduler.reconcileOpenInvoices()).resolves.not.toThrow();
    });
  });
});
