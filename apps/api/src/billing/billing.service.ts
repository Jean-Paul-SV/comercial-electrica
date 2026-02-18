import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

export type SubscriptionInfoDto = {
  plan: { id: string; name: string; slug: string } | null;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
  } | null;
  /** Si true, el usuario puede abrir el portal de Stripe (actualizar pago, facturas). */
  canManageBilling: boolean;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null = null;
  private readonly webhookSecret: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? null;
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY no configurado. Webhooks de facturación no procesarán eventos.',
      );
    }
  }

  /**
   * Verifica si el webhook está configurado correctamente.
   */
  isWebhookConfigured(): boolean {
    return !!(this.webhookSecret && this.stripe);
  }

  /**
   * Verifica la firma del webhook y devuelve el evento Stripe o null si falla.
   */
  constructEvent(
    payload: Buffer | string,
    signature: string | undefined,
  ): Stripe.Event | null {
    if (!this.webhookSecret || !signature || !this.stripe) {
      return null;
    }
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.warn(
        `Firma de webhook Stripe inválida: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Procesa evento invoice.paid: prorroga el periodo de la suscripción
   * si encontramos una Subscription con stripeSubscriptionId igual al subscription del invoice.
   */
  async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;
    if (!subscriptionId) {
      this.logger.debug('invoice.paid sin subscription, ignorando');
      return;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (!subscription) {
      this.logger.debug(
        `No se encontró Subscription con stripeSubscriptionId=${subscriptionId}`,
      );
      return;
    }

    const periodEnd = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodEnd: periodEnd,
        status: 'ACTIVE',
        lastPaymentFailedAt: null,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Suscripción ${subscription.id} (tenant ${subscription.tenantId}) prorrogada hasta ${periodEnd.toISOString()} por invoice.paid`,
    );
  }

  /** Días dentro de los cuales un segundo pago fallido suspende la suscripción. */
  private readonly paymentFailureSuspendDays = 30;

  /**
   * Procesa evento invoice.payment_failed: registra el fallo y, si ya hubo uno en los últimos 30 días,
   * marca la suscripción como SUSPENDED y el tenant como inactivo.
   */
  async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;
    if (!subscriptionId) {
      this.logger.debug('invoice.payment_failed sin subscription, ignorando');
      return;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      include: { tenant: true },
    });
    if (!subscription) {
      this.logger.debug(
        `No se encontró Subscription con stripeSubscriptionId=${subscriptionId}`,
      );
      return;
    }

    const now = new Date();
    const previousFailedAt = subscription.lastPaymentFailedAt;

    const shouldSuspend =
      previousFailedAt &&
      (now.getTime() - previousFailedAt.getTime()) / (1000 * 60 * 60 * 24) <
        this.paymentFailureSuspendDays;

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          lastPaymentFailedAt: now,
          ...(shouldSuspend ? { status: 'SUSPENDED' as const } : {}),
          updatedAt: now,
        },
      }),
      ...(shouldSuspend
        ? [
            this.prisma.tenant.update({
              where: { id: subscription.tenantId },
              data: { isActive: false, updatedAt: now },
            }),
          ]
        : []),
    ]);

    if (shouldSuspend) {
      this.logger.warn(
        `Suscripción ${subscription.id} (tenant ${subscription.tenantId}) suspendida por segundo pago fallido en 30 días`,
      );
    } else {
      this.logger.warn(
        `Pago fallido registrado para suscripción ${subscription.id} (tenant ${subscription.tenantId}). Segundo fallo en 30 días suspenderá la cuenta.`,
      );
    }
  }

  /**
   * Procesa evento customer.subscription.deleted: marcar Subscription como CANCELLED.
   */
  async handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const subscriptionId = sub.id;
    const updated = await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: 'CANCELLED', updatedAt: new Date() },
    });
    if (updated.count > 0) {
      this.logger.log(
        `Suscripción con stripeSubscriptionId=${subscriptionId} marcada como CANCELLED`,
      );
    }
  }

  /**
   * Crea en Stripe un cliente y una suscripción con el precio indicado.
   * Devuelve el ID de la suscripción Stripe o null si Stripe no está configurado o falla.
   */
  async createStripeSubscription(
    tenantId: string,
    stripePriceId: string,
    customerEmail: string,
    customerName?: string,
  ): Promise<string | null> {
    if (!this.stripe) return null;
    try {
      const customer = await this.stripe.customers.create({
        email: customerEmail,
        name: customerName ?? undefined,
        metadata: { tenantId },
      });
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: stripePriceId }],
        metadata: { tenantId },
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });
      this.logger.log(
        `Stripe suscripción creada: ${subscription.id} para tenant ${tenantId}`,
      );
      return subscription.id;
    } catch (err) {
      this.logger.error(
        `Error creando suscripción Stripe para tenant ${tenantId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Lista planes activos para que el cliente pueda cambiar (precios mensual y anual).
   */
  async getActivePlans(): Promise<
    { id: string; name: string; slug: string; priceMonthly: number | null; priceYearly: number | null; maxUsers: number | null }[]
  > {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        priceMonthly: true,
        priceYearly: true,
        maxUsers: true,
      },
      orderBy: { priceMonthly: 'asc' },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      priceMonthly: p.priceMonthly != null ? Number(p.priceMonthly) : null,
      priceYearly: p.priceYearly != null ? Number(p.priceYearly) : null,
      maxUsers: p.maxUsers,
    }));
  }

  /**
   * Cambia el plan del tenant (y su suscripción). Solo para el tenant del usuario autenticado.
   */
  async changeTenantPlan(tenantId: string, planId: string): Promise<{ success: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, subscription: { select: { id: true } } },
    });
    if (!tenant) {
      throw new NotFoundException('Empresa no encontrada.');
    }
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { planId },
      });
      if (tenant.subscription) {
        await tx.subscription.update({
          where: { tenantId },
          data: { planId },
        });
      } else {
        await tx.subscription.create({
          data: {
            tenantId,
            planId,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }
    });
    return { success: true };
  }

  /**
   * Devuelve la información de plan y suscripción del tenant para mostrar en la UI de facturación.
   */
  async getSubscriptionForTenant(tenantId: string): Promise<SubscriptionInfoDto> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        plan: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!subscription) {
      throw new NotFoundException('No hay suscripción para esta cuenta.');
    }
    const canManageBilling =
      !!this.stripe && !!subscription.stripeSubscriptionId;
    return {
      plan: subscription.plan
        ? {
            id: subscription.plan.id,
            name: subscription.plan.name,
            slug: subscription.plan.slug,
          }
        : null,
      subscription: {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        currentPeriodStart:
          subscription.currentPeriodStart?.toISOString() ?? null,
      },
      canManageBilling,
    };
  }

  /**
   * Crea una sesión del Stripe Customer Portal para que el cliente gestione método de pago y facturas.
   * Devuelve la URL a la que redirigir al usuario.
   */
  async createPortalSession(
    tenantId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new BadRequestException(
        'La gestión de facturación no está configurada. Contacte a soporte.',
      );
    }
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    if (!subscription?.stripeSubscriptionId) {
      throw new BadRequestException(
        'No hay suscripción con Stripe para esta cuenta. Contacte a soporte para gestionar el pago.',
      );
    }
    let stripeCustomerId: string;
    try {
      const stripeSubscription =
        await this.stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId,
        );
      stripeCustomerId =
        typeof stripeSubscription.customer === 'string'
          ? stripeSubscription.customer
          : stripeSubscription.customer.id;
    } catch (err) {
      this.logger.warn(
        `No se pudo obtener suscripción Stripe ${subscription.stripeSubscriptionId}: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        'No se pudo conectar con el servicio de facturación. Intente más tarde.',
      );
    }
    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  /**
   * Despacha el evento Stripe al manejador correspondiente.
   * Implementa idempotencia: verifica si el evento ya fue procesado antes de procesarlo.
   */
  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    // Verificar idempotencia: si el evento ya fue procesado, ignorarlo
    const existing = await this.prisma.stripeEvent.findUnique({
      where: { eventId: event.id },
    });
    if (existing) {
      this.logger.debug(
        `Evento Stripe ${event.id} (${event.type}) ya fue procesado, ignorando (idempotencia)`,
      );
      return;
    }

    try {
      // Procesar el evento según su tipo
      switch (event.type) {
        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice;
          await this.handleInvoicePaid(invoice);
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          await this.handleInvoicePaymentFailed(invoice);
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionDeleted(sub);
          break;
        }
        default:
          this.logger.debug(`Evento Stripe no manejado: ${event.type}`);
      }

      // Guardar el evento como procesado (solo si se procesó exitosamente)
      await this.prisma.stripeEvent.create({
        data: {
          eventId: event.id,
          type: event.type,
          processedAt: new Date(),
          payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
        },
      });

      this.logger.log(
        `Evento Stripe ${event.id} (${event.type}) procesado exitosamente`,
      );
    } catch (err) {
      // Si falla el procesamiento, NO guardar el evento (permitir reintento)
      this.logger.error(
        `Error procesando evento Stripe ${event.id} (${event.type}): ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
