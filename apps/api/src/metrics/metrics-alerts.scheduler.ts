import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { MetricsAlertsService } from './metrics-alerts.service';
import { MetricsService } from './metrics.service';

/**
 * Scheduler que ejecuta verificaciones de alertas periódicamente.
 * - Verifica rate limits cada hora
 * - Verifica errores y latencia cada 15 minutos
 */
@Injectable()
export class MetricsAlertsScheduler {
  private readonly logger = new Logger(MetricsAlertsScheduler.name);
  private readonly isTestEnv =
    process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

  constructor(
    private readonly alertsService: MetricsAlertsService,
    private readonly metricsService: MetricsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verifica rate limits cada hora y envía alertas si es necesario.
   */
  @Cron('0 * * * *') // Cada hora en el minuto 0
  async checkRateLimits() {
    if (this.isTestEnv) return;

    const enabled = this.config.get<string>('ALERTS_ENABLED', 'false');
    if (enabled !== 'true') {
      this.logger.debug('Alertas automáticas deshabilitadas');
      return;
    }

    try {
      this.logger.log('Ejecutando verificación de rate limits');
      await this.alertsService.checkRateLimitAlerts();
    } catch (error) {
      this.logger.error('Error en verificación de rate limits:', error);
    }
  }

  /**
   * Verifica métricas de errores y latencia cada 15 minutos.
   */
  @Cron('*/15 * * * *') // Cada 15 minutos
  async checkErrorRateAndLatency() {
    if (this.isTestEnv) return;

    const enabled = this.config.get<string>('ALERTS_ENABLED', 'false');
    if (enabled !== 'true') {
      return;
    }

    try {
      const snapshot = this.metricsService.snapshot();
      const http = snapshot.http;

      // Calcular tasa de errores
      const totalRequests = http.totalRequests;
      const errorRequests =
        http.statusBuckets['4xx'] + http.statusBuckets['5xx'];
      const errorRate =
        totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

      // Verificar tasa de errores
      if (errorRate > 10) {
        await this.alertsService.sendHighErrorRateAlert(errorRate, 10);
      }

      // Verificar latencia
      const avgLatencyMs = http.latencyMs.avg;
      if (avgLatencyMs > 2000) {
        await this.alertsService.sendHighLatencyAlert(avgLatencyMs, 2000);
      }
    } catch (error) {
      this.logger.error('Error en verificación de errores/latencia:', error);
    }
  }
}
