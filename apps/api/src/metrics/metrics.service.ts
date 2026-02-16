import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../common/services/plan-limits.service';

type StatusBucket = '2xx' | '3xx' | '4xx' | '5xx' | 'unknown';

type TenantMetrics = {
  totalRequests: number;
};

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {}
  private startedAt = Date.now();

  private totalRequests = 0;
  private statusBuckets: Record<StatusBucket, number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    unknown: 0,
  };

  private totalDurationMs = 0;
  private maxDurationMs = 0;

  // Cardinalidad controlada por ruta
  private byRoute: Record<string, number> = {};
  private byRouteKeys = 0;
  private readonly maxRouteKeys = 200;

  // Métricas de uso por tenant (cardinalidad controlada)
  private byTenant: Record<string, TenantMetrics> = {};
  private byTenantKeys = 0;
  private readonly maxTenantKeys = 500;

  recordHttpRequest(args: {
    method?: string;
    route?: string;
    statusCode?: number;
    durationMs: number;
    tenantId?: string | null;
  }) {
    this.totalRequests += 1;
    this.totalDurationMs += args.durationMs;
    this.maxDurationMs = Math.max(this.maxDurationMs, args.durationMs);

    const sc = typeof args.statusCode === 'number' ? args.statusCode : -1;
    const bucket: StatusBucket =
      sc >= 200 && sc < 300
        ? '2xx'
        : sc >= 300 && sc < 400
          ? '3xx'
          : sc >= 400 && sc < 500
            ? '4xx'
            : sc >= 500 && sc < 600
              ? '5xx'
              : 'unknown';
    this.statusBuckets[bucket] += 1;

    const method = (args.method ?? 'UNKNOWN').toUpperCase();
    const route = args.route ?? 'UNKNOWN';
    const key = `${method} ${route}`;

    if (this.byRoute[key] === undefined) {
      if (this.byRouteKeys >= this.maxRouteKeys) return;
      this.byRouteKeys += 1;
      this.byRoute[key] = 0;
    }
    this.byRoute[key] += 1;

    // Uso por tenant (solo si tenemos tenantId y controlando cardinalidad)
    const tenantId = args.tenantId ?? null;
    if (tenantId) {
      if (!this.byTenant[tenantId]) {
        if (this.byTenantKeys >= this.maxTenantKeys) {
          // Evitar explosión de cardinalidad; ignorar tenants adicionales
          return;
        }
        this.byTenantKeys += 1;
        this.byTenant[tenantId] = { totalRequests: 0 };
      }
      this.byTenant[tenantId].totalRequests += 1;
    }
  }

  snapshot() {
    const uptimeSeconds = Math.round((Date.now() - this.startedAt) / 1000);
    const avgDurationMs =
      this.totalRequests > 0
        ? Math.round(this.totalDurationMs / this.totalRequests)
        : 0;

    const topTenantUsage = Object.entries(this.byTenant)
      .sort((a, b) => b[1].totalRequests - a[1].totalRequests)
      .slice(0, 50)
      .map(([tenantId, metrics]) => ({
        tenantId,
        totalRequests: metrics.totalRequests,
      }));

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      http: {
        totalRequests: this.totalRequests,
        statusBuckets: this.statusBuckets,
        latencyMs: {
          avg: avgDurationMs,
          max: this.maxDurationMs,
        },
        topRoutes: Object.entries(this.byRoute)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([key, count]) => ({ route: key, count })),
        byTenant: topTenantUsage,
      },
    };
  }

  /**
   * Formato Prometheus (exposition text). Para scraping con Prometheus/Grafana.
   * Ref: https://prometheus.io/docs/instrumenting/exposition_formats/
   */
  getPrometheusText(): string {
    const uptimeSeconds = (Date.now() - this.startedAt) / 1000;
    const avgDurationMs =
      this.totalRequests > 0 ? this.totalDurationMs / this.totalRequests : 0;

    const lines: string[] = [
      '# HELP api_http_requests_total Total HTTP requests.',
      '# TYPE api_http_requests_total counter',
      `api_http_requests_total ${this.totalRequests}`,
      '# HELP api_http_request_duration_seconds_avg Average request duration in seconds.',
      '# TYPE api_http_request_duration_seconds_avg gauge',
      `api_http_request_duration_seconds_avg ${(avgDurationMs / 1000).toFixed(6)}`,
      '# HELP api_http_request_duration_seconds_max Max request duration in seconds.',
      '# TYPE api_http_request_duration_seconds_max gauge',
      `api_http_request_duration_seconds_max ${(this.maxDurationMs / 1000).toFixed(6)}`,
      '# HELP api_uptime_seconds Process uptime in seconds.',
      '# TYPE api_uptime_seconds gauge',
      `api_uptime_seconds ${uptimeSeconds.toFixed(2)}`,
      '# HELP api_http_requests_by_status Total requests by status bucket (2xx, 3xx, 4xx, 5xx).',
      '# TYPE api_http_requests_by_status counter',
    ];

    for (const [bucket, count] of Object.entries(this.statusBuckets)) {
      lines.push(`api_http_requests_by_status{status="${bucket}"} ${count}`);
    }

    // Métrica agregada por tenant (solo total; cardinalidad controlada)
    lines.push(
      '# HELP api_http_requests_by_tenant Total HTTP requests by tenant (top N).',
    );
    lines.push('# TYPE api_http_requests_by_tenant counter');
    for (const [tenantId, metrics] of Object.entries(this.byTenant)) {
      lines.push(
        `api_http_requests_by_tenant{tenant_id="${tenantId}"} ${metrics.totalRequests}`,
      );
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Obtiene métricas agregadas por plan, combinando datos en memoria con información de BD.
   * Útil para dashboards que muestran uso por plan.
   */
  async getMetricsByPlan() {
    const tenantUsage = Object.entries(this.byTenant).map(([tenantId, metrics]) => ({
      tenantId,
      totalRequests: metrics.totalRequests,
    }));

    if (tenantUsage.length === 0) {
      return {
        timestamp: new Date().toISOString(),
        byPlan: [],
        summary: {
          totalTenants: 0,
          totalRequests: 0,
        },
      };
    }

    // Obtener información de planes para cada tenant
    const tenantIds = tenantUsage.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: {
        id: { in: tenantIds },
      },
      select: {
        id: true,
        name: true,
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Crear mapa tenantId -> plan info
    const tenantPlanMap = new Map(
      tenants.map((t) => [
        t.id,
        {
          tenantName: t.name,
          planId: t.plan?.id ?? null,
          planName: t.plan?.name ?? 'Sin plan',
          planSlug: t.plan?.slug ?? null,
        },
      ]),
    );

    // Agregar por plan
    const byPlanMap = new Map<
      string,
      {
        planId: string | null;
        planName: string;
        planSlug: string | null;
        tenants: Array<{
          tenantId: string;
          tenantName: string;
          totalRequests: number;
        }>;
        totalRequests: number;
      }
    >();

    for (const usage of tenantUsage) {
      const planInfo = tenantPlanMap.get(usage.tenantId);
      if (!planInfo) continue;

      const planKey = planInfo.planSlug ?? 'sin-plan';
      if (!byPlanMap.has(planKey)) {
        byPlanMap.set(planKey, {
          planId: planInfo.planId,
          planName: planInfo.planName,
          planSlug: planInfo.planSlug,
          tenants: [],
          totalRequests: 0,
        });
      }

      const planData = byPlanMap.get(planKey)!;
      planData.tenants.push({
        tenantId: usage.tenantId,
        tenantName: planInfo.tenantName,
        totalRequests: usage.totalRequests,
      });
      planData.totalRequests += usage.totalRequests;
    }

    // Convertir a array y ordenar por totalRequests descendente
    const byPlan = Array.from(byPlanMap.values()).sort(
      (a, b) => b.totalRequests - a.totalRequests,
    );

    return {
      timestamp: new Date().toISOString(),
      byPlan,
      summary: {
        totalTenants: tenantUsage.length,
        totalRequests: tenantUsage.reduce((sum, t) => sum + t.totalRequests, 0),
        totalPlans: byPlan.length,
      },
    };
  }

  /**
   * Detecta tenants que están cerca de exceder su límite de rate según su plan.
   * Retorna lista de alertas con información del tenant y su uso actual vs límite.
   */
  async getRateLimitAlerts(thresholdPercent = 80): Promise<
    Array<{
      tenantId: string;
      tenantName: string;
      planName: string;
      currentRequests: number;
      rateLimit: number;
      usagePercent: number;
      status: 'ok' | 'warning' | 'critical';
    }>
  > {
    const tenantUsage = Object.entries(this.byTenant).map(([tenantId, metrics]) => ({
      tenantId,
      totalRequests: metrics.totalRequests,
    }));

    if (tenantUsage.length === 0) {
      return [];
    }

    const tenantIds = tenantUsage.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: {
        id: { in: tenantUsage.map((t) => t.tenantId) },
      },
      select: {
        id: true,
        name: true,
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const alerts: Array<{
      tenantId: string;
      tenantName: string;
      planName: string;
      currentRequests: number;
      rateLimit: number;
      usagePercent: number;
      status: 'ok' | 'warning' | 'critical';
    }> = [];

    for (const tenant of tenants) {
      const usage = tenantUsage.find((u) => u.tenantId === tenant.id);
      if (!usage) continue;

      const rateLimit = await this.planLimits.getRateLimitForTenant(tenant.id);
      // Las métricas son acumuladas desde el inicio; para comparar con límite por minuto,
      // necesitaríamos ventanas de tiempo. Por ahora, usamos un aproximado basado en uptime.
      const uptimeMinutes = Math.max(1, Math.round((Date.now() - this.startedAt) / 60000));
      const avgRequestsPerMinute = usage.totalRequests / uptimeMinutes;
      const usagePercent = (avgRequestsPerMinute / rateLimit) * 100;

      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (usagePercent >= thresholdPercent) {
        status = usagePercent >= 95 ? 'critical' : 'warning';
      }

      alerts.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        planName: tenant.plan?.name ?? 'Sin plan',
        currentRequests: Math.round(avgRequestsPerMinute * 100) / 100, // Redondear a 2 decimales
        rateLimit,
        usagePercent: Math.round(usagePercent * 100) / 100,
        status,
      });
    }

    // Ordenar por porcentaje de uso descendente
    return alerts.sort((a, b) => b.usagePercent - a.usagePercent);
  }

  /**
   * Obtiene las métricas en memoria para uso por alertas.
   * Expone el objeto byTenant para que MetricsAlertsService pueda acceder.
   */
  getTenantMetrics(): Record<string, { totalRequests: number }> {
    return { ...this.byTenant };
  }

  /**
   * Obtiene el tiempo de inicio del servicio para cálculos de promedio.
   */
  getStartedAt(): number {
    return this.startedAt;
  }
}
