import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type BusinessMetrics = {
  // MRR (Monthly Recurring Revenue)
  mrr: {
    current: number;
    previous: number;
    growth: number; // Porcentaje de crecimiento
    byPlan: Array<{
      planId: string;
      planName: string;
      mrr: number;
      customers: number;
    }>;
  };
  // Churn
  churn: {
    rate: number; // Porcentaje mensual
    count: number; // Número de clientes que cancelaron este mes
    revenueLost: number; // MRR perdido por churn
  };
  // LTV (Lifetime Value)
  ltv: {
    average: number;
    byPlan: Array<{
      planId: string;
      planName: string;
      ltv: number;
    }>;
  };
  // CAC (Customer Acquisition Cost) - requiere datos de marketing
  cac: {
    average: number | null; // null si no hay datos de marketing
    note: string;
  };
  // Conversión
  conversion: {
    trialToPaid: number | null; // Porcentaje (null si no hay trials)
    checkoutToPaid: number; // Porcentaje de checkouts que resultan en pago
  };
  // Clientes
  customers: {
    total: number;
    active: number;
    churned: number;
    newThisMonth: number;
  };
  // ARPU (Average Revenue Per User)
  arpu: {
    monthly: number;
  };
};

/**
 * Servicio para calcular métricas de negocio críticas.
 * C3.1: Dashboard de métricas de negocio requerido por comité de inversión.
 */
