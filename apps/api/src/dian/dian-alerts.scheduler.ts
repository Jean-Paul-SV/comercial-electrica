import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DianService } from './dian.service';

/**
 * Cron diario: envía alertas por email (certificado por vencer, rango bajo)
 * a los usuarios con permiso dian:manage de cada tenant afectado.
 */
@Injectable()
export class DianAlertsScheduler {
  private readonly logger = new Logger(DianAlertsScheduler.name);
  private readonly isTestEnv =
    process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

  constructor(private readonly dianService: DianService) {}

  @Cron('0 8 * * *') // Todos los días a las 08:00
  async handleDailyAlerts() {
    if (this.isTestEnv) return;
    try {
      this.logger.log('Ejecutando envío de alertas DIAN (certificado/rango).');
      await this.dianService.sendDianAlertsForTenants();
    } catch (err) {
      this.logger.error(
        'Error en envío de alertas DIAN:',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
