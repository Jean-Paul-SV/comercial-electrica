import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';

@Controller('metrics')
@ApiTags('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Métricas básicas del proceso',
    description:
      'Métricas simples (sin Prometheus). Requiere ADMIN.',
  })
  @ApiResponse({ status: 200, description: 'Snapshot de métricas' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (requiere ADMIN)' })
  @ApiResponse({ status: 404, description: 'Métricas deshabilitadas' })
  getMetrics() {
    const enabled = this.config.get<string>('METRICS_ENABLED', 'true');
    if (enabled.toLowerCase() === 'false') {
      throw new NotFoundException('Métricas deshabilitadas');
    }
    return this.metrics.snapshot();
  }
}

