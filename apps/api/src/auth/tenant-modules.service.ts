import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Catálogo de módulos del producto (alineado con ARQUITECTURA_MODULAR_SAAS). */
export const MODULE_CODES = [
  'core',
  'inventory',
  'suppliers',
  'electronic_invoicing',
  'advanced_reports',
  'audit',
  'backups',
  'ai', // Resumen del dashboard en lenguaje natural (IA). Solo planes Premium y Enterprise.
] as const;

export type ModuleCode = (typeof MODULE_CODES)[number];

@Injectable()
export class TenantModulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el id del tenant con slug 'default'. Usado para usuarios sin tenant (legacy) y para backfill.
   */
  async getDefaultTenantId(): Promise<string | null> {
    const t = await this.prisma.tenant.findFirst({
      where: { slug: 'default' },
      select: { id: true },
    });
    return t?.id ?? null;
  }

  /**
   * Tenant efectivo para un usuario: su tenantId, el default (slug 'default') o el primer tenant si no hay default.
   */
  async getEffectiveTenantId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });
    if (user?.tenantId) return user.tenantId;
    const defaultId = await this.getDefaultTenantId();
    if (defaultId) return defaultId;
    // Fallback: primer tenant (p. ej. si el seed usó otro slug)
    const first = await this.prisma.tenant.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return first?.id ?? null;
  }

  /**
   * Obtiene los módulos habilitados para un tenant.
   * 1) Si la suscripción está PENDING_PAYMENT, no hay acceso al plan: se devuelve [].
   * 2) Módulos del plan + add-ons activos.
   * 3) Aplicar overrides TenantModule (enabled true/false).
   * Si tenantId es null (single-tenant legacy), devuelve todos los módulos.
   */
  async getEnabledModules(tenantId: string | null): Promise<string[]> {
    if (!tenantId) {
      return [...MODULE_CODES];
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: { include: { features: { select: { moduleCode: true } } } },
        subscription: { select: { status: true } },
        modules: { select: { moduleCode: true, enabled: true } },
        addOns: {
          where: {
            OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
          },
          include: { addOn: { select: { moduleCode: true } } },
        },
      },
    });

    if (!tenant) return [];

    // Hasta que no se efectúe el pago, no hay acceso al plan
    if (tenant.subscription && String(tenant.subscription.status) === 'PENDING_PAYMENT') {
      return [];
    }

    const fromPlan = tenant.plan?.features.map((f) => f.moduleCode) ?? [];
    const fromAddOns = tenant.addOns.map((a) => a.addOn.moduleCode);
    const withOverrides = new Map<string, boolean>(
      tenant.modules.map((m) => [m.moduleCode, m.enabled]),
    );

    const baseSet = new Set([...fromPlan, ...fromAddOns]);
    const result: string[] = [];

    for (const code of baseSet) {
      const override = withOverrides.get(code);
      if (override === false) continue;
      result.push(code);
    }
    for (const { moduleCode, enabled } of tenant.modules) {
      if (enabled && !baseSet.has(moduleCode)) result.push(moduleCode);
    }

    return [...new Set(result)];
  }
}