@Injectable()
export class BusinessMetricsService {
  private readonly logger = new Logger(BusinessMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula todas las métricas de negocio.
   */
  async calculateBusinessMetrics(): Promise<BusinessMetrics> {
    const now = new Date();
    const currentMonthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const previousMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    // Obtener todas las suscripciones activas
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        tenant: {
          select: {
            id: true,
            billingInterval: true,
            plan: {
              select: {
                id: true,
                name: true,
                priceMonthly: true,
                priceYearly: true,
              },
            },
          },
        },
      },
    });

    // Calcular MRR actual
    const mrrCurrent = this.calculateMRR(activeSubscriptions, now);
    const mrrPrevious = await this.calculateMRRPrevious(previousMonthStart);

    // Calcular churn
    const churnData = await this.calculateChurn(
      currentMonthStart,
      previousMonthStart,
    );

    // Calcular LTV
    const ltvData = await this.calculateLTV(activeSubscriptions);

    // Calcular conversión
    const conversionData = await this.calculateConversion(currentMonthStart);

    // Contar clientes
    const customersData = await this.calculateCustomers(currentMonthStart);

    // Calcular ARPU
    const arpu = mrrCurrent > 0 ? mrrCurrent / customersData.active : 0;

    // MRR por plan
    const mrrByPlan = this.calculateMRRByPlan(activeSubscriptions, now);

    return {
      mrr: {
        current: mrrCurrent,
        previous: mrrPrevious,
        growth:
          mrrPrevious > 0
            ? ((mrrCurrent - mrrPrevious) / mrrPrevious) * 100
            : 0,
        byPlan: mrrByPlan,
      },
      churn: churnData,
      ltv: ltvData,
      cac: {
        average: null, // Requiere integración con herramientas de marketing
        note:
          'CAC requiere datos de marketing. Integrar con Google Analytics, Facebook Ads, etc.',
      },
      conversion: conversionData,
      customers: customersData,
      arpu: {
        monthly: arpu,
      },
    };
  }

  /**
   * Calcula MRR basado en suscripciones activas.
   */
  private calculateMRR(
    subscriptions: Array<{
      tenant: {
        billingInterval: string | null;
        plan: {
          priceMonthly: any;
          priceYearly: any;
        } | null;
      };
    }>,
    referenceDate: Date,
  ): number {
    let totalMRR = 0;

    for (const sub of subscriptions) {
      if (!sub.tenant.plan) continue;

      const billingInterval =
        (sub.tenant.billingInterval as 'monthly' | 'yearly' | null) ||
        'monthly';
      const priceMonthly =
        typeof sub.tenant.plan.priceMonthly === 'number'
          ? sub.tenant.plan.priceMonthly
          : sub.tenant.plan.priceMonthly
            ? Number(sub.tenant.plan.priceMonthly)
            : 0;
      const priceYearly =
        typeof sub.tenant.plan.priceYearly === 'number'
          ? sub.tenant.plan.priceYearly
          : sub.tenant.plan.priceYearly
            ? Number(sub.tenant.plan.priceYearly)
            : 0;

      if (billingInterval === 'monthly') {
        totalMRR += priceMonthly;
      } else if (billingInterval === 'yearly') {
        // Convertir precio anual a mensual
        totalMRR += priceYearly / 12;
      }
    }

    return Math.round(totalMRR * 100) / 100; // Redondear a 2 decimales
  }

  /**
   * Calcula MRR del mes anterior (aproximado).
   */
  private async calculateMRRPrevious(monthStart: Date): Promise<number> {
    // Buscar suscripciones que estaban activas al inicio del mes anterior
    const subscriptionsPrevious = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { createdAt: { lte: monthStart } },
          { currentPeriodStart: { lte: monthStart } },
        ],
      },
      include: {
        tenant: {
          include: {
            plan: {
              select: {
                priceMonthly: true,
                priceYearly: true,
              },
            },
          },
        },
      },
    });

    return this.calculateMRR(subscriptionsPrevious, monthStart);
  }

  /**
   * Calcula MRR agrupado por plan.
   */
  private calculateMRRByPlan(
    subscriptions: Array<{
      tenant: {
        billingInterval: string | null;
        plan: {
          id?: string;
          name?: string;
          priceMonthly: any;
          priceYearly: any;
        } | null;
      };
    }>,
    referenceDate: Date,
  ): Array<{ planId: string; planName: string; mrr: number; customers: number }> {
    const byPlan: Record<
      string,
      {
        planId: string;
        planName: string;
        mrr: number;
        customers: number;
      }
    > = {};

    for (const sub of subscriptions) {
      if (!sub.tenant.plan) continue;

      const planId = sub.tenant.plan.id || 'unknown';
      const planName = sub.tenant.plan.name || 'Plan desconocido';
      if (!byPlan[planId]) {
        byPlan[planId] = {
          planId,
          planName,
          mrr: 0,
          customers: 0,
        };
      }

      byPlan[planId].customers += 1;

      const billingInterval =
        (sub.tenant.billingInterval as 'monthly' | 'yearly' | null) ||
        'monthly';
      const priceMonthly =
        typeof sub.tenant.plan.priceMonthly === 'number'
          ? sub.tenant.plan.priceMonthly
          : sub.tenant.plan.priceMonthly
            ? Number(sub.tenant.plan.priceMonthly)
            : 0;
      const priceYearly =
        typeof sub.tenant.plan.priceYearly === 'number'
          ? sub.tenant.plan.priceYearly
          : sub.tenant.plan.priceYearly
            ? Number(sub.tenant.plan.priceYearly)
            : 0;

      if (billingInterval === 'monthly') {
        byPlan[planId].mrr += priceMonthly;
      } else if (billingInterval === 'yearly') {
        byPlan[planId].mrr += priceYearly / 12;
      }
    }

    return Object.values(byPlan).map((plan) => ({
      ...plan,
      mrr: Math.round(plan.mrr * 100) / 100,
    }));
  }

  /**
   * Calcula churn rate del mes actual.
   */
  private async calculateChurn(
    currentMonthStart: Date,
    previousMonthStart: Date,
  ): Promise<{
    rate: number;
    count: number;
    revenueLost: number;
  }> {
    // Suscripciones canceladas este mes
    const churnedSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'CANCELLED',
        updatedAt: {
          gte: currentMonthStart,
        },
      },
      include: {
        tenant: {
          include: {
            plan: {
              select: {
                priceMonthly: true,
                priceYearly: true,
              },
            },
          },
        },
      },
    });

    // Contar suscripciones activas al inicio del mes
    const activeAtMonthStart = await this.prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        OR: [
          { createdAt: { lte: currentMonthStart } },
          { currentPeriodStart: { lte: currentMonthStart } },
        ],
      },
    });

    const churnCount = churnedSubscriptions.length;
    const churnRate =
      activeAtMonthStart > 0 ? (churnCount / activeAtMonthStart) * 100 : 0;

    // Calcular MRR perdido por churn
    let revenueLost = 0;
    for (const sub of churnedSubscriptions) {
      if (!sub.tenant.plan) continue;

      const billingInterval =
        (sub.tenant.billingInterval as 'monthly' | 'yearly' | null) ||
        'monthly';
      const priceMonthly =
        typeof sub.tenant.plan.priceMonthly === 'number'
          ? sub.tenant.plan.priceMonthly
          : sub.tenant.plan.priceMonthly
            ? Number(sub.tenant.plan.priceMonthly)
            : 0;
      const priceYearly =
        typeof sub.tenant.plan.priceYearly === 'number'
          ? sub.tenant.plan.priceYearly
          : sub.tenant.plan.priceYearly
            ? Number(sub.tenant.plan.priceYearly)
            : 0;

      if (billingInterval === 'monthly') {
        revenueLost += priceMonthly;
      } else if (billingInterval === 'yearly') {
        revenueLost += priceYearly / 12;
      }
    }

    return {
      rate: Math.round(churnRate * 100) / 100,
      count: churnCount,
      revenueLost: Math.round(revenueLost * 100) / 100,
    };
  }

  /**
   * Calcula LTV (Lifetime Value) promedio.
   */
  private async calculateLTV(
    activeSubscriptions: Array<{
      tenant: {
        billingInterval: string | null;
        plan: {
          priceMonthly: any;
          priceYearly: any;
        } | null;
      };
    }>,
  ): Promise<{
    average: number;
    byPlan: Array<{ planId: string; planName: string; ltv: number }>;
  }> {
    // LTV = ARPU / Churn Rate
    // Si churn es 0, usar estimación conservadora (churn mínimo del 1%)
    const churnData = await this.calculateChurn(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
    );

    const churnRate = Math.max(churnData.rate, 1); // Mínimo 1% para evitar división por 0

    // Calcular ARPU promedio
    let totalMRR = 0;
    let totalCustomers = 0;

    for (const sub of activeSubscriptions) {
      if (!sub.tenant.plan) continue;
      totalCustomers += 1;

      const billingInterval =
        (sub.tenant.billingInterval as 'monthly' | 'yearly' | null) ||
        'monthly';
      const priceMonthly =
        typeof sub.tenant.plan.priceMonthly === 'number'
          ? sub.tenant.plan.priceMonthly
          : sub.tenant.plan.priceMonthly
            ? Number(sub.tenant.plan.priceMonthly)
            : 0;
      const priceYearly =
        typeof sub.tenant.plan.priceYearly === 'number'
          ? sub.tenant.plan.priceYearly
          : sub.tenant.plan.priceYearly
            ? Number(sub.tenant.plan.priceYearly)
            : 0;

      if (billingInterval === 'monthly') {
        totalMRR += priceMonthly;
      } else if (billingInterval === 'yearly') {
        totalMRR += priceYearly / 12;
      }
    }

    const arpu = totalCustomers > 0 ? totalMRR / totalCustomers : 0;
    const ltvAverage = arpu / (churnRate / 100);

    // LTV por plan - hacer consulta separada con plan completo
    const ltvByPlan: Array<{ planId: string; planName: string; ltv: number }> =
      [];
    
    const subscriptionsWithPlan = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        tenant: {
          select: {
            billingInterval: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            priceMonthly: true,
            priceYearly: true,
          },
        },
      },
    });

    // Agrupar por plan para calcular LTV
    const planGroups: Record<
      string,
      { planId: string; planName: string; totalMRR: number; customers: number }
    > = {};

    for (const sub of subscriptionsWithPlan) {
      if (!sub.plan) continue;
      const planId = sub.plan.id;
      const planName = sub.plan.name;

      if (!planGroups[planId]) {
        planGroups[planId] = {
          planId,
          planName,
          totalMRR: 0,
          customers: 0,
        };
      }

      planGroups[planId].customers += 1;

      const billingInterval =
        (sub.tenant.billingInterval as 'monthly' | 'yearly' | null) ||
        'monthly';
      const priceMonthly =
        typeof sub.plan.priceMonthly === 'number'
          ? sub.plan.priceMonthly
          : sub.plan.priceMonthly
            ? Number(sub.plan.priceMonthly)
            : 0;
      const priceYearly =
        typeof sub.plan.priceYearly === 'number'
          ? sub.plan.priceYearly
          : sub.plan.priceYearly
            ? Number(sub.plan.priceYearly)
            : 0;

      if (billingInterval === 'monthly') {
        planGroups[planId].totalMRR += priceMonthly;
      } else if (billingInterval === 'yearly') {
        planGroups[planId].totalMRR += priceYearly / 12;
      }
    }

    for (const plan of Object.values(planGroups)) {
      const planARPU = plan.customers > 0 ? plan.totalMRR / plan.customers : 0;
      const planLTV = planARPU / (churnRate / 100);
      ltvByPlan.push({
        planId: plan.planId,
        planName: plan.planName,
        ltv: Math.round(planLTV * 100) / 100,
      });
    }

    return {
      average: Math.round(ltvAverage * 100) / 100,
      byPlan: ltvByPlan,
    };
  }

  /**
   * Calcula métricas de conversión.
   */
  private async calculateConversion(monthStart: Date): Promise<{
    trialToPaid: number | null;
    checkoutToPaid: number;
  }> {
    // Contar checkouts completados este mes
    const checkoutSessions = await this.prisma.stripeEvent.count({
      where: {
        type: 'checkout.session.completed',
        processedAt: {
          gte: monthStart,
        },
      },
    });

    // Contar suscripciones activas creadas este mes
    const paidSubscriptions = await this.prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        createdAt: {
          gte: monthStart,
        },
      },
    });

    const checkoutToPaid =
      checkoutSessions > 0 ? (paidSubscriptions / checkoutSessions) * 100 : 0;

    // Trial to paid: no implementado aún (requiere sistema de trials)
    return {
      trialToPaid: null,
      checkoutToPaid: Math.round(checkoutToPaid * 100) / 100,
    };
  }

  /**
   * Calcula métricas de clientes.
   */
  private async calculateCustomers(monthStart: Date): Promise<{
    total: number;
    active: number;
    churned: number;
    newThisMonth: number;
  }> {
    const [total, active, churned, newThisMonth] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({
        where: {
          isActive: true,
          OR: [
            { subscription: { is: null } },
            { subscription: { status: 'ACTIVE' } },
          ],
        },
      }),
      this.prisma.tenant.count({
        where: {
          isActive: false,
        },
      }),
      this.prisma.tenant.count({
        where: {
          createdAt: {
            gte: monthStart,
          },
        },
      }),
    ]);

    return {
      total,
      active,
      churned,
      newThisMonth,
    };
  }
}
