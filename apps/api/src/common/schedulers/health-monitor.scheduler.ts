import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HealthMonitorService } from '../services/health-monitor.service';

/**
 * Scheduler que ejecuta el monitoreo de salud periódicamente.
 * Verifica cada 5 minutos y envía alertas si detecta problemas.
 */
@Injectable()
export class HealthMonitorScheduler {
  private readonly logger = new Logger(HealthMonitorScheduler.name);

  constructor(private readonly healthMonitor: HealthMonitorService) {}

  /**
   * Ejecuta el check de salud cada 5 minutos.
   * Cron: cada 5 minutos (minuto 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
   */
  @Cron('*/5 * * * *')
  async checkHealth(): Promise<void> {
    try {
      await this.healthMonitor.checkHealthAndAlert();
    } catch (error) {
      this.logger.error('Error en health monitor scheduler:', error);
    }
  }
}
