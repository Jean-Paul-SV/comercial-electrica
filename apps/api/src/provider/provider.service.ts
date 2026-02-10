import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { RoleName } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class ProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

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
        stripePriceId: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description ?? null,
      priceMonthly: p.priceMonthly != null ? Number(p.priceMonthly) : null,
      priceYearly: p.priceYearly != null ? Number(p.priceYearly) : null,
      stripePriceId: p.stripePriceId ?? null,
      isActive: p.isActive,
    }));
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado.');
    }
    const data: {
      name?: string;
      description?: string;
      priceMonthly?: number;
      priceYearly?: number;
      stripePriceId?: string | null;
      isActive?: boolean;
    } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priceMonthly !== undefined) data.priceMonthly = dto.priceMonthly;
    if (dto.priceYearly !== undefined) data.priceYearly = dto.priceYearly;
    if (dto.stripePriceId !== undefined) data.stripePriceId = dto.stripePriceId || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.plan.update({
      where: { id },
      data,
    });
    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description ?? null,
      priceMonthly: updated.priceMonthly != null ? Number(updated.priceMonthly) : null,
      priceYearly: updated.priceYearly != null ? Number(updated.priceYearly) : null,
      stripePriceId: updated.stripePriceId ?? null,
      isActive: updated.isActive,
    };
  }

  async listTenants(query: ListTenantsQueryDto) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const isActiveFilter =
      query.isActive === undefined
        ? undefined
        : query.isActive === 'true';

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where: isActiveFilter !== undefined ? { isActive: isActiveFilter } : {},
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
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
            select: { users: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.tenant.count({
        where: isActiveFilter !== undefined ? { isActive: isActiveFilter } : {},
      }),
    ]);

    const items = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      isActive: t.isActive,
      lastActivityAt: t.lastActivityAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      plan: t.plan,
      subscription: t.subscription,
      usersCount: t._count.users,
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

  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, subscription: { select: { id: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado.');
    const planId = dto.planId ?? undefined;
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id },
        data: { planId },
      });
      if (tenant.subscription) {
        await tx.subscription.update({
          where: { tenantId: id },
          data: { planId },
        });
      } else {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30);
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
    const from = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()
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

    const [existingSlug, existingEmail] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { slug } }),
      this.prisma.user.findUnique({ where: { email: adminEmail } }),
    ]);
    if (existingSlug) {
      throw new ConflictException(
        `Ya existe un tenant con el slug "${slug}".`,
      );
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
      const t = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          slug,
          planId: dto.planId ?? undefined,
        },
      });
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);
      await tx.subscription.create({
        data: {
          tenantId: t.id,
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
          tenantId: t.id,
          mustChangePassword: generateTempPassword,
        },
      });
      return t;
    });

    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: dto.planId },
        select: { stripePriceId: true },
      });
      if (plan?.stripePriceId) {
        const stripeSubscriptionId = await this.billing.createStripeSubscription(
          tenant.id,
          plan.stripePriceId,
          adminEmail,
          dto.name?.trim() ?? tenant.name,
        );
        if (stripeSubscriptionId) {
          await this.prisma.subscription.update({
            where: { tenantId: tenant.id },
            data: { stripeSubscriptionId },
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
}
