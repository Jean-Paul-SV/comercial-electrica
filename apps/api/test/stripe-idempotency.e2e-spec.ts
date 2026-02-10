import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp, shutdownTestApp } from './test-helpers';
import { BillingService } from '../src/billing/billing.service';
import Stripe from 'stripe';

describe('Stripe Webhook Idempotency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let billingService: BillingService;
  let tenantId: string;
  let subscriptionId: string;
  let stripeSubscriptionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    const setup = await setupTestApp(moduleFixture, 'stripe-test@example.com');
    ({ app, prisma } = setup);

    billingService = moduleFixture.get<BillingService>(BillingService);

    // Crear tenant y suscripción de prueba
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        slug: `test-tenant-${Date.now()}`,
        isActive: true,
      },
    });
    tenantId = tenant.id;

    const plan = await prisma.plan.create({
      data: {
        name: 'Test Plan',
        slug: `test-plan-${Date.now()}`,
        description: 'Test',
        priceMonthly: 50000,
        isActive: true,
      },
    });

    stripeSubscriptionId = `sub_test_${Date.now()}`;
    const subscription = await prisma.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeSubscriptionId,
      },
    });
    subscriptionId = subscription.id;
  });

  afterAll(async () => {
    if (app && prisma) await shutdownTestApp({ app, prisma });
  });

  describe('handleStripeEvent - Idempotencia', () => {
    it('debe procesar un evento la primera vez', async () => {
      const eventId = `evt_test_${Date.now()}`;
      const event: Stripe.Event = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.paid',
        data: {
          object: {
            id: `in_test_${Date.now()}`,
            object: 'invoice',
            subscription: `sub_test_${Date.now()}`,
            status: 'paid',
          } as Stripe.Invoice,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      // Procesar evento primera vez
      await billingService.handleStripeEvent(event);

      // Verificar que el evento fue guardado
      const savedEvent = await prisma.stripeEvent.findUnique({
        where: { eventId },
      });

      expect(savedEvent).toBeDefined();
      expect(savedEvent?.eventId).toBe(eventId);
      expect(savedEvent?.type).toBe('invoice.paid');
    });

    it('debe ignorar un evento duplicado (mismo event.id)', async () => {
      const eventId = `evt_test_duplicate_${Date.now()}`;
      const event: Stripe.Event = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.paid',
        data: {
          object: {
            id: `in_test_${Date.now()}`,
            object: 'invoice',
            subscription: stripeSubscriptionId,
            status: 'paid',
          } as Stripe.Invoice,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      // Procesar evento primera vez
      await billingService.handleStripeEvent(event);

      // Verificar que el evento fue guardado
      const savedEvent1 = await prisma.stripeEvent.findUnique({
        where: { eventId },
      });
      expect(savedEvent1).toBeDefined();

      // Obtener currentPeriodEnd después del primer procesamiento
      const subscriptionAfterFirst = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      const periodEndAfterFirst = subscriptionAfterFirst?.currentPeriodEnd;

      // Procesar el MISMO evento segunda vez
      await billingService.handleStripeEvent(event);

      // Verificar que NO se creó un segundo registro
      const allEvents = await prisma.stripeEvent.findMany({
        where: { eventId },
      });
      expect(allEvents.length).toBe(1);

      // Verificar que currentPeriodEnd no cambió en el segundo procesamiento
      const subscriptionAfterSecond = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      const periodEndAfterSecond = subscriptionAfterSecond?.currentPeriodEnd;

      // Si el evento se procesó dos veces, periodEndAfterSecond sería diferente de periodEndAfterFirst
      // Como es idempotente, deberían ser iguales (o el evento no debería procesarse)
      expect(periodEndAfterSecond?.getTime()).toBe(periodEndAfterFirst?.getTime());
    });
  });
});
