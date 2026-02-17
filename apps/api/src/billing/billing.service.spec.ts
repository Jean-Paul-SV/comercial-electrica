import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import Stripe from 'stripe';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $transaction: jest.fn((ops) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
    stripeEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const mockStripe = {
    subscriptions: {
      retrieve: jest.fn(),
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
});
