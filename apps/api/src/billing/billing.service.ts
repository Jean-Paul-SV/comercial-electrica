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
import { AlertService } from '../common/services/alert.service';
import { MailerService } from '../mailer/mailer.service';
import type Stripe from 'stripe';

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
  /** Facturación solo con Wompi: no hay portal externo. */
  canManageBilling: boolean;
  /** Si true, la app debe mostrarse bloqueada hasta completar el pago (Wompi). */
  requiresPayment: boolean;
  /** Fecha de fin del periodo de gracia (7 días después de currentPeriodEnd para suscripciones canceladas). */
  gracePeriodEnd: string | null;
  /** Si true, la suscripción está cancelada, el periodo terminó, pero aún está dentro del periodo de gracia (7 días). */
  inGracePeriod: boolean;
  /** Con Wompi no hay factura pendiente en portal externo. */
  pendingInvoiceAmount: number | null;
  /** Con Wompi no hay factura abierta en portal externo. */
  hasUnpaidInvoice: boolean;
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
  /** Stripe eliminado: facturación solo Wompi. Getters para que código legacy no falle (siempre null). */
  private get stripe(): Stripe | null {
    return null;
  }
  private get webhookSecret(): string | null {
    return null;
  }
  private get stripeTaxRateId(): string | null {
    return null;
  }

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
    private readonly alertService: AlertService,
    private readonly mailer: MailerService,
  ) {}

  /** Stripe eliminado: facturación solo Wompi. */
  private _noStripe(): void {}

  /**
   * (Stripe eliminado.) Mantenido por compatibilidad; no hace nada.
   */
  async handleInvoicePaymentFailed(_invoice: unknown): Promise<void> {
    return;
  }

  /** (Stripe eliminado.) No-op. */
  async handleInvoicePaid(_invoice: unknown): Promise<void> {
    return;
  }

  /** (Stripe eliminado.) No-op. */
  async handleSubscriptionDeleted(_sub: unknown): Promise<void> {
    return;
  }

  /** (Stripe eliminado.) No-op. */
  async handleSubscriptionUpdated(_sub: unknown): Promise<void> {
    return;
  }

  /** (Stripe eliminado.) Siempre null; facturación solo Wompi. */
  async createStripeSubscription(
    _tenantId: string,
    _priceId: string,
    _adminEmail: string,
    _customerName: string,
  ): Promise<string | null> {
    return null;
  }

  /** (Stripe eliminado.) No-op. */
  async updateSubscriptionForUpgrade(
    _stripeSubscriptionId: string,
    _itemId: string,
    _effectivePriceId: string,
    _newPlanId: string,
    _billingInterval: 'monthly' | 'yearly',
    _currentPriceId: string,
  ): Promise<void> {
    return;
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
          const isIncomplete =
            stripeSub.status === 'incomplete' ||
            stripeSub.status === 'incomplete_expired';

          // Solo actualizar si el precio es diferente y la suscripción no está incompleta (Stripe no permite cambiar ítems en incomplete)
          if (
            itemId &&
            currentPriceId != null &&
            currentPriceId !== effectivePriceId &&
            !isIncomplete &&
            subscription.stripeSubscriptionId
          ) {
            await this.updateSubscriptionForUpgrade(
              subscription.stripeSubscriptionId,
              itemId,
              effectivePriceId,
              newPlan.id,
              (effectiveBillingInterval === 'monthly' ? 'monthly' : 'yearly') as 'monthly' | 'yearly',
              currentPriceId,
            );
          } else if (currentPriceId === effectivePriceId) {
            this.logger.log(
              `Suscripción Stripe ${subscription.stripeSubscriptionId} ya tiene el precio correcto (${effectivePriceId})`,
            );
          } else if (isIncomplete) {
            this.logger.log(
              `Suscripción Stripe ${subscription.stripeSubscriptionId} en estado ${stripeSub.status}: no se actualiza precio hasta completar el pago`,
            );
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `No se pudo actualizar el precio en Stripe al cambiar de plan: ${errorMessage}`,
            err instanceof Error ? err.stack : undefined,
          );
          
          // C1.1: Marcar para reconciliación si Stripe falla después de actualizar BD
          // El job de reconciliación intentará sincronizar BD con Stripe
          await this.prisma.subscription.update({
            where: { tenantId },
            data: {
              needsStripeSync: true,
              stripeSyncError: `Error actualizando Stripe después de upgrade: ${errorMessage}`,
              updatedAt: new Date(),
            },
          });
          
          // Enviar alerta crítica para intervención manual si es necesario
          // (asumiendo que AlertService está disponible)
          this.logger.warn(
            `Suscripción ${subscription.stripeSubscriptionId} (tenant ${tenantId}) marcada para reconciliación. BD tiene plan ${newPlan.id} pero Stripe puede tener plan anterior.`,
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
          const isIncomplete =
            stripeSub.status === 'incomplete' ||
            stripeSub.status === 'incomplete_expired';
          if (itemId && !isIncomplete) {
            const updateParams: Stripe.SubscriptionUpdateParams = {
              items: [{ id: itemId, price: effectivePriceId }],
              proration_behavior: 'none',
            };
            if (this.stripeTaxRateId) {
              updateParams.default_tax_rates = [this.stripeTaxRateId];
            }
            await this.stripe.subscriptions.update(sub.stripeSubscriptionId, updateParams);
          } else if (isIncomplete) {
            this.logger.log(
              `applyScheduledPlanChanges: suscripción ${sub.stripeSubscriptionId} en ${stripeSub.status}, se omite actualización Stripe`,
            );
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `applyScheduledPlanChanges: error Stripe para tenant ${sub.tenantId}: ${errorMessage}`,
          );
          
          // C1.2: No actualizar BD si Stripe falla - marcar para reconciliación
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              needsStripeSync: true,
              stripeSyncError: `Error aplicando cambio programado en Stripe: ${errorMessage}`,
              updatedAt: new Date(),
            },
          });
          
          this.logger.warn(
            `Cambio programado para tenant ${sub.tenantId} falló en Stripe. Marcado para reconciliación. BD mantiene plan actual hasta que se resuelva.`,
          );
          continue; // No actualizar BD si Stripe falló
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
   * (Stripe eliminado.) Sincronización con Stripe ya no aplica; facturación solo Wompi.
   */
  private async _syncStripeNoOp(): Promise<void> {
    return;
  }

  /**
   * Devuelve la información de plan y suscripción del tenant para mostrar en la UI de facturación.
   * Facturación solo con Wompi (sin portal externo).
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
    // Facturación solo Wompi: no hay portal externo
    const canManageBilling = false;
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

    // Facturación solo Wompi: no hay facturas abiertas en portal externo
    const pendingInvoiceAmount: number | null = null;
    const hasUnpaidInvoice = false;

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
      pendingInvoiceAmount,
      hasUnpaidInvoice,
    };
  }

  /**
   * Crea una sesión de Stripe Checkout para pagar una suscripción incompleta.
   * Usa la suscripción existente y permite completar el pago pendiente.
   * Devuelve la URL de Checkout a la que redirigir al usuario.
   */
  async createCheckoutSession(
    _tenantId: string,
    _returnUrl: string,
  ): Promise<{ url: string }> {
    throw new BadRequestException(
      'La facturación es solo con Wompi. Usa el botón "Pagar con Wompi" en esta página.',
    );
  }

  /** (Stripe eliminado.) createPortalSession: facturación solo Wompi. */
  async createPortalSession(
    _tenantId: string,
    _returnUrl: string,
  ): Promise<{ url: string }> {
    throw new BadRequestException(
      'La facturación es solo con Wompi. Usa "Pagar con Wompi" en esta página.',
    );
  }

  private _createPortalSessionBodyRemoved(_tenantId: string): void {
    return;
  }

  private _stripeLegacyPlaceholder(): void {
    return;
  }

  /**
   * (Stripe eliminado.) Código legacy de createPortalSession/createCheckoutSession eliminado.
   */
  private _stripeDeadCodeRemoved(): void {
    return;
  }

  /** (Código Stripe de createCheckoutSession/createPortalSession eliminado.) */
  private _stripDeadEnd(): void {
    return;
  }

  private _stripeLegacyRemoved(): void {
    return;
  }

  /** Duplicate createPortalSession (Stripe) removed; first createPortalSession above throws. */
  private _duplicatePortalRemoved(): void {
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
        case 'invoice.created': {
          const invoice = event.data.object as Stripe.Invoice;
          await this.handleInvoiceCreated(invoice);
          break;
        }
        case 'invoice.finalized': {
          const invoice = event.data.object as Stripe.Invoice;
          await this.handleInvoiceFinalized(invoice);
          break;
        }
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
        case 'invoice.voided': {
          const invoice = event.data.object as Stripe.Invoice;
          await this.handleInvoiceVoided(invoice);
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
        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          await this.handleChargeRefunded(charge);
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

  /**
   * C1.1: Job de reconciliación que sincroniza BD con Stripe cuando hay inconsistencias.
   * Ejecutar por cron cada 6 horas.
   * 
   * Busca suscripciones con needsStripeSync=true y:
   * 1. Consulta Stripe para obtener estado real
   * 2. Compara plan/precio con BD
   * 3. Sincroniza BD con Stripe (Stripe es fuente de verdad)
   * 4. Limpia needsStripeSync si sincronización exitosa
   */
  async reconcileStripeSubscriptions(): Promise<{
    checked: number;
    synced: number;
    errors: number;
  }> {
    if (!this.stripe) {
      this.logger.debug('Stripe no configurado, omitiendo reconciliación');
      return { checked: 0, synced: 0, errors: 0 };
    }

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        needsStripeSync: true,
        stripeSubscriptionId: { not: null },
      },
      include: {
        tenant: {
          select: {
            id: true,
            planId: true,
            billingInterval: true,
            plan: {
              select: {
                id: true,
                stripePriceId: true,
                stripePriceIdYearly: true,
              },
            },
          },
        },
        plan: {
          select: {
            id: true,
            stripePriceId: true,
            stripePriceIdYearly: true,
          },
        },
      },
    });

    let synced = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        if (!sub.stripeSubscriptionId) {
          // Sin Stripe ID, no se puede reconciliar
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              needsStripeSync: false,
              stripeSyncError: 'No hay stripeSubscriptionId para reconciliar',
            },
          });
          continue;
        }

        // Consultar Stripe
        const stripeSub = await this.stripe.subscriptions.retrieve(
          sub.stripeSubscriptionId,
          { expand: ['items.data.price'] },
        );

        const stripePriceId = stripeSub.items.data[0]?.price?.id;
        const stripeStatus = stripeSub.status;

        // Mapear estado de Stripe a nuestro enum
        let newStatus: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'PENDING_PAYMENT' =
          sub.status as any;
        if (stripeStatus === 'active' || stripeStatus === 'trialing') {
          newStatus = 'ACTIVE';
        } else if (stripeStatus === 'canceled' || stripeStatus === 'unpaid') {
          newStatus = 'CANCELLED';
        } else if (stripeStatus === 'past_due' || stripeStatus === 'incomplete') {
          newStatus = 'PENDING_PAYMENT';
        }

        // Buscar plan que corresponde al precio de Stripe
        const planByStripePrice = await this.prisma.plan.findFirst({
          where: {
            OR: [
              { stripePriceId: stripePriceId ?? undefined },
              { stripePriceIdYearly: stripePriceId ?? undefined },
            ],
          },
        });

        // Si encontramos un plan que corresponde al precio de Stripe, sincronizar BD
        if (planByStripePrice) {
          const billingInterval =
            planByStripePrice.stripePriceId === stripePriceId
              ? 'monthly'
              : 'yearly';

          await this.prisma.$transaction([
            this.prisma.tenant.update({
              where: { id: sub.tenantId },
              data: {
                planId: planByStripePrice.id,
                billingInterval,
              },
            }),
            this.prisma.subscription.update({
              where: { id: sub.id },
              data: {
                planId: planByStripePrice.id,
                status: newStatus,
                currentPeriodStart: stripeSub.current_period_start
                  ? new Date(stripeSub.current_period_start * 1000)
                  : sub.currentPeriodStart,
                currentPeriodEnd: stripeSub.current_period_end
                  ? new Date(stripeSub.current_period_end * 1000)
                  : sub.currentPeriodEnd,
                needsStripeSync: false,
                stripeSyncError: null,
                updatedAt: new Date(),
              },
            }),
          ]);

          synced++;
          this.logger.log(
            `Reconciliación exitosa: tenant ${sub.tenantId} sincronizado con Stripe. Plan: ${planByStripePrice.id}, Status: ${newStatus}`,
          );
        } else {
          // No se encontró plan que corresponda al precio de Stripe
          // Mantener needsStripeSync=true y registrar error
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              stripeSyncError: `No se encontró plan con stripePriceId=${stripePriceId} en Stripe. Revisar configuración de planes.`,
              updatedAt: new Date(),
            },
          });
          errors++;
          this.logger.warn(
            `Reconciliación fallida: tenant ${sub.tenantId} tiene precio ${stripePriceId} en Stripe pero no hay plan correspondiente en BD`,
          );
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            stripeSyncError: `Error en reconciliación: ${errorMessage}`,
            updatedAt: new Date(),
          },
        });
        errors++;
        this.logger.error(
          `Error reconciliando suscripción ${sub.id} (tenant ${sub.tenantId}): ${errorMessage}`,
        );
      }
    }

    return {
      checked: subscriptions.length,
      synced,
      errors,
    };
  }

  /**
   * C2.4: Reconciliación proactiva de pagos no reconocidos.
   * Detecta facturas pagadas en Stripe que no fueron procesadas en BD.
   * CRÍTICO: Reduce ventana de pérdida de ingresos si webhooks fallan.
   * 
   * Busca facturas pagadas en las últimas 2 horas que no tienen evento procesado.
   */
  async reconcilePaidInvoices(): Promise<{
    checked: number;
    paidNotRecognized: number;
    activated: number;
    errors: number;
  }> {
    if (!this.stripe) {
      this.logger.debug('Stripe no configurado, omitiendo reconciliación de pagos');
      return { checked: 0, paidNotRecognized: 0, activated: 0, errors: 0 };
    }

    const twoHoursAgo = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000);

    try {
      // Buscar facturas pagadas en las últimas 2 horas
      const paidInvoices = await this.stripe.invoices.list({
        status: 'paid',
        created: { gte: twoHoursAgo },
        limit: 100,
      });

      let checked = 0;
      let paidNotRecognized = 0;
      let activated = 0;
      let errors = 0;

      for (const invoice of paidInvoices.data) {
        checked++;

        // Buscar eventos invoice.paid procesados para esta factura
        // Stripe almacena invoice.id en payload.data.object.id
        const relatedEvents = await this.prisma.stripeEvent.findMany({
          where: {
            type: 'invoice.paid',
            // Buscar en el payload JSON
            OR: [
              {
                payload: {
                  path: ['data', 'object', 'id'],
                  equals: invoice.id,
                },
              },
            ],
          },
        });

        // Si no hay evento procesado, la factura fue pagada pero no reconocida
        if (relatedEvents.length === 0) {
          paidNotRecognized++;

          const subscriptionId =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : invoice.subscription?.id;

          if (subscriptionId) {
            try {
              // Buscar suscripción en BD
              const subscription = await this.prisma.subscription.findUnique({
                where: { stripeSubscriptionId: subscriptionId },
                include: { tenant: true },
              });

              if (subscription && subscription.status !== 'ACTIVE') {
                // Activar suscripción manualmente
                await this.prisma.subscription.update({
                  where: { id: subscription.id },
                  data: {
                    status: 'ACTIVE',
                    currentPeriodStart: invoice.period_start
                      ? new Date(invoice.period_start * 1000)
                      : subscription.currentPeriodStart,
                    currentPeriodEnd: invoice.period_end
                      ? new Date(invoice.period_end * 1000)
                      : subscription.currentPeriodEnd,
                    updatedAt: new Date(),
                  },
                });

                // Enviar alerta crítica
                if (this.alertService) {
                  await this.alertService.sendAlert({
                    title: `🔴 Pago no reconocido detectado y activado`,
                    message: `Factura ${invoice.id} pagada en Stripe pero no procesada en BD. Suscripción ${subscription.id} activada manualmente. Revisar webhooks.`,
                    severity: 'critical',
                    tenantId: subscription.tenantId,
                    tenantName: subscription.tenant.name || 'Unknown',
                    metadata: {
                      invoiceId: invoice.id,
                      subscriptionId: subscription.id,
                      amount: invoice.amount_paid / 100,
                      currency: invoice.currency,
                      timestamp: new Date().toISOString(),
                    },
                  });
                }

                activated++;
                this.logger.warn(
                  `⚠️ Pago no reconocido detectado y activado: factura ${invoice.id}, suscripción ${subscription.id}`,
                );
              }
            } catch (err) {
              errors++;
              this.logger.error(
                `Error activando suscripción para factura pagada ${invoice.id}: ${(err as Error).message}`,
              );
            }
          }
        }
      }

      if (paidNotRecognized > 0) {
        this.logger.warn(
          `⚠️ ${paidNotRecognized} facturas pagadas no reconocidas detectadas. ${activated} suscripciones activadas manualmente.`,
        );
      }

      return {
        checked,
        paidNotRecognized,
        activated,
        errors,
      };
    } catch (err) {
      this.logger.error(
        `Error en reconciliación proactiva de pagos: ${(err as Error).message}`,
      );
      return { checked: 0, paidNotRecognized: 0, activated: 0, errors: 1 };
    }
  }

  /**
   * C2.3: Maneja evento charge.refunded de Stripe.
   * 
   * Política de reembolsos:
   * - Reembolso completo: cancelar suscripción inmediatamente y revocar acceso
   * - Reembolso parcial: prorrogar acceso proporcionalmente según monto reembolsado
   * 
   * @param charge El objeto Charge de Stripe con información del reembolso
   */
  async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    // Buscar la suscripción asociada al charge
    const invoiceId =
      typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id;
    
    if (!invoiceId) {
      this.logger.debug(
        `charge.refunded sin invoice asociado (charge ${charge.id}), ignorando`,
      );
      return;
    }

    // Obtener la factura para encontrar la suscripción
    if (!this.stripe) {
      this.logger.warn('Stripe no configurado, no se puede procesar reembolso');
      return;
    }

    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);
      const subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;

      if (!subscriptionId) {
        this.logger.debug(
          `charge.refunded: invoice ${invoiceId} no tiene subscription asociada`,
        );
        return;
      }

      // Buscar suscripción en BD
      const subscription = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        include: { tenant: true },
      });

      if (!subscription) {
        this.logger.warn(
          `charge.refunded: no se encontró Subscription con stripeSubscriptionId=${subscriptionId}`,
        );
        return;
      }

      // Calcular monto reembolsado
      const refundAmount = charge.amount_refunded || 0;
      const originalAmount = charge.amount || 0;
      const isFullRefund = refundAmount >= originalAmount;

      if (isFullRefund) {
        // Reembolso completo: cancelar suscripción y revocar acceso inmediatamente
        await this.prisma.$transaction([
          this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'CANCELLED',
              updatedAt: new Date(),
            },
          }),
          this.prisma.tenant.update({
            where: { id: subscription.tenantId },
            data: {
              isActive: false,
              updatedAt: new Date(),
            },
          }),
        ]);

        this.logger.warn(
          `Reembolso completo procesado: tenant ${subscription.tenantId} cancelado y acceso revocado`,
        );

        // Opcional: cancelar suscripción en Stripe también
        try {
          await this.stripe.subscriptions.cancel(subscriptionId);
          this.logger.log(
            `Suscripción Stripe ${subscriptionId} cancelada después de reembolso completo`,
          );
        } catch (err) {
          this.logger.error(
            `Error cancelando suscripción Stripe ${subscriptionId} después de reembolso: ${(err as Error).message}`,
          );
        }
      } else {
        // Reembolso parcial: prorrogar acceso proporcionalmente
        // Calcular días adicionales basado en el porcentaje reembolsado
        const refundPercentage = refundAmount / originalAmount;
        const daysToAdd = Math.floor(30 * refundPercentage); // Asumiendo periodo mensual

        if (subscription.currentPeriodEnd) {
          const newPeriodEnd = new Date(subscription.currentPeriodEnd);
          newPeriodEnd.setDate(newPeriodEnd.getDate() + daysToAdd);

          await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              currentPeriodEnd: newPeriodEnd,
              updatedAt: new Date(),
            },
          });

          this.logger.log(
            `Reembolso parcial procesado: tenant ${subscription.tenantId} acceso prorrogado ${daysToAdd} días hasta ${newPeriodEnd.toISOString()}`,
          );
        } else {
          this.logger.warn(
            `Reembolso parcial: no se pudo prorrogar acceso para tenant ${subscription.tenantId} (sin currentPeriodEnd)`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Error procesando reembolso (charge ${charge.id}): ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err; // Re-lanzar para que se maneje el error y se pueda reintentar
    }
  }

  /**
   * C2.1: Maneja evento invoice.created de Stripe.
   * 
   * Se dispara cuando Stripe crea una nueva factura (ej. upgrade con prorrateo).
   * Registramos la factura pendiente para tracking.
   */
  async handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;
    
    if (!subscriptionId) {
      this.logger.debug('invoice.created sin subscription, ignorando');
      return;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      include: { tenant: true },
    });

    if (!subscription) {
      this.logger.debug(
        `invoice.created: no se encontró Subscription con stripeSubscriptionId=${subscriptionId}`,
      );
      return;
    }

    // Log para tracking (no hay acción inmediata, solo registro)
    this.logger.log(
      `Factura creada en Stripe: ${invoice.id} para tenant ${subscription.tenantId}, monto: ${invoice.amount_due ? invoice.amount_due / 100 : 0} ${invoice.currency || 'USD'}`,
    );

    // Si la factura está en estado "open" (pendiente de pago), podemos marcar la suscripción
    // para que el frontend muestre "Tienes una factura pendiente"
    if (invoice.status === 'open' && invoice.amount_due > 0) {
      // No actualizamos BD aquí porque invoice.finalized o invoice.paid manejarán el estado
      // Solo logueamos para debugging
      this.logger.debug(
        `Factura ${invoice.id} está abierta y pendiente de pago (${invoice.amount_due / 100} ${invoice.currency})`,
      );
    }
  }

  /**
   * C2.1: Maneja evento invoice.finalized de Stripe.
   * 
   * Se dispara cuando Stripe finaliza una factura (lista para cobrar).
   * Notificamos al usuario que tiene una factura pendiente.
   */
  async handleInvoiceFinalized(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;
    
    if (!subscriptionId) {
      this.logger.debug('invoice.finalized sin subscription, ignorando');
      return;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      include: {
        tenant: {
          include: {
            users: {
              where: { role: 'ADMIN' },
              take: 1,
              select: { email: true },
            },
          },
        },
      },
    });

    if (!subscription) {
      this.logger.debug(
        `invoice.finalized: no se encontró Subscription con stripeSubscriptionId=${subscriptionId}`,
      );
      return;
    }

    // Si la factura está pendiente de pago, notificar al usuario
    if (invoice.status === 'open' && invoice.amount_due > 0) {
      const adminEmail = subscription.tenant.users[0]?.email;
      if (adminEmail) {
        try {
          // Enviar email de notificación (asumiendo que MailerService está disponible)
          // Nota: Necesitarías inyectar MailerService en el constructor si no está ya
          this.logger.log(
            `Factura finalizada pendiente de pago: ${invoice.id} para tenant ${subscription.tenantId}. Email de notificación debería enviarse a ${adminEmail}`,
          );
          
          // TODO: Enviar email con link al portal de facturación
          // await this.mailer.sendMail({ ... });
        } catch (err) {
          this.logger.error(
            `Error notificando factura finalizada: ${(err as Error).message}`,
          );
        }
      }
    }

    this.logger.log(
      `Factura finalizada: ${invoice.id} para tenant ${subscription.tenantId}, estado: ${invoice.status}`,
    );
  }

  /**
   * C2.1: Maneja evento invoice.voided de Stripe.
   * 
   * Se dispara cuando una factura es anulada (voided).
   * Limpiamos cualquier estado relacionado con esa factura.
   */
  async handleInvoiceVoided(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;
    
    if (!subscriptionId) {
      this.logger.debug('invoice.voided sin subscription, ignorando');
      return;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!subscription) {
      this.logger.debug(
        `invoice.voided: no se encontró Subscription con stripeSubscriptionId=${subscriptionId}`,
      );
      return;
    }

    // Log para tracking
    this.logger.log(
      `Factura anulada: ${invoice.id} para tenant ${subscription.tenantId}`,
    );

    // Si la suscripción estaba en PENDING_PAYMENT por esta factura y ahora está anulada,
    // podríamos considerar reactivar si hay otra factura activa, pero eso lo maneja invoice.paid
    // Por ahora solo logueamos
  }

  /**
   * C2.1: Job de reconciliación que consulta facturas abiertas en Stripe.
   * Detecta facturas pendientes que no fueron notificadas por webhooks.
   * 
   * Ejecutar diariamente para detectar inconsistencias.
   */
  async reconcileOpenInvoices(): Promise<{
    checked: number;
    openInvoices: number;
    notified: number;
    alertsSent: number;
  }> {
    if (!this.stripe) {
      this.logger.debug('Stripe no configurado, omitiendo reconciliación de facturas');
      return { checked: 0, openInvoices: 0, notified: 0, alertsSent: 0 };
    }

    const alertsEnabled =
      this.config.get<string>('ALERTS_ENABLED') === 'true';
    const daysBeforeAlert = parseInt(
      this.config.get<string>('OPEN_INVOICE_ALERT_DAYS') || '7',
      10,
    );

    // Obtener todas las suscripciones activas con Stripe ID
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        stripeSubscriptionId: { not: null },
        status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            users: {
              where: { role: 'ADMIN' },
              take: 1,
              select: { email: true },
            },
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    let openInvoices = 0;
    let notified = 0;
    let alertsSent = 0;
    const now = new Date();
    const alertThreshold = new Date(now);
    alertThreshold.setDate(alertThreshold.getDate() - daysBeforeAlert);

    for (const sub of subscriptions) {
      if (!sub.stripeSubscriptionId) continue;

      try {
        // Consultar facturas abiertas de esta suscripción en Stripe
        const invoices = await this.stripe.invoices.list({
          subscription: sub.stripeSubscriptionId,
          status: 'open',
          limit: 10,
        });

        for (const invoice of invoices.data) {
          if (invoice.amount_due > 0) {
            openInvoices++;

            // Calcular días desde que se creó la factura
            const invoiceDate = new Date(invoice.created * 1000);
            const daysOpen = Math.floor(
              (now.getTime() - invoiceDate.getTime()) / (24 * 60 * 60 * 1000),
            );

            // Log para tracking
            this.logger.warn(
              `Factura abierta detectada: ${invoice.id} para tenant ${sub.tenantId}, monto: ${invoice.amount_due / 100} ${invoice.currency}, días abierta: ${daysOpen}`,
            );

            // Si la suscripción está ACTIVE pero hay factura abierta, marcar como PENDING_PAYMENT
            if (sub.status === 'ACTIVE') {
              await this.prisma.subscription.update({
                where: { id: sub.id },
                data: {
                  status: 'PENDING_PAYMENT',
                  updatedAt: new Date(),
                },
              });

              this.logger.log(
                `Suscripción ${sub.id} marcada como PENDING_PAYMENT por factura abierta ${invoice.id}`,
              );
              notified++;
            }

            // C3.2: Enviar alerta si factura está abierta >7 días (configurable)
            if (daysOpen >= daysBeforeAlert && alertsEnabled) {
              const tenantName = sub.tenant.name || `Tenant ${sub.tenantId}`;
              const planName = sub.tenant.plan?.name || 'Plan desconocido';
              const amountDue = invoice.amount_due / 100;
              const currency = invoice.currency.toUpperCase();

              // Alerta al admin de plataforma
              await this.alertService.sendAlert({
                title: `⚠️ Factura abierta >${daysBeforeAlert} días - ${tenantName}`,
                message: `El tenant "${tenantName}" (${sub.tenantId}) tiene una factura abierta desde hace ${daysOpen} días. Monto pendiente: ${amountDue} ${currency}. Plan: ${planName}.`,
                severity: daysOpen >= 14 ? 'critical' : 'warning',
                tenantId: sub.tenantId,
                tenantName,
                metadata: {
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.number,
                  amountDue,
                  currency,
                  daysOpen,
                  planName,
                  subscriptionId: sub.id,
                  timestamp: new Date().toISOString(),
                },
              });

              // Email al admin del tenant
              const tenantAdminEmail = sub.tenant.users[0]?.email;
              if (tenantAdminEmail && this.mailer.isConfigured()) {
                try {
                  const frontendUrl =
                    this.config.get<string>('FRONTEND_URL') || '';
                  const billingUrl = `${frontendUrl}/settings/billing`;

                  await this.mailer.sendMail({
                    to: tenantAdminEmail,
                    subject: `⚠️ Factura pendiente de pago - ${tenantName}`,
                    html: `
                      <h2>Factura pendiente de pago</h2>
                      <p>Estimado usuario,</p>
                      <p>Tu empresa <strong>${tenantName}</strong> tiene una factura pendiente de pago desde hace <strong>${daysOpen} días</strong>.</p>
                      <ul>
                        <li><strong>Número de factura:</strong> ${invoice.number || invoice.id}</li>
                        <li><strong>Monto pendiente:</strong> ${amountDue} ${currency}</li>
                        <li><strong>Días abierta:</strong> ${daysOpen} días</li>
                        <li><strong>Plan:</strong> ${planName}</li>
                      </ul>
                      ${daysOpen >= 14 ? '<p><strong>⚠️ IMPORTANTE:</strong> Tu suscripción puede ser suspendida si no completas el pago pronto.</p>' : '<p>Por favor completa el pago para mantener tu suscripción al día.</p>'}
                      <p><a href="${billingUrl}">Completar pago ahora</a></p>
                      <p>Si ya realizaste el pago, ignora este mensaje.</p>
                      <p>— Equipo Orion</p>
                    `,
                  });
                  alertsSent++;
                } catch (emailErr) {
                  this.logger.error(
                    `Error enviando email de factura pendiente a ${tenantAdminEmail}: ${(emailErr as Error).message}`,
                  );
                }
              }

              this.logger.warn(
                `Alerta enviada: Factura ${invoice.id} abierta ${daysOpen} días para tenant ${sub.tenantId}`,
              );
            }
          }
        }
      } catch (err) {
        this.logger.error(
          `Error reconciliando facturas para suscripción ${sub.stripeSubscriptionId}: ${(err as Error).message}`,
        );
      }
    }

    return {
      checked: subscriptions.length,
      openInvoices,
      notified,
      alertsSent,
    };
  }

  /**
   * Activa la suscripción del tenant tras un pago aprobado en Wompi.
   * Ajusta plan, periodo actual y estado ACTIVE.
   */
  async activateSubscriptionFromWompiPayment(
    tenantId: string,
    planId: string,
    billingInterval: 'monthly' | 'yearly',
    wompiTransactionId: string,
  ): Promise<void> {
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingInterval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { tenantId },
        data: {
          planId,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          lastPaymentFailedAt: null,
          updatedAt: now,
        },
      }),
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { planId, billingInterval, updatedAt: now },
      }),
    ]);

    this.logger.log(
      `Suscripción activada por pago Wompi para tenant ${tenantId}, transacción ${wompiTransactionId}, plan ${planId}, hasta ${periodEnd.toISOString()}.`,
    );
  }
}
