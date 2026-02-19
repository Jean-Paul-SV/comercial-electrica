import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../common/services/plan-limits.service';
import Stripe from 'stripe';

export type SubscriptionInfoDto = {
  plan: { id: string; name: string; slug: string; priceMonthly: number | null; priceYearly: number | null } | null;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
  } | null;
  /** Plan programado para downgrade; vigente a partir de scheduledChangeAt. */
  scheduledPlan: { id: string; name: string; slug: string } | null;
  /** Fecha en que se aplicará el cambio programado (fin del ciclo). */
  scheduledChangeAt: string | null;
  /** Intervalo de facturación actual: 'monthly' o 'yearly'. */
  billingInterval: 'monthly' | 'yearly' | null;
  /** Si true, el usuario puede abrir el portal de Stripe (actualizar pago, facturas). */
  canManageBilling: boolean;
  /** Si true, la app debe mostrarse bloqueada y solo el botón de pagar hasta completar el primer pago. */
  requiresPayment: boolean;
  /** Fecha de fin del periodo de gracia (7 días después de currentPeriodEnd para suscripciones canceladas). */
  gracePeriodEnd: string | null;
  /** Si true, la suscripción está cancelada, el periodo terminó, pero aún está dentro del periodo de gracia (7 días). */
  inGracePeriod: boolean;
};

export type ChangePlanResultDto = {
  success: boolean;
  /** Si el cambio es diferido (downgrade), fecha en que se aplicará. */
  scheduledChangeAt?: string;
};

