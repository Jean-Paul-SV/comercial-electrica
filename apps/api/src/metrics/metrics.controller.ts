import {
  Controller,
  Get,
  NotFoundException,
  UseGuards,
  Header,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@Controller('metrics')
@ApiTags('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('metrics:read')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Métricas básicas del proceso',
    description:
      'Métricas en JSON (snapshot). Requiere permiso metrics:read.',
  })
  @ApiResponse({ status: 200, description: 'Snapshot de métricas' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere permiso metrics:read)' })
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
}

