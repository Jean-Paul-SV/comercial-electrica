import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertService } from '../common/services/alert.service';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../mailer/mailer.service';

export type CertExpirationAlert = {
  tenantId: string;
  tenantName: string;
  certValidUntil: Date;
  daysUntilExpiration: number;
  isExpired: boolean;
  adminEmail?: string;
};

/**
 * C3.1: Servicio que monitorea certificados DIAN y envía alertas proactivas.
 * Detecta certificados que vencen pronto o están vencidos.
 */
@Injectable()
export class DianCertMonitorService {
  private readonly logger = new Logger(DianCertMonitorService.name);
  private readonly alertDaysBeforeExpiration: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertService: AlertService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {
    // Días antes del vencimiento para enviar alerta (default: 30 días)
    this.alertDaysBeforeExpiration = parseInt(
      this.config.get<string>('DIAN_CERT_ALERT_DAYS_BEFORE') || '30',
      10,
    );
  }

  /**
   * Detecta certificados que vencen pronto o están vencidos.
   * Retorna lista de alertas con información detallada.
   */
  async detectExpiringCertificates(): Promise<CertExpirationAlert[]> {
    const now = new Date();
    const alertThreshold = new Date(now);
    alertThreshold.setDate(
      alertThreshold.getDate() + this.alertDaysBeforeExpiration,
    );

    const configs = await this.prisma.dianConfig.findMany({
      where: {
        certValidUntil: { not: null },
        certEncrypted: { not: null }, // Solo certificados configurados
        tenant: {
          isActive: true, // Solo tenants activos
        },
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
          },
        },
      },
    });

    const alerts: CertExpirationAlert[] = [];

    for (const config of configs) {
      if (!config.certValidUntil) continue;

      const daysUntilExpiration = Math.floor(
        (config.certValidUntil.getTime() - now.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      const isExpired = config.certValidUntil < now;
      const expiresSoon = config.certValidUntil <= alertThreshold;

      if (isExpired || expiresSoon) {
        alerts.push({
          tenantId: config.tenantId,
          tenantName: config.tenant.name || `Tenant ${config.tenantId}`,
          certValidUntil: config.certValidUntil,
          daysUntilExpiration,
          isExpired,
          adminEmail: config.tenant.users[0]?.email,
        });
      }
    }

    return alerts;
  }

  /**
   * Procesa alertas de certificados:
   * 1. Detecta certificados que vencen pronto o están vencidos
   * 2. Envía alertas a admin de plataforma y al tenant
   * 3. Bloquea envío a DIAN si el certificado está vencido (ya manejado en DianService)
   */
  async checkAndAlertCertificates(): Promise<{
    checked: number;
    expiring: number;
    expired: number;
    alertsSent: number;
  }> {
    const alertsEnabled =
      this.config.get<string>('ALERTS_ENABLED') === 'true';
    if (!alertsEnabled) {
      this.logger.debug('Alertas deshabilitadas, omitiendo verificación');
      return { checked: 0, expiring: 0, expired: 0, alertsSent: 0 };
    }

    const alerts = await this.detectExpiringCertificates();
    let alertsSent = 0;
    let expired = 0;
    let expiring = 0;

    for (const alert of alerts) {
      try {
        if (alert.isExpired) {
          expired++;
        } else {
          expiring++;
        }

        // Enviar alerta al admin de plataforma
        const severity = alert.isExpired ? 'critical' : 'warning';
        await this.alertService.sendAlert({
          title: alert.isExpired
            ? `🚨 Certificado DIAN vencido - ${alert.tenantName}`
            : `⚠️ Certificado DIAN por vencer - ${alert.tenantName}`,
          message: alert.isExpired
            ? `El certificado DIAN del tenant "${alert.tenantName}" (${alert.tenantId}) está VENCIDO desde ${alert.certValidUntil.toISOString().split('T')[0]}. El envío de facturas electrónicas está bloqueado hasta que se renueve el certificado.`
            : `El certificado DIAN del tenant "${alert.tenantName}" (${alert.tenantId}) vence en ${alert.daysUntilExpiration} día(s) (${alert.certValidUntil.toISOString().split('T')[0]}). Se recomienda renovarlo pronto para evitar interrupciones.`,
          severity,
          metadata: {
            tenantId: alert.tenantId,
            tenantName: alert.tenantName,
            certValidUntil: alert.certValidUntil.toISOString(),
            daysUntilExpiration: alert.daysUntilExpiration,
            isExpired: alert.isExpired,
            timestamp: new Date().toISOString(),
          },
        });

        // Enviar email al admin del tenant
        if (alert.adminEmail) {
          try {
            const frontendUrl = this.config.get<string>('FRONTEND_URL') || '';
            const settingsUrl = `${frontendUrl}/settings/electronic-invoicing`;

            await this.mailer.sendMail({
              to: alert.adminEmail,
              subject: alert.isExpired
                ? `🚨 Certificado DIAN vencido - ${alert.tenantName}`
                : `⚠️ Certificado DIAN por vencer - ${alert.tenantName}`,
              html: `
                <h2>${
                  alert.isExpired
                    ? 'Certificado DIAN vencido'
                    : 'Certificado DIAN por vencer'
                }</h2>
                <p>Tu empresa <strong>${alert.tenantName}</strong> tiene un certificado de firma electrónica DIAN que ${
                alert.isExpired
                  ? '<strong>está vencido</strong>'
                  : `vence en <strong>${alert.daysUntilExpiration} día(s)</strong>`
              }.</p>
                <ul>
                  <li><strong>Fecha de vencimiento:</strong> ${alert.certValidUntil.toISOString().split('T')[0]}</li>
                  <li><strong>Estado:</strong> ${alert.isExpired ? 'Vencido' : `Vence en ${alert.daysUntilExpiration} días`}</li>
                </ul>
                ${
                  alert.isExpired
                    ? '<p><strong>⚠️ IMPORTANTE:</strong> El envío de facturas electrónicas está bloqueado hasta que renueves el certificado. Esto puede afectar tu capacidad de facturar.</p>'
                    : '<p>Te recomendamos renovar el certificado pronto para evitar interrupciones en el servicio de facturación electrónica.</p>'
                }
                <p><a href="${settingsUrl}">Renovar certificado DIAN</a></p>
                <p>Si necesitas ayuda, contacta a soporte.</p>
              `,
            });
            alertsSent++;
          } catch (emailErr) {
            this.logger.error(
              `Error enviando email de alerta de certificado a ${alert.adminEmail}: ${(emailErr as Error).message}`,
            );
          }
        }

        this.logger.warn(
          `Certificado DIAN ${alert.isExpired ? 'vencido' : 'por vencer'}: tenant ${alert.tenantId}, vence ${alert.certValidUntil.toISOString()}, ${alert.daysUntilExpiration} días`,
        );
      } catch (err) {
        this.logger.error(
          `Error procesando alerta de certificado para tenant ${alert.tenantId}: ${(err as Error).message}`,
        );
      }
    }

    return {
      checked: alerts.length,
      expiring,
      expired,
      alertsSent,
    };
  }

  /**
   * Verifica si un certificado está vencido y bloquea envío si es necesario.
   * Este método puede ser llamado antes de procesar documentos DIAN.
   */
  async validateCertForTenant(tenantId: string): Promise<{
    valid: boolean;
    expired: boolean;
    expiresInDays?: number;
    message?: string;
  }> {
    const config = await this.prisma.dianConfig.findUnique({
      where: { tenantId },
      select: {
        certValidUntil: true,
        certEncrypted: true,
      },
    });

    if (!config || !config.certEncrypted) {
      return {
        valid: false,
        expired: false,
        message: 'No hay certificado configurado',
      };
    }

    if (!config.certValidUntil) {
      return {
        valid: true, // Asumimos válido si no hay fecha
        expired: false,
      };
    }

    const now = new Date();
    const isExpired = config.certValidUntil < now;
    const daysUntilExpiration = Math.floor(
      (config.certValidUntil.getTime() - now.getTime()) /
        (24 * 60 * 60 * 1000),
    );

    return {
      valid: !isExpired,
      expired: isExpired,
      expiresInDays: daysUntilExpiration,
      message: isExpired
        ? `Certificado vencido desde ${config.certValidUntil.toISOString().split('T')[0]}`
        : daysUntilExpiration <= 30
          ? `Certificado vence en ${daysUntilExpiration} días`
          : undefined,
    };
  }
}
