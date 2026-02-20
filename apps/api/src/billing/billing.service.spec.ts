import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PlanLimitsService } from '../common/services/plan-limits.service';
import { AlertService } from '../common/services/alert.service';
import { MailerService } from '../mailer/mailer.service';
import Stripe from 'stripe';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $transaction: jest.fn((ops) =>
      Array.isArray(ops) ? Promise.all(ops) : ops,
    ),
    stripeEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    tenant: {
      update: jest.fn(),
    },
    plan: {
      findFirst: jest.fn(),
    },
  };

  const mockStripe = {
    subscriptions: {
      retrieve: jest.fn(),
      cancel: jest.fn(),
    },
    invoices: {
      retrieve: jest.fn(),
      list: jest.fn(),
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
              return undefined;
            }),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
          },
        },
        {
          provide: PlanLimitsService,
          useValue: {
            getCurrentUserCount: jest.fn().mockResolvedValue(0),
            getMaxUsersForTenant: jest.fn().mockResolvedValue(null),
            validateUserLimit: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AlertService,
          useValue: {
            sendAlert: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn().mockResolvedValue(undefined),
            isConfigured: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    prisma = module.get<PrismaService>(PrismaService);

    // Mock Stripe instance
    (service as any).stripe = mockStripe;

    jest.clearAllMocks();
  });

  describe('handleStripeEvent - Idempotencia', () => {
    it('debe ignorar evento ya procesado', async () => {
      const eventId = 'evt_test_123';
      const event: Stripe.Event = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.paid',
        data: { object: {} as Stripe.Invoice },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      mockPrismaService.stripeEvent.findUnique.mockResolvedValue({
        eventId,
        type: 'invoice.paid',
        processedAt: new Date(),
      });

      await service.handleStripeEvent(event);

      // No debe crear un nuevo evento
      expect(mockPrismaService.stripeEvent.create).not.toHaveBeenCalled();
    });

    it('debe procesar evento nuevo', async () => {
      const eventId = 'evt_test_new';
      const event: Stripe.Event = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_test',
            subscription: 'sub_test',
            status: 'paid',
          } as Stripe.Invoice,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      mockPrismaService.stripeEvent.findUnique.mockResolvedValue(null);
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 'sub-db-id',
        tenantId: 'tenant-123',
        stripeSubscriptionId: 'sub_test',
      });
      mockPrismaService.subscription.update.mockResolvedValue({});
      mockPrismaService.stripeEvent.create.mockResolvedValue({});

      await service.handleStripeEvent(event);

      // Debe crear el evento
      expect(mockPrismaService.stripeEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId,
          type: 'invoice.paid',
        }),
      });
    });
  });

  describe('handleStripeEvent - Tipos de eventos', () => {
    beforeEach(() => {
      mockPrismaService.stripeEvent.findUnique.mockResolvedValue(null);
    });

    it('debe manejar invoice.paid', async () => {
      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_test',
            subscription: 'sub_test',
            status: 'paid',
            period_end: Math.floor(Date.now() / 1000) + 86400,
          } as Stripe.Invoice,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 'sub-db-id',
        stripeSubscriptionId: 'sub_test',
      });
      mockPrismaService.subscription.update.mockResolvedValue({});
      mockPrismaService.stripeEvent.create.mockResolvedValue({});

      await service.handleStripeEvent(event);

      expect(mockPrismaService.subscription.update).toHaveBeenCalled();
    });

    it('debe manejar invoice.payment_failed', async () => {
      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test',
            subscription: 'sub_test',
            status: 'open',
          } as Stripe.Invoice,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      mockPrismaService.stripeEvent.create.mockResolvedValue({});

      await service.handleStripeEvent(event);

      // Debe guardar el evento aunque no haya acción específica
      expect(mockPrismaService.stripeEvent.create).toHaveBeenCalled();
    });

    it('debe manejar customer.subscription.deleted', async () => {
      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test',
            status: 'canceled',
          } as Stripe.Subscription,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 'sub-db-id',
        stripeSubscriptionId: 'sub_test',
      });
      mockPrismaService.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.stripeEvent.create.mockResolvedValue({});

      await service.handleStripeEvent(event);

      expect(mockPrismaService.subscription.updateMany).toHaveBeenCalled();
    });

    it('debe guardar eventos desconocidos sin procesarlos', async () => {
      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'charge.succeeded' as any,
        data: { object: {} },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      mockPrismaService.stripeEvent.create.mockResolvedValue({});

      await service.handleStripeEvent(event);

      // Debe guardar el evento aunque no tenga handler específico
      expect(mockPrismaService.stripeEvent.create).toHaveBeenCalled();
    });
  });

  describe('handleChargeRefunded', () => {
    beforeEach(() => {
      mockPrismaService.stripeEvent.findUnique.mockResolvedValue(null);
    });

    it('debe ignorar charge sin invoice asociado', async () => {
      const charge: Stripe.Charge = {
        id: 'ch_test',
        object: 'charge',
        amount: 10000,
        amount_refunded: 0,
        invoice: null,
      } as Stripe.Charge;

      await service.handleChargeRefunded(charge);

      expect(mockPrismaService.subscription.findUnique).not.toHaveBeenCalled();
    });

    it('debe cancelar suscripción y revocar acceso en reembolso completo', async () => {
      const charge: Stripe.Charge = {
        id: 'ch_test',
        object: 'charge',
        amount: 10000,
        amount_refunded: 10000,
        invoice: 'in_test',
      } as Stripe.Charge;

      const invoice: Stripe.Invoice = {
        id: 'in_test',
        subscription: 'sub_test',
      } as Stripe.Invoice;

      const subscription = {
        id: 'sub-db-id',
        tenantId: 'tenant-123',
        stripeSubscriptionId: 'sub_test',
        currentPeriodEnd: new Date(),
      };

      mockStripe.invoices.retrieve.mockResolvedValue(invoice);
      mockPrismaService.subscription.findUnique.mockResolvedValue(subscription);
      mockPrismaService.subscription.update.mockResolvedValue({});
      mockPrismaService.tenant.update.mockResolvedValue({});
      mockStripe.subscriptions.cancel.mockResolvedValue({});

      await service.handleChargeRefunded(charge);

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-db-id' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test');
    });

    it('debe prorrogar acceso en reembolso parcial', async () => {
      const charge: Stripe.Charge = {
        id: 'ch_test',
        object: 'charge',
        amount: 10000,
        amount_refunded: 5000, // 50% reembolsado
        invoice: 'in_test',
      } as Stripe.Charge;

      const invoice: Stripe.Invoice = {
        id: 'in_test',
        subscription: 'sub_test',
      } as Stripe.Invoice;

      const subscription = {
        id: 'sub-db-id',
        tenantId: 'tenant-123',
        stripeSubscriptionId: 'sub_test',
        currentPeriodEnd: new Date('2024-01-01'),
      };

      mockStripe.invoices.retrieve.mockResolvedValue(invoice);
      mockPrismaService.subscription.findUnique.mockResolvedValue(subscription);
      mockPrismaService.subscription.update.mockResolvedValue({});

      await service.handleChargeRefunded(charge);

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-db-id' },
          data: expect.objectContaining({
            currentPeriodEnd: expect.any(Date),
          }),
        }),
      );
      expect(mockPrismaService.tenant.update).not.toHaveBeenCalled();
    });
  });

  describe('handleInvoiceCreated', () => {
    it('debe registrar creación de factura', async () => {
      const invoice: Stripe.Invoice = {
        id: 'in_test',
        subscription: 'sub_test',
        status: 'draft',
      } as Stripe.Invoice;

      await service.handleInvoiceCreated(invoice);

      // Solo debe loggear, no hay acción específica
      expect(mockPrismaService.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('handleInvoiceFinalized', () => {
    it('debe registrar finalización de factura', async () => {
      const invoice: Stripe.Invoice = {
        id: 'in_test',
        subscription: 'sub_test',
        status: 'open',
      } as Stripe.Invoice;

      await service.handleInvoiceFinalized(invoice);

      // Solo debe loggear, no hay acción específica aún
      expect(mockPrismaService.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('handleInvoiceVoided', () => {
    it('debe registrar anulación de factura', async () => {
      const invoice: Stripe.Invoice = {
        id: 'in_test',
        subscription: 'sub_test',
        status: 'void',
      } as Stripe.Invoice;

      await service.handleInvoiceVoided(invoice);

      // Solo debe loggear
      expect(mockPrismaService.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('reconcileStripeSubscriptions', () => {
    it('debe retornar 0 si Stripe no está configurado', async () => {
      (service as any).stripe = null;
      const result = await service.reconcileStripeSubscriptions();
      expect(result).toEqual({ checked: 0, synced: 0, errors: 0 });
    });

    it('debe sincronizar suscripciones con needsStripeSync=true', async () => {
      const subscription = {
        id: 'sub-db-id',
        tenantId: 'tenant-123',
        stripeSubscriptionId: 'sub_test',
        status: 'ACTIVE',
        needsStripeSync: true,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        tenant: {
          id: 'tenant-123',
          planId: 'plan-1',
          billingInterval: 'monthly',
          plan: {
            id: 'plan-1',
            stripePriceId: 'price_test',
            stripePriceIdYearly: null,
          },
        },
        plan: {
          id: 'plan-1',
          stripePriceId: 'price_test',
          stripePriceIdYearly: null,
        },
      };

      const stripeSub: Stripe.Subscription = {
        id: 'sub_test',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        items: {
          data: [
            {
              price: { id: 'price_test' },
            },
          ],
        },
      } as Stripe.Subscription;

      mockPrismaService.subscription.findMany.mockResolvedValue([subscription]);
      mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSub);
      mockPrismaService.plan.findFirst.mockResolvedValue({
        id: 'plan-1',
        stripePriceId: 'price_test',
      });
      mockPrismaService.subscription.update.mockResolvedValue({});
      mockPrismaService.tenant.update.mockResolvedValue({});

      const result = await service.reconcileStripeSubscriptions();

      expect(result.checked).toBe(1);
      expect(result.synced).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-db-id' },
          data: expect.objectContaining({
            needsStripeSync: false,
            stripeSyncError: null,
          }),
        }),
      );
    });

    it('debe registrar error si no encuentra plan correspondiente', async () => {
      const subscription = {
        id: 'sub-db-id',
        tenantId: 'tenant-123',
        stripeSubscriptionId: 'sub_test',
        status: 'ACTIVE',
        needsStripeSync: true,
        tenant: {
          id: 'tenant-123',
          planId: 'plan-1',
        },
      };

      const stripeSub: Stripe.Subscription = {
        id: 'sub_test',
        status: 'active',
        items: {
          data: [
            {
              price: { id: 'price_unknown' },
            },
          ],
        },
      } as Stripe.Subscription;

      mockPrismaService.subscription.findMany.mockResolvedValue([subscription]);
      mockStripe.subscriptions.retrieve.mockResolvedValue(stripeSub);
      mockPrismaService.plan.findFirst.mockResolvedValue(null);
      mockPrismaService.subscription.update.mockResolvedValue({});

      const result = await service.reconcileStripeSubscriptions();

      expect(result.errors).toBe(1);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-db-id' },
          data: expect.objectContaining({
            stripeSyncError: expect.stringContaining('No se encontró plan'),
          }),
        }),
      );
    });
  });

  describe('reconcileOpenInvoices', () => {
    it('debe retornar 0 si Stripe no está configurado', async () => {
      (service as any).stripe = null;
      const result = await service.reconcileOpenInvoices();
      expect(result).toEqual({
        checked: 0,
        openInvoices: 0,
        notified: 0,
        alertsSent: 0,
      });
    });

    it('debe detectar facturas abiertas y actualizar suscripciones', async () => {
      const subscription = {
        id: 'sub-db-id',
        stripeSubscriptionId: 'sub_test',
        status: 'ACTIVE',
        tenant: {
          id: 'tenant-123',
          name: 'Test Tenant',
          users: [{ email: 'admin@test.com' }],
          plan: { name: 'Basic' },
        },
      };

      const openInvoice: Stripe.Invoice = {
        id: 'in_open',
        subscription: 'sub_test',
        status: 'open',
        amount_due: 10000,
        created: Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60, // 8 días atrás
        number: 'INV-001',
        currency: 'usd',
      } as Stripe.Invoice;

      mockPrismaService.subscription.findMany.mockResolvedValue([subscription]);
      mockStripe.invoices.list.mockResolvedValue({
        data: [openInvoice],
        has_more: false,
      } as Stripe.ApiList<Stripe.Invoice>);
      mockPrismaService.subscription.update.mockResolvedValue({});

      const result = await service.reconcileOpenInvoices();

      expect(result.openInvoices).toBeGreaterThan(0);
      expect(result.alertsSent).toBeDefined();
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-db-id' },
          data: expect.objectContaining({
            status: 'PENDING_PAYMENT',
          }),
        }),
      );
    });
  });
});
