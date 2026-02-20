import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DianCertMonitorService } from './dian-cert-monitor.service';

/**
 * Scheduler que ejecuta el monitoreo de certificados DIAN periódicamente.
 * C3.1: Detecta certificados que vencen pronto o están vencidos y envía alertas.
 * 
 * Ejecuta diariamente a las 9:00 AM para detectar certificados que necesitan renovación.
 */
@Injectable()
export class DianCertMonitorScheduler {
  private readonly logger = new Logger(DianCertMonitorScheduler.name);

  constructor(
    private readonly certMonitor: DianCertMonitorService,
  ) {}

  /**
   * Ejecuta la verificación de certificados diariamente a las 9:00 AM.
   * Cron: 0 9 * * * (9:00 AM todos los días)
   */
  @Cron('0 9 * * *')
  async checkCertificates(): Promise<void> {
    try {
      this.logger.log('Iniciando verificación de certificados DIAN...');
      const result = await this.certMonitor.checkAndAlertCertificates();

      this.logger.log(
        `Verificación de certificados completada: ${result.checked} certificados revisados, ${result.expiring} por vencer, ${result.expired} vencidos, ${result.alertsSent} alertas enviadas`,
      );

      if (result.expired > 0) {
        this.logger.error(
          `🚨 ${result.expired} certificados DIAN están VENCIDOS. El envío de facturas está bloqueado para estos tenants.`,
        );
      }

      if (result.expiring > 0) {
        this.logger.warn(
          `⚠️ ${result.expiring} certificados DIAN vencen pronto. Se han enviado alertas a los tenants.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error en verificación de certificados DIAN:',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
