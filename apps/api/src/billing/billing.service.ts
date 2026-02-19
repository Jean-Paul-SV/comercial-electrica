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
  plan: { id: string; name: string; slug: string } | null;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
  } | null;
  /** Plan programado para downgrade; vigente a partir de scheduledChangeAt. */
  scheduledPlan: { id: string; name: string; slug: string } | null;
  /** Fecha en que se aplicará el cambio programado (fin del ciclo). */
  scheduledChangeAt: string | null;
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
    if (
      this.stripe &&
      subscription?.stripeSubscriptionId &&
      effectivePriceId
    ) {
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
    let subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        plan: { select: { id: true, name: true, slug: true } },
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
            plan: { select: { id: true, name: true, slug: true } },
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
      canManageBilling,
      requiresPayment: requiresPayment || shouldBlockAccess,
      gracePeriodEnd: gracePeriodEnd?.toISOString() ?? null,
      inGracePeriod: inGracePeriod || false,
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
