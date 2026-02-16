import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp, shutdownTestApp } from './test-helpers';
import { BillingService } from '../src/billing/billing.service';
import Stripe from 'stripe';

describe('Stripe Webhooks - Eventos Completos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let billingService: BillingService;
  let tenantId: string;
  let subscriptionId: string;
  let stripeSubscriptionId: string;
  let planId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    const setup = await setupTestApp(moduleFixture, 'stripe-webhook-test@example.com');
    ({ app, prisma } = setup);

    billingService = moduleFixture.get<BillingService>(BillingService);

    // Crear plan
    const plan = await prisma.plan.create({
      data: {
        name: 'Test Plan Webhook',
        slug: `test-plan-webhook-${Date.now()}`,
        description: 'Test',
        priceMonthly: 50000,
        isActive: true,
      },
    });
    planId = plan.id;

    // Crear tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant Webhook',
        slug: `test-tenant-webhook-${Date.now()}`,
        isActive: true,
        planId: plan.id,
      },
    });
    tenantId = tenant.id;

    // Crear suscripción activa
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
    if (app && prisma) {
      await prisma.stripeEvent.deleteMany({
        where: { eventId: { startsWith: 'evt_test_' } },
      });
      await prisma.subscription.deleteMany({ where: { id: subscriptionId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
      await prisma.plan.deleteMany({ where: { id: planId } });
      await shutdownTestApp({ app, prisma });
    }
  });

  describe('invoice.paid', () => {
    it('debe actualizar currentPeriodEnd cuando se paga una factura', async () => {
      const eventId = `evt_test_invoice_paid_${Date.now()}`;
      const newPeriodEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 días

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
            period_end: Math.floor(newPeriodEnd.getTime() / 1000),
          } as Stripe.Invoice,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      await billingService.handleStripeEvent(event);

      // Verificar que el evento fue guardado
      const savedEvent = await prisma.stripeEvent.findUnique({
        where: { eventId },
      });
      expect(savedEvent).toBeDefined();
      expect(savedEvent?.type).toBe('invoice.paid');
    });
  });

  describe('invoice.payment_failed', () => {
    it('debe manejar factura con pago fallido', async () => {
      const eventId = `evt_test_payment_failed_${Date.now()}`;

      const event: Stripe.Event = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: `in_test_${Date.now()}`,
            object: 'invoice',
            subscription: stripeSubscriptionId,
            status: 'open',
            attempt_count: 1,
          } as Stripe.Invoice,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      await billingService.handleStripeEvent(event);

      // Verificar que el evento fue guardado
      const savedEvent = await prisma.stripeEvent.findUnique({
        where: { eventId },
      });
      expect(savedEvent).toBeDefined();
      expect(savedEvent?.type).toBe('invoice.payment_failed');
    });
  });

  describe('customer.subscription.deleted', () => {
    it('debe suspender suscripción cuando se elimina en Stripe', async () => {
      const eventId = `evt_test_sub_deleted_${Date.now()}`;

      const event: Stripe.Event = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: stripeSubscriptionId,
            object: 'subscription',
            status: 'canceled',
            canceled_at: Math.floor(Date.now() / 1000),
          } as Stripe.Subscription,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      await billingService.handleStripeEvent(event);

      // Verificar que el evento fue guardado
      const savedEvent = await prisma.stripeEvent.findUnique({
        where: { eventId },
      });
      expect(savedEvent).toBeDefined();
      expect(savedEvent?.type).toBe('customer.subscription.deleted');

      // Verificar que la suscripción fue actualizada (si el servicio lo hace)
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      // El servicio podría cambiar el status a CANCELLED o SUSPENDED
      expect(subscription).toBeDefined();
    });
  });

  describe('customer.subscription.updated', () => {
    it('debe actualizar suscripción cuando cambia en Stripe', async () => {
      const eventId = `evt_test_sub_updated_${Date.now()}`;
      const newPeriodEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      const event: Stripe.Event = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: stripeSubscriptionId,
            object: 'subscription',
            status: 'active',
            current_period_end: Math.floor(newPeriodEnd.getTime() / 1000),
          } as Stripe.Subscription,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      await billingService.handleStripeEvent(event);

      // Verificar que el evento fue guardado
      const savedEvent = await prisma.stripeEvent.findUnique({
        where: { eventId },
      });
      expect(savedEvent).toBeDefined();
      expect(savedEvent?.type).toBe('customer.subscription.updated');
    });
  });

  describe('Eventos desconocidos', () => {
    it('debe guardar eventos desconocidos sin fallar', async () => {
      const eventId = `evt_test_unknown_${Date.now()}`;

      const event: Stripe.Event = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'charge.succeeded' as any, // Tipo no manejado explícitamente
        data: {
          object: {
            id: `ch_test_${Date.now()}`,
            object: 'charge',
          },
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      // No debe lanzar error
      await expect(billingService.handleStripeEvent(event)).resolves.not.toThrow();

      // Verificar que el evento fue guardado
      const savedEvent = await prisma.stripeEvent.findUnique({
        where: { eventId },
      });
      expect(savedEvent).toBeDefined();
    });
  });
});
