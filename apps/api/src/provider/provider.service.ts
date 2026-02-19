import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { RoleName, DianEnvironment } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { Prisma } from '@prisma/client';
import { emailIsPlatformAdminOnly } from '../common/utils/platform-admin-emails';

const DEFAULT_MODULE_CODES = [
  'core',
  'inventory',
  'suppliers',
  'electronic_invoicing',
  'advanced_reports',
  'audit',
  'backups',
  'ai',
] as const;

type PlanDecimalFields = Pick<
  import('@prisma/client').Plan,
  'priceMonthly' | 'priceYearly'
>;

/** Módulo que habilita facturación electrónica DIAN en un plan. */
const DIAN_MODULE_CODE = 'electronic_invoicing';

type PlanDto = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  maxUsers: number | null;
  stripePriceId: string | null;
  stripePriceIdYearly: string | null;
  isActive: boolean;
  /** Si el plan incluye facturación electrónica DIAN (módulo electronic_invoicing). */
  includesDian: boolean;
};

@Injectable()
export class ProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  /**
   * Métricas agregadas para el panel proveedor.
   * No devuelve datos personales; solo conteos por tenant / plan / módulo.
   */
  async getTenantsSummary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      activeTenantsForMrr,
      salesCurrentMonthAgg,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      // Solo cuentan como activas las que están activas Y con suscripción al día (ACTIVE)
      this.prisma.tenant.count({
        where: {
          isActive: true,
          OR: [
            { subscription: { is: null } },
            { subscription: { status: 'ACTIVE' } },
          ],
        },
      }),
      // Suspendidas = desactivadas manualmente O con pago pendiente / cancelada
      this.prisma.tenant.count({
        where: {
          OR: [
            { isActive: false },
            { subscription: { status: { not: 'ACTIVE' } } },
          ],
        },
      }),
      this.prisma.user.count({
        where: { tenantId: { not: null } },
      }),
      // Tenants activos para estimar MRR aproximado (según precio de plan e intervalo)
      this.prisma.tenant.findMany({
        where: {
          isActive: true,
          OR: [
            { subscription: { is: null } },
            { subscription: { status: 'ACTIVE' } },
          ],
        },
        select: {
          billingInterval: true,
          plan: {
            select: {
              priceMonthly: true,
              priceYearly: true,
            },
          },
        },
      }),
      // Ventas del mes (todas las empresas) considerando solo ventas pagadas
      this.prisma.sale.aggregate({
        _sum: { grandTotal: true },
        where: {
          status: 'PAID',
          soldAt: { gte: monthStart, lt: nextMonthStart },
        },
      }),
    ]);

    const totalMrrApprox = activeTenantsForMrr.reduce((acc, tenant) => {
      const plan = tenant.plan;
      if (!plan) return acc;
      const priceMonthly =
        plan.priceMonthly != null ? Number(plan.priceMonthly) : null;
      const priceYearly =
        plan.priceYearly != null ? Number(plan.priceYearly) : null;
      const interval = tenant.billingInterval;

      let effectiveMonthly = 0;
      if (interval === 'yearly' && priceYearly != null) {
        effectiveMonthly = priceYearly / 12;
      } else if (priceMonthly != null) {
        effectiveMonthly = priceMonthly;
      } else if (priceYearly != null) {
        effectiveMonthly = priceYearly / 12;
      }
      return acc + effectiveMonthly;
    }, 0);

    const totalSalesCurrentMonth =
      salesCurrentMonthAgg._sum.grandTotal != null
        ? Number(salesCurrentMonthAgg._sum.grandTotal)
        : 0;

    const plans = await this.prisma.plan.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { tenants: true } },
      },
      orderBy: { name: 'asc' },
    });

    const modules = await this.prisma.tenantModule.groupBy({
      by: ['moduleCode'],
      _count: { _all: true },
    });

    return {
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalMrrApprox,
      totalSalesCurrentMonth,
      plansUsage: plans.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        tenantsCount: p._count.tenants,
      })),
      modulesUsage: modules.map((m) => ({
        moduleCode: m.moduleCode,
        tenantsCount: m._count._all,
      })),
    };
  }

  async listPlans(activeOnly?: boolean) {
    const plans = await this.prisma.plan.findMany({
      where: activeOnly === true ? { isActive: true } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        priceMonthly: true,
        priceYearly: true,
        maxUsers: true,
        stripePriceId: true,
        stripePriceIdYearly: true,
        isActive: true,
        features: { select: { moduleCode: true } },
      },
      orderBy: { name: 'asc' },
    });
    return plans.map((plan) => this.mapPlanToDto(plan));
  }

  async createPlan(dto: CreatePlanDto) {
    const existing = await this.prisma.plan.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un plan con el slug "${dto.slug}".`,
      );
    }
    const includesDian = dto.includesDian !== false;
    const moduleCodes = includesDian
      ? [...DEFAULT_MODULE_CODES]
      : DEFAULT_MODULE_CODES.filter((c) => c !== DIAN_MODULE_CODE);
    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        priceMonthly:
          dto.priceMonthly != null
            ? new Prisma.Decimal(dto.priceMonthly)
            : null,
        priceYearly:
          dto.priceYearly != null ? new Prisma.Decimal(dto.priceYearly) : null,
        maxUsers: dto.maxUsers ?? null,
        stripePriceId: dto.stripePriceId ?? null,
        stripePriceIdYearly: dto.stripePriceIdYearly ?? null,
        isActive: dto.isActive ?? true,
        features: {
          create: moduleCodes.map((moduleCode) => ({ moduleCode })),
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        priceMonthly: true,
        priceYearly: true,
        maxUsers: true,
        stripePriceId: true,
        stripePriceIdYearly: true,
        isActive: true,
        features: { select: { moduleCode: true } },
      },
    });
    return this.mapPlanToDto(plan);
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    const data = this.buildPlanUpdateData(dto);

    await this.prisma.plan.update({
      where: { id },
      data,
    });
    const updated = await this.prisma.plan.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        priceMonthly: true,
        priceYearly: true,
        maxUsers: true,
        stripePriceId: true,
        stripePriceIdYearly: true,
        isActive: true,
        features: { select: { moduleCode: true } },
      },
    });
    return this.mapPlanToDto(updated!);
  }

  async listTenants(query: ListTenantsQueryDto) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const isActiveFilter =
      query.isActive === undefined ? undefined : query.isActive === 'true';
    const searchName = query.searchName?.trim();
    const searchNumber = query.searchNumber?.trim();

    const andParts: Prisma.TenantWhereInput[] = [];
    if (isActiveFilter !== undefined) {
      if (isActiveFilter) {
        andParts.push({
          isActive: true,
          OR: [
            { subscription: { is: null } },
            { subscription: { status: 'ACTIVE' } },
          ],
        });
      } else {
        andParts.push({
          OR: [
            { isActive: false },
            { subscription: { status: { not: 'ACTIVE' } } },
          ],
        });
      }
    }
    if (searchName && searchName.length > 0) {
      andParts.push({ name: { contains: searchName, mode: 'insensitive' } });
    }
    if (searchNumber && searchNumber.length > 0) {
      andParts.push({
        OR: [
          { slug: { contains: searchNumber, mode: 'insensitive' } },
          { id: searchNumber },
        ],
      });
    }
    const where: Prisma.TenantWhereInput =
      andParts.length > 0 ? { AND: andParts } : {};

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where: Object.keys(where).length > 0 ? where : {},
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          billingInterval: true,
          lastActivityAt: true,
          createdAt: true,
          plan: { select: { id: true, name: true, slug: true } },
          subscription: {
            select: {
              id: true,
              status: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
            },
          },
          _count: {
            select: { users: true, products: true, sales: true, customers: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.tenant.count({
        where: Object.keys(where).length > 0 ? where : {},
      }),
    ]);

    const items = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      isActive: tenant.isActive,
      billingInterval: tenant.billingInterval ?? null,
      lastActivityAt: tenant.lastActivityAt?.toISOString() ?? null,
      createdAt: tenant.createdAt.toISOString(),
      plan: tenant.plan,
      subscription: tenant.subscription,
      usersCount: tenant._count.users,
      productsCount: tenant._count.products,
      salesCount: tenant._count.sales,
      customersCount: tenant._count.customers,
    }));

    return { items, total, limit, offset };
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        billingInterval: true,
        contactPhone: true,
        lastActivityAt: true,
        createdAt: true,
        updatedAt: true,
        plan: { select: { id: true, name: true, slug: true } },
        subscription: {
          select: {
            id: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
        _count: {
          select: {
            users: true,
            products: true,
            sales: true,
            customers: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado.');
    return {
      ...tenant,
      lastActivityAt: tenant.lastActivityAt?.toISOString() ?? null,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
      subscription: tenant.subscription
        ? {
            ...tenant.subscription,
            currentPeriodStart:
              tenant.subscription.currentPeriodStart?.toISOString() ?? null,
            currentPeriodEnd:
              tenant.subscription.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
    };
  }

  async updateTenantStatus(id: string, dto: UpdateTenantStatusDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado.');
    await this.prisma.tenant.update({
      where: { id },
      data: { isActive: dto.isActive },
    });
    return { success: true, isActive: dto.isActive };
  }

  async deleteTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado.');

    await this.prisma.$transaction(async (tx) => {
      // Evitar que usuarios queden activos sin empresa
      await tx.user.updateMany({
        where: { tenantId: id },
        data: { isActive: false, tenantId: null },
      });
      await tx.tenant.delete({ where: { id } });
    });

    return { success: true };
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, subscription: { select: { id: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado.');
    const planId = dto.planId ?? undefined;
    const updateData: { planId?: string; billingInterval?: string | null } = {};
    if (dto.planId !== undefined) updateData.planId = dto.planId;
    if (dto.billingInterval !== undefined) updateData.billingInterval = dto.billingInterval;
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.tenant.update({
          where: { id },
          data: updateData,
        });
      }
      if (tenant.subscription && dto.planId !== undefined) {
        await tx.subscription.update({
          where: { tenantId: id },
          data: { planId },
        });
      } else if (!tenant.subscription && dto.planId !== undefined) {
        const { now, periodEnd } = this.calculateDefaultSubscriptionPeriod();
        await tx.subscription.create({
          data: {
            tenantId: id,
            planId,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }
    });
    return { success: true, planId: planId ?? null };
  }

  async renewSubscription(tenantId: string, dto: RenewSubscriptionDto) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      select: { id: true, currentPeriodEnd: true },
    });
    if (!sub) throw new NotFoundException('Tenant sin suscripción.');
    const extendDays = dto.extendDays ?? 30;
    const from =
      sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
        ? sub.currentPeriodEnd
        : new Date();
    const newEnd = new Date(from);
    newEnd.setDate(newEnd.getDate() + extendDays);
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        currentPeriodStart: from,
        currentPeriodEnd: newEnd,
      },
    });
    return {
      success: true,
      currentPeriodEnd: newEnd.toISOString(),
    };
  }

  async createTenant(dto: CreateTenantDto) {
    const slug = dto.slug.toLowerCase().trim();
    const adminEmail = dto.adminEmail.toLowerCase().trim();

    if (emailIsPlatformAdminOnly(adminEmail)) {
      throw new BadRequestException(
        'Este correo está reservado para el Panel proveedor y no puede asociarse a una empresa.',
      );
    }

    const [existingSlug, existingEmail] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { slug } }),
      this.prisma.user.findUnique({ where: { email: adminEmail } }),
    ]);
    if (existingSlug) {
      throw new ConflictException(`Ya existe un tenant con el slug "${slug}".`);
    }
    if (existingEmail) {
      throw new ConflictException(
        `El correo ${adminEmail} ya está registrado en la plataforma.`,
      );
    }

    const generateTempPassword = !dto.adminPassword;
    const adminPassword: string = generateTempPassword
      ? randomBytes(16).toString('hex')
      : (dto.adminPassword ?? '');

    const passwordHash = await argon2.hash(adminPassword);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          slug,
          planId: dto.planId ?? undefined,
          billingInterval: dto.billingInterval ?? null,
          contactPhone: dto.contactPhone?.trim() || null,
        },
      });
      const { now, periodEnd } = this.calculateDefaultSubscriptionPeriod();
      await tx.subscription.create({
        data: {
          tenantId: createdTenant.id,
          planId: dto.planId ?? undefined,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      await tx.user.create({
        data: {
          email: adminEmail,
          name: dto.adminName?.trim() || undefined,
          passwordHash,
          role: RoleName.ADMIN,
          tenantId: createdTenant.id,
          mustChangePassword: generateTempPassword,
        },
      });

      // Crear configuración DIAN inicial si se proporciona el nombre de la empresa
      if (dto.issuerName?.trim()) {
        await tx.dianConfig.create({
          data: {
            tenantId: createdTenant.id,
            env: DianEnvironment.HABILITACION,
            issuerName: dto.issuerName.trim(),
          },
        });
      }

      return createdTenant;
    });

    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: dto.planId },
        select: { stripePriceId: true, stripePriceIdYearly: true },
      });
      const useYearly =
        dto.billingInterval === 'yearly' && plan?.stripePriceIdYearly;
      const priceId = useYearly
        ? plan!.stripePriceIdYearly!
        : plan?.stripePriceId ?? null;
      if (priceId) {
        const stripeSubscriptionId =
          await this.billing.createStripeSubscription(
            tenant.id,
            priceId,
            adminEmail,
            dto.name?.trim() ?? tenant.name,
          );
        if (stripeSubscriptionId) {
          await this.prisma.subscription.update({
            where: { tenantId: tenant.id },
            data: {
              stripeSubscriptionId,
              status: 'PENDING_PAYMENT', // Bloqueado hasta que el cliente pague en Stripe
            },
          });
        }
      }
    }

    const isDev = process.env.NODE_ENV !== 'production';
    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      ...(isDev && generateTempPassword
        ? { tempAdminPassword: adminPassword }
        : {}),
    };
  }

  private mapPlanToDto(
    plan: Pick<PlanDecimalFields, keyof PlanDecimalFields> & {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      maxUsers: number | null;
      stripePriceId: string | null;
      stripePriceIdYearly?: string | null;
      isActive: boolean;
      features?: { moduleCode: string }[];
    },
  ): PlanDto {
    const features = plan.features ?? [];
    const includesDian = features.some(
      (f) => f.moduleCode === DIAN_MODULE_CODE,
    );
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description ?? null,
      priceMonthly:
        plan.priceMonthly != null ? Number(plan.priceMonthly) : null,
      priceYearly: plan.priceYearly != null ? Number(plan.priceYearly) : null,
      maxUsers: plan.maxUsers,
      stripePriceId: plan.stripePriceId ?? null,
      stripePriceIdYearly: plan.stripePriceIdYearly ?? null,
      isActive: plan.isActive,
      includesDian,
    };
  }

  private buildPlanUpdateData(dto: UpdatePlanDto) {
    const data: {
      name?: string;
      description?: string;
      priceMonthly?: number;
      priceYearly?: number;
      maxUsers?: number | null;
      stripePriceId?: string | null;
      stripePriceIdYearly?: string | null;
      isActive?: boolean;
    } = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priceMonthly !== undefined) data.priceMonthly = dto.priceMonthly;
    if (dto.priceYearly !== undefined) data.priceYearly = dto.priceYearly;
    if (dto.maxUsers !== undefined) data.maxUsers = dto.maxUsers;
    if (dto.stripePriceId !== undefined) {
      data.stripePriceId = dto.stripePriceId || null;
    }
    if (dto.stripePriceIdYearly !== undefined) {
      data.stripePriceIdYearly = dto.stripePriceIdYearly || null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return data;
  }

  private calculateDefaultSubscriptionPeriod() {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);
    return { now, periodEnd };
  }

  /**
   * Lista las solicitudes de activación DIAN pendientes (empresas que cambiaron a plan con DIAN pero aún no han activado).
   */
  async listDianActivationRequests() {
    const configs = await this.prisma.dianConfig.findMany({
      where: {
        activationStatus: 'PENDING',
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return configs.map((config) => ({
      id: config.id,
      tenantId: config.tenantId,
      tenantName: config.tenant.name,
      tenantSlug: config.tenant.slug,
      planName: config.tenant.plan?.name ?? 'Sin plan',
      planSlug: config.tenant.plan?.slug ?? null,
      requestedAt: config.createdAt,
    }));
  }

  /**
   * Marca la activación DIAN como completada (después de que el admin cobró y configuró el servicio).
   */
  async markDianActivationAsCompleted(tenantId: string) {
    const config = await this.prisma.dianConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      throw new NotFoundException(
        'Configuración DIAN no encontrada para esta empresa.',
      );
    }

    if (config.activationStatus === 'ACTIVATED') {
      throw new BadRequestException(
        'La activación DIAN ya está marcada como completada.',
      );
    }

    await this.prisma.dianConfig.update({
      where: { tenantId },
      data: { activationStatus: 'ACTIVATED' },
    });

    return { success: true };
  }
}
