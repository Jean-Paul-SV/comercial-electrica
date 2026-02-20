import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanLimitsService } from './plan-limits.service';
import { AlertService } from './alert.service';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../mailer/mailer.service';

export type TenantLimitViolation = {
  tenantId: string;
  tenantName: string;
  planId: string | null;
  planName: string | null;
  maxUsers: number | null;
  currentUsers: number;
  exceededBy: number;
  daysExceeded?: number;
};

/**
 * C2.2: Servicio que monitorea y valida límites de plan continuamente.
 * Detecta tenants que exceden límites y envía alertas.
 */
@Injectable()
export class PlanLimitsMonitorService {
  private readonly logger = new Logger(PlanLimitsMonitorService.name);
  private readonly alertAfterDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
    private readonly alertService: AlertService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {
    // Días después de exceder límite antes de bloquear (default: 7 días)
    this.alertAfterDays = parseInt(
      this.config.get<string>('PLAN_LIMITS_ALERT_AFTER_DAYS') || '7',
      10,
    );
  }

  /**
   * Detecta todos los tenants que exceden límites de su plan.
   * Retorna lista de violaciones con información detallada.
   */
  async detectLimitViolations(): Promise<TenantLimitViolation[]> {
    const tenants = await this.prisma.tenant.findMany({
      where: {
        isActive: true,
        planId: { not: null },
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            maxUsers: true,
          },
        },
        users: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    const violations: TenantLimitViolation[] = [];

    for (const tenant of tenants) {
      if (!tenant.plan?.maxUsers) {
        // Sin límite, omitir
        continue;
      }

      const currentUsers = tenant.users.length;
      const maxUsers = tenant.plan.maxUsers;

      if (currentUsers > maxUsers) {
        violations.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          planId: tenant.planId,
          planName: tenant.plan.name,
          maxUsers,
          currentUsers,
          exceededBy: currentUsers - maxUsers,
        });
      }
    }

    return violations;
  }

  /**
   * Procesa violaciones de límites:
   * 1. Detecta violaciones
   * 2. Envía alertas a admin de plataforma y al tenant
   * 3. Opcionalmente bloquea acceso después de X días
   */
  async checkAndAlertLimitViolations(): Promise<{
    checked: number;
    violations: number;
    alertsSent: number;
    blocked: number;
  }> {
    const alertsEnabled =
      this.config.get<string>('ALERTS_ENABLED') === 'true';
    if (!alertsEnabled) {
      this.logger.debug('Alertas deshabilitadas, omitiendo verificación');
      return { checked: 0, violations: 0, alertsSent: 0, blocked: 0 };
    }

    const violations = await this.detectLimitViolations();
    let alertsSent = 0;
    let blocked = 0;

    for (const violation of violations) {
      try {
        // Obtener fecha de primera detección (usar campo de auditoría o crear uno)
        // Por ahora, asumimos que es la primera vez que detectamos
        // En producción, deberías guardar fecha de primera violación en BD

        // Enviar alerta al admin de plataforma
        await this.alertService.sendAlert({
          title: `⚠️ Tenant excede límite de usuarios`,
          message: `El tenant "${violation.tenantName}" (${violation.tenantId}) tiene ${violation.currentUsers} usuarios pero su plan "${violation.planName}" solo permite ${violation.maxUsers}. Excede por ${violation.exceededBy} usuarios.`,
          severity: 'warning',
          metadata: {
            tenantId: violation.tenantId,
            tenantName: violation.tenantName,
            planId: violation.planId,
            planName: violation.planName,
            maxUsers: violation.maxUsers,
            currentUsers: violation.currentUsers,
            exceededBy: violation.exceededBy,
            timestamp: new Date().toISOString(),
          },
        });

        // Enviar email al admin del tenant
        const tenantAdmin = await this.prisma.user.findFirst({
          where: {
            tenantId: violation.tenantId,
            role: 'ADMIN',
            isActive: true,
          },
          select: { email: true },
        });

        if (tenantAdmin?.email) {
          try {
            await this.mailer.sendMail({
              to: tenantAdmin.email,
              subject: `⚠️ Límite de usuarios excedido - ${violation.tenantName}`,
              html: `
                <h2>Límite de usuarios excedido</h2>
                <p>Tu empresa <strong>${violation.tenantName}</strong> está usando más usuarios de los permitidos en tu plan actual.</p>
                <ul>
                  <li><strong>Plan actual:</strong> ${violation.planName}</li>
                  <li><strong>Límite permitido:</strong> ${violation.maxUsers} usuarios</li>
                  <li><strong>Usuarios actuales:</strong> ${violation.currentUsers} usuarios</li>
                  <li><strong>Exceso:</strong> ${violation.exceededBy} usuarios</li>
                </ul>
                <p>Para continuar usando todos los usuarios, por favor actualiza tu plan a uno que permita más usuarios.</p>
                <p>Si no actualizas tu plan en los próximos ${this.alertAfterDays} días, el acceso puede ser limitado.</p>
                <p><a href="${this.config.get('FRONTEND_URL')}/settings/billing">Actualizar plan</a></p>
              `,
            });
            alertsSent++;
          } catch (emailErr) {
            this.logger.error(
              `Error enviando email de alerta a ${tenantAdmin.email}: ${(emailErr as Error).message}`,
            );
          }
        }

        // Opcional: Bloquear acceso después de X días de exceder límite
        // Por ahora solo alertamos, el bloqueo se puede implementar después
        // si es necesario según política de negocio

        this.logger.warn(
          `Violación de límite detectada: tenant ${violation.tenantId} tiene ${violation.currentUsers} usuarios pero límite es ${violation.maxUsers}`,
        );
      } catch (err) {
        this.logger.error(
          `Error procesando violación para tenant ${violation.tenantId}: ${(err as Error).message}`,
        );
      }
    }

    return {
      checked: violations.length > 0
        ? await this.prisma.tenant.count({
            where: { isActive: true, planId: { not: null } },
          })
        : 0,
      violations: violations.length,
      alertsSent,
      blocked,
    };
  }

  /**
   * Bloquea acceso de tenants que han excedido límites por más de X días.
   * Solo se ejecuta si PLAN_LIMITS_AUTO_BLOCK está habilitado.
   */
  async blockTenantsExceedingLimits(): Promise<number> {
    const autoBlockEnabled =
      this.config.get<string>('PLAN_LIMITS_AUTO_BLOCK') === 'true';
    if (!autoBlockEnabled) {
      return 0;
    }

    // Esta funcionalidad se puede implementar después si es necesaria
    // Por ahora solo detectamos y alertamos
    return 0;
  }
}