export type DowngradeValidationResult = {
  allowed: boolean;
  errors: string[];
  warnings: string[];
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null = null;
  private readonly webhookSecret: string | null = null;
  /** Tax Rate ID de Stripe para aplicar IVA (ej. txr_XXXXX). Si está configurado, se aplica a todas las suscripciones. */
  private readonly stripeTaxRateId: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret =
      this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? null;
    this.stripeTaxRateId =
      this.config.get<string>('STRIPE_TAX_RATE_ID') ?? null;
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
      include: { tenant: true },
    });
    if (!subscription) {
      this.logger.warn(
        `invoice.paid: no se encontró Subscription con stripeSubscriptionId=${subscriptionId}. ¿Webhook apuntando al entorno correcto?`,
      );
      return;
    }

    // Obtener fechas de periodo desde la factura o la suscripción en Stripe
    let periodStart = subscription.currentPeriodStart;
    let periodEnd = subscription.currentPeriodEnd;

    // Si la factura tiene periodo, usarlo (más preciso)
    if (invoice.period_start && invoice.period_end) {
      periodStart = new Date(invoice.period_start * 1000);
      periodEnd = new Date(invoice.period_end * 1000);
    } else if (this.stripe) {
      // Si no, obtener la suscripción desde Stripe para obtener fechas actualizadas
      try {
        const stripeSub = await this.stripe.subscriptions.retrieve(subscriptionId);
        if (stripeSub.current_period_start && stripeSub.current_period_end) {
          periodStart = new Date(stripeSub.current_period_start * 1000);
          periodEnd = new Date(stripeSub.current_period_end * 1000);
        }
      } catch (err) {
        this.logger.warn(
          `No se pudo obtener suscripción Stripe ${subscriptionId} para actualizar fechas: ${(err as Error).message}`,
        );
        // Fallback: agregar 30 días si no hay periodo actual
        if (!periodEnd) {
          periodEnd = new Date();
          periodEnd.setDate(periodEnd.getDate() + 30);
        }
      }
    } else {
      // Fallback: agregar 30 días si no hay Stripe configurado
      if (!periodEnd) {
        periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 30);
      } else {
        periodEnd = new Date(periodEnd);
        periodEnd.setDate(periodEnd.getDate() + 30);
      }
    }

    // Asegurar que periodEnd siempre tenga un valor
    if (!periodEnd) {
      periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);
    }

    const wasCancelled = subscription.status === 'CANCELLED';

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart: periodStart ?? undefined,
        currentPeriodEnd: periodEnd ?? undefined,
        status: 'ACTIVE',
        lastPaymentFailedAt: null,
        updatedAt: new Date(),
      },
    });

    // Si se reactivó desde cancelada, también reactivar el tenant si estaba inactivo
    if (wasCancelled && !subscription.tenant.isActive) {
      await this.prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: { isActive: true, updatedAt: new Date() },
      });
      this.logger.log(
        `Suscripción ${subscription.id} (tenant ${subscription.tenantId}) reactivada desde CANCELLED por invoice.paid. Tenant también reactivado.`,
      );
    } else {
      this.logger.log(
        `Suscripción ${subscription.id} (tenant ${subscription.tenantId}) prorrogada hasta ${periodEnd.toISOString()} por invoice.paid`,
      );
    }
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
   * Procesa evento customer.subscription.deleted: marcar Subscription como CANCELLED
   * y limpiar cambio de plan programado si existía.
   */
  async handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const subscriptionId = sub.id;
    const updated = await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        status: 'CANCELLED',
        scheduledPlanId: null,
        scheduledChangeAt: null,
        updatedAt: new Date(),
      },
    });
    if (updated.count > 0) {
      this.logger.log(
        `Suscripción con stripeSubscriptionId=${subscriptionId} marcada como CANCELLED`,
      );
    }
  }

  /**
   * Procesa evento customer.subscription.updated: sincroniza estado y fechas de periodo desde Stripe.
   * Detecta cuando una suscripción cancelada se reactiva (p. ej. al agregar método de pago).
   */
  async handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const subscriptionId = sub.id;
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      include: { tenant: true },
    });
    
    if (!subscription) {
      this.logger.debug(
        `No se encontró Subscription con stripeSubscriptionId=${subscriptionId} para actualizar`,
      );
      return;
    }

    // Mapear estados de Stripe a nuestros estados
    let newStatus: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'PENDING_PAYMENT' = subscription.status as any;
    if (sub.status === 'active') {
      newStatus = 'ACTIVE';
    } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
      newStatus = 'CANCELLED';
    } else if (sub.status === 'past_due' || sub.status === 'incomplete') {
      newStatus = 'PENDING_PAYMENT';
    } else if (sub.status === 'trialing') {
      newStatus = 'ACTIVE'; // Tratar trial como activo
    }

    // Obtener fechas de periodo desde Stripe
    const currentPeriodStart = sub.current_period_start
      ? new Date(sub.current_period_start * 1000)
      : subscription.currentPeriodStart;
    const currentPeriodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : subscription.currentPeriodEnd;

    const wasCancelled = subscription.status === 'CANCELLED';
    const isNowActive = newStatus === 'ACTIVE';

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: newStatus,
        currentPeriodStart,
        currentPeriodEnd,
        lastPaymentFailedAt: isNowActive ? null : subscription.lastPaymentFailedAt,
        updatedAt: new Date(),
      },
    });

    // Si se reactivó desde cancelada, también reactivar el tenant si estaba inactivo
    if (wasCancelled && isNowActive && !subscription.tenant.isActive) {
      await this.prisma.tenant.update({
        where: { id: subscription.tenantId },
        data: { isActive: true, updatedAt: new Date() },
      });
      this.logger.log(
        `Suscripción ${subscription.id} (tenant ${subscription.tenantId}) reactivada desde CANCELLED a ACTIVE. Tenant también reactivado.`,
      );
    } else {
      this.logger.log(
        `Suscripción ${subscription.id} (tenant ${subscription.tenantId}) actualizada: ${subscription.status} → ${newStatus}`,
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
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.id,
        items: [{ price: stripePriceId }],
        metadata: { tenantId },
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      };
      // Aplicar Tax Rate manual si está configurado (para COP u otras monedas no soportadas por Stripe Tax)
      if (this.stripeTaxRateId) {
        subscriptionParams.default_tax_rates = [this.stripeTaxRateId];
      } else {
        // Intentar usar Stripe Tax automático si está disponible (puede no funcionar con COP)
        subscriptionParams.automatic_tax = { enabled: true };
      }
      const subscription = await this.stripe.subscriptions.create(subscriptionParams);
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
    {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      priceMonthly: number | null;
      priceYearly: number | null;
      maxUsers: number | null;
    }[]
  > {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
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
      description: p.description ?? null,
      priceMonthly: p.priceMonthly != null ? Number(p.priceMonthly) : null,
      priceYearly: p.priceYearly != null ? Number(p.priceYearly) : null,
      maxUsers: p.maxUsers,
    }));
  }

  /**
   * Crea una sesión de Stripe Checkout para comprar un plan (flujo tipo Spotify).
   * El usuario es redirigido a la página de Stripe donde introduce tarjeta y completa la compra.
   * La suscripción en nuestra BD se crea/actualiza en el webhook checkout.session.completed.
   * Solo para tenants sin plan o sin suscripción activa en Stripe.
   */
  async createCheckoutSessionForPlan(
    tenantId: string,
    planId: string,
    billingInterval: 'monthly' | 'yearly',
    returnUrl: string,
  ): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new BadRequestException(
        'La gestión de facturación no está configurada. Contacte a soporte.',
      );
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        name: true,
        stripePriceId: true,
        stripePriceIdYearly: true,
        features: { select: { moduleCode: true } },
      },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }

    const useYearly = billingInterval === 'yearly' && plan.stripePriceIdYearly;
    const stripePriceId = useYearly ? plan.stripePriceIdYearly : plan.stripePriceId;
    if (!stripePriceId) {
      throw new BadRequestException(
        `El plan no tiene precio configurado en Stripe para facturación ${billingInterval}. Contacte a soporte.`,
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        subscription: { select: { stripeSubscriptionId: true } },
        users: {
          where: { role: 'ADMIN' },
          take: 1,
          select: { email: true },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    const customerEmail = tenant.users[0]?.email;
    if (!customerEmail) {
      throw new BadRequestException(
        'No se encontró un email de administrador para esta empresa. Contacte a soporte.',
      );
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      customer_email: customerEmail,
      metadata: {
        tenantId,
        planId: plan.id,
        billingInterval,
      },
      subscription_data: {
        metadata: { tenantId, planId: plan.id },
        trial_period_days: undefined,
      },
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
      allow_promotion_codes: true,
    };

    // Impuestos: solo si hay Tax Rate configurado. Si no, no activar automatic_tax (Stripe exige dirección fiscal en test).
    if (this.stripeTaxRateId) {
      sessionParams.tax_id_collection = { enabled: false };
      sessionParams.subscription_data!.default_tax_rates = [this.stripeTaxRateId];
    }
    // Si no hay STRIPE_TAX_RATE_ID, no se setea automatic_tax para evitar error 400 por "valid head office address" en test.

    const session = await this.stripe.checkout.sessions.create(sessionParams);
    this.logger.log(
      `Checkout Session creada para tenant ${tenantId} plan ${planId}: ${session.id}`,
    );
    return { url: session.url! };
  }

  /**
   * Precio efectivo del plan según intervalo de facturación (para comparar upgrade vs downgrade).
   */
  private getPlanEffectivePrice(
    priceMonthly: number | null,
    priceYearly: number | null,
    billingInterval: string | null,
  ): number {
    const useYearly = billingInterval === 'yearly' && priceYearly != null;
    if (useYearly) return priceYearly;
    return priceMonthly ?? priceYearly ?? 0;
  }

  /**
   * Valida si un downgrade está permitido: límite de usuarios, módulos que perdería, DIAN activa.
   */
  async validateDowngrade(
    tenantId: string,
    newPlanId: string,
  ): Promise<DowngradeValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        planId: true,
        plan: {
          select: {
            id: true,
            features: { select: { moduleCode: true } },
          },
        },
      },
    });
    const newPlan = await this.prisma.plan.findUnique({
      where: { id: newPlanId },
      select: {
        id: true,
        maxUsers: true,
        features: { select: { moduleCode: true } },
      },
    });
    if (!tenant?.plan || !newPlan) {
      return { allowed: false, errors: ['Plan actual o nuevo no encontrado.'], warnings };
    }
    if (tenant.plan.id === newPlan.id) {
      return { allowed: true, errors: [], warnings: [] };
    }

    const currentModules = new Set(tenant.plan.features.map((f) => f.moduleCode));
    const newModules = new Set(newPlan.features.map((f) => f.moduleCode));

    // Límite de usuarios: el nuevo plan no puede tener menos que los usuarios activos
    if (newPlan.maxUsers != null) {
      const currentUsers = await this.planLimits.getCurrentUserCount(tenantId);
      if (currentUsers > newPlan.maxUsers) {
        errors.push(
          `El plan elegido permite hasta ${newPlan.maxUsers} usuarios. Tu empresa tiene ${currentUsers} usuarios activos. Reduce el número de usuarios antes de cambiar de plan.`,
        );
      }
    }

    // DIAN activa: no permitir bajar a plan sin DIAN sin flujo controlado (bloqueamos por seguridad fiscal)
    const currentHasDian = currentModules.has('electronic_invoicing');
    const newHasDian = newModules.has('electronic_invoicing');
    if (currentHasDian && !newHasDian) {
      const dianConfig = await this.prisma.dianConfig.findUnique({
        where: { tenantId },
        select: { activationStatus: true },
      });
      if (dianConfig?.activationStatus === 'ACTIVATED') {
        errors.push(
          'Tu facturación electrónica (DIAN) está activa. No puedes cambiar a un plan sin DIAN por riesgo fiscal. Contacta a soporte si necesitas desactivar el servicio.',
        );
      } else {
        warnings.push(
          'El plan actual incluye facturación electrónica (DIAN). Al cambiar, perderás acceso a ese módulo.',
        );
      }
    }

    // Advertencias por módulos que perdería
    const modulesToLose = [...currentModules].filter((m) => !newModules.has(m));
    const moduleLabels: Record<string, string> = {
      advanced_reports: 'Reportes',
      suppliers: 'Compras y proveedores',
      electronic_invoicing: 'Facturación electrónica (DIAN)',
      audit: 'Auditoría',
      backups: 'Backups',
      ai: 'IA',
    };
    if (modulesToLose.length > 0 && !errors.some((e) => e.includes('DIAN'))) {
      const labels = modulesToLose
        .map((m) => moduleLabels[m] ?? m)
        .filter(Boolean);
      if (labels.length > 0) {
        warnings.push(`Perderás acceso a: ${labels.join(', ')}.`);
      }
    }

    return {
      allowed: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Cambio de plan tipo Spotify: upgrade inmediato con prorrateo, downgrade al final del ciclo.
   */
  async changeTenantPlan(
    tenantId: string,
    planId: string,
    billingInterval?: 'monthly' | 'yearly',
  ): Promise<ChangePlanResultDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        billingInterval: true,
        planId: true,
        plan: {
          select: {
            id: true,
            priceMonthly: true,
            priceYearly: true,
            stripePriceId: true,
            stripePriceIdYearly: true,
            features: { select: { moduleCode: true } },
          },
        },
        subscription: {
          select: {
            id: true,
            stripeSubscriptionId: true,
            currentPeriodEnd: true,
            planId: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Empresa no encontrada.');
    }
    const newPlan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        priceMonthly: true,
        priceYearly: true,
        stripePriceId: true,
        stripePriceIdYearly: true,
        features: { select: { moduleCode: true } },
      },
    });
    if (!newPlan) {
      throw new NotFoundException('Plan no encontrado.');
    }

    // Usar el billingInterval proporcionado o mantener el actual
    const effectiveBillingInterval = billingInterval ?? tenant.billingInterval;
    
    // Bloquear cambio a mensual cuando el plan actual es anual
    if (tenant.billingInterval === 'yearly' && effectiveBillingInterval === 'monthly' && tenant.plan?.id === planId) {
      throw new BadRequestException({
        message: 'No se puede cambiar a mensual cuando tienes un plan anual activo.',
        errors: [
          'Las suscripciones anuales no pueden cambiarse a mensual hasta el final del periodo contratado.',
          'El cambio a mensual estará disponible al finalizar tu periodo anual actual.',
        ],
      });
    }
    
    const currentPrice = tenant.plan
      ? this.getPlanEffectivePrice(
          tenant.plan.priceMonthly != null ? Number(tenant.plan.priceMonthly) : null,
          tenant.plan.priceYearly != null ? Number(tenant.plan.priceYearly) : null,
          tenant.billingInterval,
        )
      : 0;
    const newPriceEffective = this.getPlanEffectivePrice(
      newPlan.priceMonthly != null ? Number(newPlan.priceMonthly) : null,
      newPlan.priceYearly != null ? Number(newPlan.priceYearly) : null,
      effectiveBillingInterval,
    );

    const isUpgrade = newPriceEffective > currentPrice;
    const isSamePlan = tenant.plan?.id === planId && tenant.billingInterval === effectiveBillingInterval;

    if (isSamePlan) {
      return { success: true };
    }

    if (isUpgrade) {
      return this.applyUpgrade(tenantId, tenant, newPlan, effectiveBillingInterval);
    }

    // Downgrade: validar y programar cambio al final del ciclo
    const validation = await this.validateDowngrade(tenantId, planId);
    if (!validation.allowed) {
      throw new BadRequestException({
        message: 'No se puede completar el cambio de plan.',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    const periodEnd = tenant.subscription?.currentPeriodEnd
      ? new Date(tenant.subscription.currentPeriodEnd)
      : null;
    if (!periodEnd) {
      throw new BadRequestException(
        'No se pudo obtener la fecha de fin de periodo. Contacte a soporte.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { billingInterval: effectiveBillingInterval },
      }),
      this.prisma.subscription.update({
        where: { tenantId },
        data: {
          scheduledPlanId: planId,
          scheduledChangeAt: periodEnd,
          updatedAt: new Date(),
        },
      }),
    ]);
    this.logger.log(
      `Downgrade programado para tenant ${tenantId}: plan ${planId} a partir de ${periodEnd.toISOString()}`,
    );
    return {
      success: true,
      scheduledChangeAt: periodEnd.toISOString(),
    };
  }

  /**
   * Aplica upgrade: BD + Stripe con prorrateo; flujo DIAN si aplica.
   */
  private async applyUpgrade(
    tenantId: string,
    tenant: {
      billingInterval: string | null;
      subscription: { id: string; stripeSubscriptionId: string | null } | null;
    },
    newPlan: {
      id: string;
      stripePriceId: string | null;
      stripePriceIdYearly: string | null;
      features: { moduleCode: string }[];
    },
    billingInterval?: string | null,
  ): Promise<ChangePlanResultDto> {
    const hasDianModule = newPlan.features.some(
      (f) => f.moduleCode === 'electronic_invoicing',
    );
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    // Determinar el billingInterval efectivo antes de la transacción
    const effectiveBillingInterval = billingInterval ?? tenant.billingInterval;

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          planId: newPlan.id,
          ...(effectiveBillingInterval != null && { billingInterval: effectiveBillingInterval }),
        },
      });
      if (tenant.subscription) {
        await tx.subscription.update({
          where: { tenantId },
          data: {
            planId: newPlan.id,
            scheduledPlanId: null,
            scheduledChangeAt: null,
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            tenantId,
            planId: newPlan.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }

      if (hasDianModule) {
        const existingConfig = await tx.dianConfig.findUnique({
          where: { tenantId },
        });
        if (existingConfig) {
          if (existingConfig.activationStatus !== 'ACTIVATED') {
            await tx.dianConfig.update({
              where: { tenantId },
              data: { activationStatus: 'PENDING' },
            });
          }
        } else {
          await tx.dianConfig.create({
            data: {
              tenantId,
              env: 'HABILITACION',
              activationStatus: 'PENDING',
            },
          });
        }
      }
    });
    const useYearly =
      effectiveBillingInterval === 'yearly' && newPlan.stripePriceIdYearly;
    const effectivePriceId = useYearly
      ? newPlan.stripePriceIdYearly!
      : newPlan.stripePriceId ?? null;
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      select: { stripeSubscriptionId: true },
    });
    
    // Si hay Stripe configurado y un precio efectivo
    if (this.stripe && effectivePriceId) {
      if (subscription?.stripeSubscriptionId) {
        // Ya existe suscripción en Stripe: actualizar precio
        try {
          const stripeSub = await this.stripe.subscriptions.retrieve(
            subscription.stripeSubscriptionId,
            { expand: ['items.data.price'] },
          );
          const currentPriceId = stripeSub.items.data[0]?.price?.id;
          const itemId = stripeSub.items.data[0]?.id;
          
          // Solo actualizar si el precio es diferente
          if (itemId && currentPriceId !== effectivePriceId) {
            const updateParams: Stripe.SubscriptionUpdateParams = {
              items: [{ id: itemId, price: effectivePriceId }],
              proration_behavior: 'create_prorations',
            };
            if (this.stripeTaxRateId) {
              updateParams.default_tax_rates = [this.stripeTaxRateId];
            } else {
              updateParams.automatic_tax = { enabled: true };
            }
            await this.stripe.subscriptions.update(
              subscription.stripeSubscriptionId,
              updateParams,
            );
            this.logger.log(
              `Suscripción Stripe ${subscription.stripeSubscriptionId} actualizada: plan ${newPlan.id}, billingInterval ${effectiveBillingInterval}, price ${effectivePriceId} (antes: ${currentPriceId})`,
            );
          } else if (currentPriceId === effectivePriceId) {
            this.logger.log(
              `Suscripción Stripe ${subscription.stripeSubscriptionId} ya tiene el precio correcto (${effectivePriceId})`,
            );
          }
        } catch (err) {
          this.logger.error(
            `No se pudo actualizar el precio en Stripe al cambiar de plan: ${(err as Error).message}`,
            (err as Error).stack,
          );
        }
      } else {
        // No existe suscripción en Stripe: crear una nueva
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            name: true,
            users: {
              where: { role: 'ADMIN' },
              take: 1,
              select: { email: true },
            },
          },
        });
        const adminEmail = tenant?.users[0]?.email || `tenant-${tenantId}@example.com`;
        const customerName = tenant?.name || `Tenant ${tenantId}`;
        
        const stripeSubscriptionId = await this.createStripeSubscription(
          tenantId,
          effectivePriceId,
          adminEmail,
          customerName,
        );
        
        if (stripeSubscriptionId) {
          await this.prisma.subscription.update({
            where: { tenantId },
            data: {
              stripeSubscriptionId,
              status: 'PENDING_PAYMENT', // Bloqueado hasta que el cliente pague en Stripe
            },
          });
          this.logger.log(
            `Suscripción Stripe creada para tenant ${tenantId}: ${stripeSubscriptionId}`,
          );
        } else {
          this.logger.warn(
            `No se pudo crear suscripción Stripe para tenant ${tenantId}. El plan se asignó pero el pago deberá gestionarse manualmente.`,
          );
        }
      }
    } else if (!effectivePriceId) {
      this.logger.warn(
        `No se pudo actualizar Stripe: plan ${newPlan.id} no tiene stripePriceId${effectiveBillingInterval === 'yearly' ? 'Yearly' : ''} configurado`,
      );
    }

    return { success: true };
  }

  /**
   * Aplica los cambios de plan programados (downgrades) cuya fecha ya llegó.
   * Ejecutar por cron cada hora.
   */
  async applyScheduledPlanChanges(): Promise<{ applied: number }> {
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({
      where: {
        scheduledPlanId: { not: null },
        scheduledChangeAt: { lte: now },
        status: 'ACTIVE',
      },
      include: {
        tenant: { select: { billingInterval: true } },
        scheduledPlan: {
          select: {
            id: true,
            stripePriceId: true,
            stripePriceIdYearly: true,
          },
        },
      },
    });

    let applied = 0;
    for (const sub of subs) {
      if (!sub.scheduledPlanId || !sub.scheduledChangeAt || !sub.scheduledPlan) continue;
      const useYearly =
        sub.tenant.billingInterval === 'yearly' &&
        sub.scheduledPlan.stripePriceIdYearly;
      const effectivePriceId = useYearly
        ? sub.scheduledPlan.stripePriceIdYearly!
        : sub.scheduledPlan.stripePriceId ?? null;

      if (this.stripe && sub.stripeSubscriptionId && effectivePriceId) {
        try {
          const stripeSub = await this.stripe.subscriptions.retrieve(
            sub.stripeSubscriptionId,
            { expand: ['items.data'] },
          );
          const itemId = stripeSub.items.data[0]?.id;
          if (itemId) {
            const updateParams: Stripe.SubscriptionUpdateParams = {
              items: [{ id: itemId, price: effectivePriceId }],
              proration_behavior: 'none',
            };
            if (this.stripeTaxRateId) {
              updateParams.default_tax_rates = [this.stripeTaxRateId];
            } else {
              updateParams.automatic_tax = { enabled: true };
            }
            await this.stripe.subscriptions.update(sub.stripeSubscriptionId, updateParams);
          }
        } catch (err) {
          this.logger.error(
            `applyScheduledPlanChanges: error Stripe para tenant ${sub.tenantId}: ${(err as Error).message}`,
          );
          continue;
        }
      }

      await this.prisma.$transaction([
        this.prisma.tenant.update({
          where: { id: sub.tenantId },
          data: { planId: sub.scheduledPlanId },
        }),
        this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            planId: sub.scheduledPlanId,
            scheduledPlanId: null,
            scheduledChangeAt: null,
            updatedAt: now,
          },
        }),
      ]);
      applied++;
      this.logger.log(
        `Cambio programado aplicado: tenant ${sub.tenantId} -> plan ${sub.scheduledPlanId}`,
      );
    }
    return { applied };
  }

  /**
   * Si nuestra BD tiene PENDING_PAYMENT pero Stripe ya tiene la suscripción activa
   * (p. ej. el webhook falló o llegó después), actualiza la BD para desbloquear al usuario.
   */
  private async syncSubscriptionStatusFromStripe(subscription: {
    id: string;
    tenantId: string;
    status: string;
    stripeSubscriptionId: string | null;
  }): Promise<void> {
    if (
      String(subscription.status) !== 'PENDING_PAYMENT' ||
      !this.stripe ||
      !subscription.stripeSubscriptionId
    ) {
      return;
    }
    try {
      const stripeSub = await this.stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );
      if (stripeSub.status !== 'active') return;
      const periodEnd = stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000)
        : new Date();
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: periodEnd,
          lastPaymentFailedAt: null,
          updatedAt: new Date(),
        },
      });
      this.logger.log(
        `Suscripción ${subscription.id} (tenant ${subscription.tenantId}) actualizada a ACTIVE por sincronización con Stripe (webhook posiblemente no procesado).`,
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo sincronizar estado con Stripe para suscripción ${subscription.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Devuelve la información de plan y suscripción del tenant para mostrar en la UI de facturación.
   * Si está PENDING_PAYMENT, consulta Stripe y actualiza la BD si el pago ya se completó (fallback al webhook).
   */
  async getSubscriptionForTenant(
    tenantId: string,
  ): Promise<SubscriptionInfoDto> {
    // Obtener tenant para acceder a billingInterval
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { billingInterval: true },
    });
    
    let subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        plan: { select: { id: true, name: true, slug: true, priceMonthly: true, priceYearly: true } },
        scheduledPlan: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!subscription) {
      throw new NotFoundException('No hay suscripción para esta cuenta.');
    }
    await this.syncSubscriptionStatusFromStripe(subscription);
    if (String(subscription.status) === 'PENDING_PAYMENT') {
      subscription =
        (await this.prisma.subscription.findUnique({
          where: { tenantId },
          include: {
            plan: { select: { id: true, name: true, slug: true, priceMonthly: true, priceYearly: true } },
            scheduledPlan: { select: { id: true, name: true, slug: true } },
          },
        })) ?? subscription;
    }
    // Permitir gestionar billing si hay Stripe configurado y:
    // 1. Hay una suscripción activa con stripeSubscriptionId, O
    // 2. Hay un plan asignado (incluso si está cancelada, para poder reactivar)
    const canManageBilling =
      !!this.stripe &&
      (!!subscription.stripeSubscriptionId || !!subscription.planId);
    const requiresPayment = String(subscription.status) === 'PENDING_PAYMENT';
    
    // Periodo de gracia: 7 días después de que termine el periodo para suscripciones canceladas
    const GRACE_PERIOD_DAYS = 7;
    const isCancelled = String(subscription.status) === 'CANCELLED';
    const periodEnded = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd) < new Date()
      : false;
    
    // Calcular fecha de fin del periodo de gracia
    let gracePeriodEnd: Date | null = null;
    if (isCancelled && subscription.currentPeriodEnd) {
      gracePeriodEnd = new Date(subscription.currentPeriodEnd);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);
    }
    
    // Solo bloquear acceso si está cancelada Y ya pasó el periodo de gracia
    const gracePeriodEnded = gracePeriodEnd ? new Date() >= gracePeriodEnd : false;
    const shouldBlockAccess = isCancelled && periodEnded && gracePeriodEnded;
    
    // Estar en periodo de gracia: cancelada, periodo terminado, pero aún dentro de los 7 días
    const inGracePeriod = isCancelled && periodEnded && !gracePeriodEnded;
    
    return {
      plan: subscription.plan
        ? {
            id: subscription.plan.id,
            name: subscription.plan.name,
            slug: subscription.plan.slug,
            priceMonthly: subscription.plan.priceMonthly != null ? Number(subscription.plan.priceMonthly) : null,
            priceYearly: subscription.plan.priceYearly != null ? Number(subscription.plan.priceYearly) : null,
          }
        : null,
      subscription: {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        currentPeriodStart:
          subscription.currentPeriodStart?.toISOString() ?? null,
      },
      scheduledPlan: subscription.scheduledPlan
        ? {
            id: subscription.scheduledPlan.id,
            name: subscription.scheduledPlan.name,
            slug: subscription.scheduledPlan.slug,
          }
        : null,
      scheduledChangeAt: subscription.scheduledChangeAt?.toISOString() ?? null,
      billingInterval: tenant?.billingInterval as 'monthly' | 'yearly' | null ?? null,
      canManageBilling,
      requiresPayment: requiresPayment || shouldBlockAccess,
      gracePeriodEnd: gracePeriodEnd?.toISOString() ?? null,
      inGracePeriod: inGracePeriod || false,
    };
  }

  /**
   * Crea una sesión de Stripe Checkout para pagar una suscripción incompleta.
   * Usa la suscripción existente y permite completar el pago pendiente.
   * Devuelve la URL de Checkout a la que redirigir al usuario.
   */
  async createCheckoutSession(
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
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            stripePriceId: true,
            stripePriceIdYearly: true,
          },
        },
        tenant: {
          select: {
            billingInterval: true,
            users: {
              where: { role: 'ADMIN' },
              take: 1,
              select: { email: true },
            },
          },
        },
      },
    });
    
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new BadRequestException(
        'No hay suscripción Stripe para esta cuenta. Contacte a soporte.',
      );
    }
    
    // Obtener la suscripción de Stripe para obtener el customer y la factura pendiente
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId,
      { expand: ['latest_invoice', 'latest_invoice.payment_intent'] },
    );
    
    const customerId = typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer.id;
    
    // Si la suscripción está incompleta, usar el payment_intent de la factura para completar el pago
    if (stripeSubscription.status === 'incomplete' || stripeSubscription.status === 'incomplete_expired') {
      const latestInvoice = stripeSubscription.latest_invoice;
      if (latestInvoice && typeof latestInvoice !== 'string') {
        // Obtener la factura completa con el payment_intent
        const invoice = await this.stripe.invoices.retrieve(latestInvoice.id, {
          expand: ['payment_intent'],
        });
        
        if (invoice.payment_intent) {
          const paymentIntentId = typeof invoice.payment_intent === 'string'
            ? invoice.payment_intent
            : invoice.payment_intent.id;
          
          const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
          
          if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_action') {
            // Crear Checkout Session para completar el payment intent existente
            try {
              const checkoutSession = await this.stripe.checkout.sessions.create({
                customer: customerId,
                payment_intent_data: {
                  metadata: { tenantId },
                },
                mode: 'payment',
                line_items: [{
                  price_data: {
                    currency: invoice.currency || 'cop',
                    product_data: {
                      name: (subscription.plan as any)?.name || 'Suscripción',
                    },
                    unit_amount: invoice.amount_due,
                  },
                  quantity: 1,
                }],
                success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: returnUrl,
                metadata: { tenantId, subscriptionId: subscription.stripeSubscriptionId },
              });
              
              this.logger.log(
                `Checkout Session creada para completar suscripción incompleta de tenant ${tenantId}: ${checkoutSession.id}`,
              );
              
              return { url: checkoutSession.url! };
            } catch (err) {
              this.logger.error(
                `Error al crear Checkout Session para suscripción incompleta: ${(err as Error).message}`,
                err instanceof Error ? err.stack : undefined,
              );
              // Continuar con el flujo alternativo
            }
          }
        }
      }
    }
    
    // Si hay una factura pendiente con payment_intent (para suscripciones activas con pago fallido)
    const latestInvoice = stripeSubscription.latest_invoice;
    if (latestInvoice && typeof latestInvoice !== 'string' && latestInvoice.payment_intent) {
      const paymentIntent = typeof latestInvoice.payment_intent === 'string'
        ? await this.stripe.paymentIntents.retrieve(latestInvoice.payment_intent)
        : latestInvoice.payment_intent;
      
      if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_action') {
        // Crear Checkout Session para completar el payment intent
        try {
          const checkoutSession = await this.stripe.checkout.sessions.create({
            customer: customerId,
            payment_intent_data: {
              metadata: { tenantId },
            },
            mode: 'payment',
            line_items: [{
              price_data: {
                currency: typeof paymentIntent === 'string' ? 'usd' : paymentIntent.currency,
                product_data: {
                  name: (subscription.plan as any)?.name || 'Suscripción',
                },
                unit_amount: typeof paymentIntent === 'string' ? 0 : paymentIntent.amount,
              },
              quantity: 1,
            }],
            success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: returnUrl,
            metadata: { tenantId, subscriptionId: subscription.stripeSubscriptionId },
          });
          
          this.logger.log(
            `Checkout Session creada para completar payment intent de tenant ${tenantId}: ${checkoutSession.id}`,
          );
          
          return { url: checkoutSession.url! };
        } catch (err) {
          this.logger.error(
            `Error al crear Checkout Session para payment intent: ${(err as Error).message}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      }
    }
    
    // Si no hay payment intent o falló, usar la suscripción existente incompleta
    // Si la suscripción está incompleta, usar Checkout para completar el pago
    if (stripeSubscription.status === 'incomplete' || stripeSubscription.status === 'incomplete_expired') {
      // Obtener el payment_intent de la factura pendiente
      const latestInvoice = stripeSubscription.latest_invoice;
      if (latestInvoice && typeof latestInvoice !== 'string') {
        const invoice = await this.stripe.invoices.retrieve(latestInvoice.id, {
          expand: ['payment_intent'],
        });
        
        if (invoice.payment_intent) {
          const paymentIntentId = typeof invoice.payment_intent === 'string'
            ? invoice.payment_intent
            : invoice.payment_intent.id;
          
          // Crear Checkout Session para completar el payment intent existente
          try {
            const checkoutSession = await this.stripe.checkout.sessions.create({
              customer: customerId,
              payment_intent_data: {
                metadata: { tenantId },
              },
              mode: 'payment',
              line_items: [{
                price_data: {
                  currency: invoice.currency || 'cop',
                  product_data: {
                    name: (subscription.plan as any)?.name || 'Suscripción',
                  },
                  unit_amount: invoice.amount_due,
                },
                quantity: 1,
              }],
              success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: returnUrl,
              metadata: { tenantId, subscriptionId: subscription.stripeSubscriptionId },
            });
            
            this.logger.log(
              `Checkout Session creada para completar suscripción incompleta de tenant ${tenantId}: ${checkoutSession.id}`,
            );
            
            return { url: checkoutSession.url! };
          } catch (err) {
            this.logger.error(
              `Error al crear Checkout Session para suscripción incompleta: ${(err as Error).message}`,
              err instanceof Error ? err.stack : undefined,
            );
          }
        }
      }
    }
    
    // Si llegamos aquí no se pudo usar el payment_intent de la suscripción incompleta.
    // La API de Stripe Checkout no permite adjuntar una suscripción existente; solo payment_intent.
    throw new BadRequestException(
      'No se pudo crear la sesión de pago para completar tu suscripción. Intenta de nuevo en unos momentos o contacta a soporte.',
    );
  }

  /**
   * Crea una sesión del Stripe Customer Portal para que el cliente gestione método de pago y facturas.
   * Si la suscripción está incompleta, crea una Checkout Session en su lugar.
   * Devuelve la URL a la que redirigir al usuario.
   */
  async createPortalSession(
    tenantId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    if (!this.stripe) {
      this.logger.error(
        `createPortalSession llamado pero STRIPE_SECRET_KEY no está configurada. Tenant: ${tenantId}`,
      );
      throw new BadRequestException(
        'La gestión de facturación no está configurada. Contacte a soporte.',
      );
    }
    this.logger.debug(
      `Creando sesión del portal para tenant ${tenantId}, returnUrl: ${returnUrl}`,
    );
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });
    if (!subscription) {
      throw new BadRequestException(
        'No hay suscripción para esta cuenta. Contacte a soporte para gestionar el pago.',
      );
    }
    
    // Si la suscripción está pendiente de pago, usar Checkout en lugar del Portal
    if (String(subscription.status) === 'PENDING_PAYMENT' && subscription.stripeSubscriptionId) {
      this.logger.log(
        `Suscripción pendiente de pago para tenant ${tenantId}, creando Checkout Session`,
      );
      return this.createCheckoutSession(tenantId, returnUrl);
    }
    
    let stripeCustomerId: string;
    
    // Intentar obtener el customerId desde la suscripción Stripe si existe
    if (subscription.stripeSubscriptionId) {
      try {
        const stripeSubscription = await this.stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId,
        );
        stripeCustomerId =
          typeof stripeSubscription.customer === 'string'
            ? stripeSubscription.customer
            : stripeSubscription.customer.id;
      } catch (err) {
        const errorMessage = (err as Error).message || String(err);
        this.logger.error(
          `No se pudo obtener suscripción Stripe ${subscription.stripeSubscriptionId}: ${errorMessage}`,
          err instanceof Error ? err.stack : undefined,
        );
        // Si la suscripción fue eliminada en Stripe, intentar buscar el customer por metadata
        try {
          const customers = await this.stripe.customers.search({
            query: `metadata['tenantId']:'${tenantId}'`,
            limit: 1,
          });
          if (customers.data.length > 0) {
            stripeCustomerId = customers.data[0].id;
          } else {
            throw new BadRequestException(
              'No se encontró información de facturación. Contacte a soporte para reactivar su suscripción.',
            );
          }
        } catch (searchErr) {
          const searchErrorMessage = (searchErr as Error).message || String(searchErr);
          this.logger.error(
            `Error al buscar cliente Stripe por metadata para tenant ${tenantId}: ${searchErrorMessage}`,
            searchErr instanceof Error ? searchErr.stack : undefined,
          );
          // Distinguir entre errores de autenticación y otros
          if (searchErr instanceof Error && searchErr.message.includes('api_key')) {
            throw new BadRequestException(
              'Error de configuración del servicio de facturación. Contacte a soporte.',
            );
          }
          throw new BadRequestException(
            'No se pudo conectar con el servicio de facturación. Intente más tarde o contacte a soporte.',
          );
        }
      }
    } else {
      // Si no hay stripeSubscriptionId, buscar el customer por metadata
      try {
        const customers = await this.stripe.customers.search({
          query: `metadata['tenantId']:'${tenantId}'`,
          limit: 1,
        });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
        } else {
          throw new BadRequestException(
            'No hay suscripción con Stripe para esta cuenta. Contacte a soporte para gestionar el pago.',
          );
        }
      } catch (err) {
        const errorMessage = (err as Error).message || String(err);
        this.logger.error(
          `Error al buscar cliente Stripe por metadata para tenant ${tenantId}: ${errorMessage}`,
          err instanceof Error ? err.stack : undefined,
        );
        // Distinguir entre errores de autenticación y otros
        if (err instanceof Error && err.message.includes('api_key')) {
          throw new BadRequestException(
            'Error de configuración del servicio de facturación. Contacte a soporte.',
          );
        }
        throw new BadRequestException(
          'No se pudo conectar con el servicio de facturación. Intente más tarde o contacte a soporte.',
        );
      }
    }
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });
      return { url: session.url };
    } catch (err) {
      const errorMessage = (err as Error).message || String(err);
      this.logger.error(
        `Error al crear sesión del portal de Stripe para customer ${stripeCustomerId}: ${errorMessage}`,
        err instanceof Error ? err.stack : undefined,
      );
      if (err instanceof Error && err.message.includes('api_key')) {
        throw new BadRequestException(
          'Error de configuración del servicio de facturación. Contacte a soporte.',
        );
      }
      throw new BadRequestException(
        'No se pudo crear la sesión de facturación. Intente más tarde o contacte a soporte.',
      );
    }
  }

  /**
   * Procesa checkout.session.completed: cuando el usuario completa la compra en Stripe Checkout,
   * creamos o actualizamos la suscripción en nuestra BD y asignamos el plan al tenant.
   */
  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.mode !== 'subscription' || !session.subscription) {
      this.logger.debug(
        `checkout.session.completed ignorado: mode=${session.mode}, subscription=${session.subscription}`,
      );
      return;
    }

    const tenantId = session.metadata?.tenantId as string | undefined;
    const planId = session.metadata?.planId as string | undefined;
    const billingInterval = (session.metadata?.billingInterval as 'monthly' | 'yearly') || 'monthly';

    if (!tenantId || !planId) {
      this.logger.warn(
        `checkout.session.completed sin tenantId o planId en metadata: ${session.id}`,
      );
      return;
    }

    const stripeSubscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    let currentPeriodStart: Date | null = null;
    let currentPeriodEnd: Date | null = null;

    try {
      const stripeSub = await this.stripe!.subscriptions.retrieve(stripeSubscriptionId);
      if (stripeSub.current_period_start) {
        currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
      }
      if (stripeSub.current_period_end) {
        currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
      }
    } catch (err) {
      this.logger.error(
        `Error obteniendo suscripción Stripe ${stripeSubscriptionId}: ${(err as Error).message}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({
        where: { tenantId },
      });

      if (existing) {
        await tx.subscription.update({
          where: { tenantId },
          data: {
            planId,
            status: 'ACTIVE',
            stripeSubscriptionId,
            currentPeriodStart,
            currentPeriodEnd,
            scheduledPlanId: null,
            scheduledChangeAt: null,
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            tenantId,
            planId,
            status: 'ACTIVE',
            stripeSubscriptionId,
            currentPeriodStart,
            currentPeriodEnd,
            updatedAt: new Date(),
          },
        });
      }

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          planId,
          billingInterval,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `Checkout completado: tenant ${tenantId} plan ${planId} stripeSub ${stripeSubscriptionId}`,
    );
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
          const invoice = event.data.object;
          await this.handleInvoicePaid(invoice);
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          await this.handleInvoicePaymentFailed(invoice);
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          await this.handleSubscriptionDeleted(sub);
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data.object;
          await this.handleSubscriptionUpdated(sub);
          break;
        }
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await this.handleCheckoutSessionCompleted(session);
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
