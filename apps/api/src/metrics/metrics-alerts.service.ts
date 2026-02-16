import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../common/services/plan-limits.service';
import { AlertService, AlertPayload } from '../common/services/alert.service';
import { MetricsService } from './metrics.service';

/**
 * Servicio que monitorea métricas y envía alertas cuando se detectan problemas.
 * Se ejecuta periódicamente para verificar:
 * - Tenants cerca de límites de rate
 * - Errores altos en la API
 * - Problemas de rendimiento
 */
@Injectable()
export class MetricsAlertsService {
  private readonly logger = new Logger(MetricsAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
    private readonly alertService: AlertService,
    private readonly metricsService: MetricsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verifica tenants cerca de límites de rate y envía alertas.
   */
  async checkRateLimitAlerts(): Promise<void> {
    const threshold = parseInt(
      this.config.get<string>('METRICS_ALERT_THRESHOLD_PERCENT', '80'),
      10,
    );

    // Obtener métricas de uso por tenant desde MetricsService
    const tenantMetrics = this.metricsService.getTenantMetrics();
    const startedAt = this.metricsService.getStartedAt();

    if (Object.keys(tenantMetrics).length === 0) {
      this.logger.debug('No hay métricas de tenants para verificar');
      return;
    }

    // Obtener información de tenants
    const tenantIds = Object.keys(tenantMetrics);
    const tenants = await this.prisma.tenant.findMany({
      where: {
        id: { in: tenantIds },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        plan: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    const uptimeMinutes = Math.max(
      1,
      Math.round((Date.now() - startedAt) / 60000),
    );

    for (const tenant of tenants) {
      try {
        const metrics = tenantMetrics[tenant.id];
        if (!metrics) continue;

        const rateLimit = await this.planLimits.getRateLimitForTenant(
          tenant.id,
        );
        const avgRequestsPerMinute = metrics.totalRequests / uptimeMinutes;
        const usagePercent = (avgRequestsPerMinute / rateLimit) * 100;

        // Solo enviar alerta si supera el threshold
        if (usagePercent >= threshold) {
          await this.sendRateLimitAlert(
            tenant.id,
            tenant.name,
            Math.round(avgRequestsPerMinute * 100) / 100,
            rateLimit,
            usagePercent,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error verificando alertas para tenant ${tenant.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Envía alerta de rate limit para un tenant específico.
   */
  async sendRateLimitAlert(
    tenantId: string,
    tenantName: string,
    currentUsage: number,
    rateLimit: number,
    usagePercent: number,
  ): Promise<void> {
    const severity: 'warning' | 'critical' =
      usagePercent >= 95 ? 'critical' : 'warning';

    const payload: AlertPayload = {
      title: `Tenant cerca de límite de rate`,
      message: `El tenant "${tenantName}" está usando ${usagePercent.toFixed(1)}% de su límite de rate (${currentUsage}/${rateLimit} req/min)`,
      severity,
      metadata: {
        tenantId,
        tenantName,
        currentUsage,
        rateLimit,
        usagePercent: Math.round(usagePercent * 100) / 100,
      },
      tenantId,
      tenantName,
    };

    await this.alertService.sendAlert(payload);
  }

  /**
   * Envía alerta de error alto en la API.
   */
  async sendHighErrorRateAlert(
    errorRate: number,
    threshold: number = 10,
  ): Promise<void> {
    if (errorRate < threshold) return;

    const payload: AlertPayload = {
      title: 'Tasa de errores alta detectada',
      message: `La tasa de errores HTTP es ${errorRate.toFixed(2)}%, superando el umbral de ${threshold}%`,
      severity: errorRate > 20 ? 'critical' : 'warning',
      metadata: {
        errorRate,
        threshold,
      },
    };

    await this.alertService.sendAlert(payload);
  }

  /**
   * Envía alerta de latencia alta.
   */
  async sendHighLatencyAlert(
    avgLatency: number,
    threshold: number = 2000,
  ): Promise<void> {
    if (avgLatency < threshold) return;

    const payload: AlertPayload = {
      title: 'Latencia alta detectada',
      message: `La latencia promedio es ${avgLatency}ms, superando el umbral de ${threshold}ms`,
      severity: avgLatency > 5000 ? 'critical' : 'warning',
      metadata: {
        avgLatency,
        threshold,
      },
    };

    await this.alertService.sendAlert(payload);
  }
}
