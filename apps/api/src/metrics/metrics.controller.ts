import {
  Controller,
  Get,
  NotFoundException,
  UseGuards,
  Header,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';
import { MetricsAlertsService } from './metrics-alerts.service';
import { QueryPerformanceService } from '../common/services/query-performance.service';
import { AlertService } from '../common/services/alert.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@Controller('metrics')
@ApiTags('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly alertsService: MetricsAlertsService,
    private readonly alertService: AlertService,
    private readonly queryPerformance: QueryPerformanceService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('metrics:read')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Métricas básicas del proceso',
    description: 'Métricas en JSON (snapshot). Requiere permiso metrics:read.',
  })
  @ApiResponse({ status: 200, description: 'Snapshot de métricas' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'No autorizado (requiere permiso metrics:read)',
  })
  @ApiResponse({ status: 404, description: 'Métricas deshabilitadas' })
  getMetrics() {
    const enabled = this.config.get<string>('METRICS_ENABLED', 'true');
    if (enabled.toLowerCase() === 'false') {
      throw new NotFoundException('Métricas deshabilitadas');
    }
    return this.metrics.snapshot();
  }

  @Get('prometheus')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('metrics:read')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Métricas en formato Prometheus',
    description:
      'Formato exposition para scraping con Prometheus. Requiere permiso metrics:read. Content-Type: text/plain.',
  })
  @ApiResponse({ status: 200, description: 'Métricas en texto Prometheus' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Métricas deshabilitadas' })
  getPrometheus(): string {
    const enabled = this.config.get<string>('METRICS_ENABLED', 'true');
    if (enabled.toLowerCase() === 'false') {
      throw new NotFoundException('Métricas deshabilitadas');
    }
    return this.metrics.getPrometheusText();
  }

  @Get('by-plan')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('metrics:read')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Métricas agregadas por plan',
    description:
      'Métricas de uso agrupadas por plan, combinando datos en memoria con información de BD. Requiere permiso metrics:read.',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas agrupadas por plan con lista de tenants y uso',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Métricas deshabilitadas' })
  async getMetricsByPlan() {
    const enabled = this.config.get<string>('METRICS_ENABLED', 'true');
    if (enabled.toLowerCase() === 'false') {
      throw new NotFoundException('Métricas deshabilitadas');
    }
    return this.metrics.getMetricsByPlan();
  }

  @Get('rate-limit-alerts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('metrics:read')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Alertas de límites de rate por plan',
    description:
      'Lista de tenants que están cerca de exceder su límite de rate según su plan. Requiere permiso metrics:read.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de alertas con tenants cerca de sus límites',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Métricas deshabilitadas' })
  async getRateLimitAlerts() {
    const enabled = this.config.get<string>('METRICS_ENABLED', 'true');
    if (enabled.toLowerCase() === 'false') {
      throw new NotFoundException('Métricas deshabilitadas');
    }
    const threshold = parseInt(
      this.config.get<string>('METRICS_ALERT_THRESHOLD_PERCENT', '80'),
      10,
    );
    return this.metrics.getRateLimitAlerts(threshold);
  }

  @Post('alerts/test')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('metrics:read')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Enviar alerta de prueba',
    description:
      'Envía una alerta de prueba a todos los canales configurados (Slack, Email, Webhook). Requiere permiso metrics:read.',
  })
  @ApiResponse({
    status: 200,
    description: 'Alerta de prueba enviada',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  async sendTestAlert() {
    await this.alertService.sendAlert({
      title: 'Alerta de Prueba',
      message: 'Esta es una alerta de prueba del sistema de monitoreo Orion',
      severity: 'info',
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'test-endpoint',
      },
    });
    return { message: 'Alerta de prueba enviada' };
  }

  @Get('slow-queries')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('metrics:read')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener queries lentas',
    description:
      'Retorna las queries más lentas registradas y recomendaciones de optimización',
  })
  @ApiResponse({
    status: 200,
    description: 'Queries lentas y análisis',
    schema: {
      example: {
        total: 5,
        averageDuration: 1250,
        maxDuration: 3500,
        recommendations: [
          'Considerar agregar índices adicionales',
          'Query pattern frecuente detectado',
        ],
        queries: [
          {
            query: 'SELECT * FROM Sale WHERE tenantId = ?',
            duration: 1500,
            timestamp: '2026-02-16T10:00:00Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  getSlowQueries() {
    const analysis = this.queryPerformance.analyzeSlowQueries();
    const queries = this.queryPerformance.getSlowQueries(20);
    return {
      ...analysis,
      queries,
    };
  }
}
