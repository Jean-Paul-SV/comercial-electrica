import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlanLimitsMonitorService } from '../services/plan-limits-monitor.service';

/**
 * Scheduler que ejecuta la validación continua de límites de plan.
 * C2.2: Detecta tenants que exceden límites y envía alertas.
 * 
 * Ejecuta diariamente a las 9:00 AM para detectar violaciones.
 */
@Injectable()
export class PlanLimitsMonitorScheduler {
  private readonly logger = new Logger(PlanLimitsMonitorScheduler.name);

  constructor(
    private readonly planLimitsMonitor: PlanLimitsMonitorService,
  ) {}

  /**
   * Ejecuta la verificación de límites diariamente a las 9:00 AM.
   * Cron: 0 9 * * * (9:00 AM todos los días)
   */
  @Cron('0 9 * * *')
  async checkPlanLimits(): Promise<void> {
    try {
      this.logger.log('Iniciando verificación de límites de plan...');
      const result =
        await this.planLimitsMonitor.checkAndAlertLimitViolations();

      this.logger.log(
        `Verificación de límites completada: ${result.checked} tenants revisados, ${result.violations} violaciones detectadas, ${result.alertsSent} alertas enviadas`,
      );

      if (result.violations > 0) {
        this.logger.warn(
          `⚠️ ${result.violations} tenants exceden límites de su plan. Revisar alertas para detalles.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error en verificación de límites de plan:',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
