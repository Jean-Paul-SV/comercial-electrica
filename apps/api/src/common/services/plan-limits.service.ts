import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servicio para validar límites de plan (maxUsers, módulos, etc.)
 */
@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el límite de usuarios del plan del tenant.
   * Retorna null si no hay límite (plan sin maxUsers o tenant sin plan).
   */
  async getMaxUsersForTenant(tenantId: string | null): Promise<number | null> {
    if (!tenantId) return null;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        planId: true,
        plan: {
          select: {
            maxUsers: true,
          },
        },
      },
    });

    if (!tenant?.plan) return null;
    return tenant.plan.maxUsers;
  }

  /**
   * Obtiene el número actual de usuarios activos del tenant.
   */
  async getCurrentUserCount(tenantId: string | null): Promise<number> {
    if (!tenantId) return 0;

    return this.prisma.user.count({
      where: {
        tenantId,
        isActive: true,
      },
    });
  }

  /**
   * Valida que el tenant no haya excedido el límite de usuarios de su plan.
   * Lanza BadRequestException si el límite se excedería al agregar un usuario.
   */
  async validateUserLimit(tenantId: string | null): Promise<void> {
    if (!tenantId) {
      // Admins de plataforma no tienen límite
      return;
    }

    const maxUsers = await this.getMaxUsersForTenant(tenantId);
    if (maxUsers === null) {
      // Sin límite, permitir
      return;
    }

    const currentCount = await this.getCurrentUserCount(tenantId);
    if (currentCount >= maxUsers) {
      throw new BadRequestException(
        `Se ha alcanzado el límite de usuarios permitidos para este plan (${maxUsers} usuarios). Contacte a soporte para actualizar su plan.`,
      );
    }
  }

  /**
   * Obtiene información de límites del tenant para mostrar en UI.
   */
  async getTenantLimits(tenantId: string | null): Promise<{
    maxUsers: number | null;
    currentUsers: number;
    canAddUsers: boolean;
  }> {
    const maxUsers = await this.getMaxUsersForTenant(tenantId);
    const currentUsers = await this.getCurrentUserCount(tenantId);

    return {
      maxUsers,
      currentUsers,
      canAddUsers: maxUsers === null || currentUsers < maxUsers,
    };
  }

  /**
   * Obtiene el slug del plan del tenant.
   * Retorna null si el tenant no tiene plan.
   */
  async getPlanSlugForTenant(tenantId: string | null): Promise<string | null> {
    if (!tenantId) return null;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: {
          select: {
            slug: true,
          },
        },
      },
    });

    return tenant?.plan?.slug ?? null;
  }

  /**
   * Obtiene el límite de requests por minuto según el plan del tenant.
   * Límites por defecto:
   * - Sin plan o plan desconocido: 100 req/min
   * - Plan básico (slug contiene "basico" o "basic"): 100 req/min
   * - Plan pro (slug contiene "pro"): 1000 req/min
   * - Plan enterprise (slug contiene "enterprise"): 5000 req/min
   *
   * Estos límites se pueden sobrescribir con variables de entorno:
   * - THROTTLE_LIMIT_BASIC (default: 100)
   * - THROTTLE_LIMIT_PRO (default: 1000)
   * - THROTTLE_LIMIT_ENTERPRISE (default: 5000)
   * - THROTTLE_LIMIT_DEFAULT (default: 100)
   */
  async getRateLimitForTenant(tenantId: string | null): Promise<number> {
    const planSlug = await this.getPlanSlugForTenant(tenantId);

    if (!planSlug) {
      // Sin plan: límite por defecto
      return parseInt(process.env.THROTTLE_LIMIT_DEFAULT || '100', 10);
    }

    const slugLower = planSlug.toLowerCase();

    // Determinar límite según el slug del plan
    if (slugLower.includes('enterprise')) {
      return parseInt(process.env.THROTTLE_LIMIT_ENTERPRISE || '5000', 10);
    }
    if (slugLower.includes('pro')) {
      return parseInt(process.env.THROTTLE_LIMIT_PRO || '1000', 10);
    }
    if (slugLower.includes('basico') || slugLower.includes('basic')) {
      return parseInt(process.env.THROTTLE_LIMIT_BASIC || '100', 10);
    }

    // Plan desconocido: límite por defecto
    return parseInt(process.env.THROTTLE_LIMIT_DEFAULT || '100', 10);
  }
}
