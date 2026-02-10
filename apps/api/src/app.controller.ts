import { Controller, Get, UseGuards, Req, Query, ForbiddenException } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { RequirePermission } from './auth/require-permission.decorator';

@Controller()
@ApiTags('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Endpoint raíz de la API' })
  @ApiResponse({ status: 200, description: 'Mensaje de bienvenida' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check - Verificar estado de la API y servicios',
    description: 'Verifica el estado de la API, base de datos y servicios',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de salud del sistema',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-01-27T04:54:36.456Z' },
        uptime: { type: 'number', example: 123.456 },
        environment: { type: 'string', example: 'development' },
        services: {
          type: 'object',
          properties: {
            database: { type: 'string', example: 'connected' },
            redis: { type: 'string', example: 'connected' },
            queues: { type: 'object' },
            responseTime: { type: 'string', example: '5ms' },
          },
        },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('reports:read')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Estadísticas generales del sistema',
    description:
      'Obtiene estadísticas generales del sistema filtradas por tenant. Usuarios regulares ven solo su tenant. Platform admins pueden especificar tenantId opcional.',
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    description: 'ID del tenant (solo para platform admins). Si no se especifica, usa el tenant del usuario autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas del sistema',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'No autorizado (requiere permiso reports:read)',
  })
  getStats(
    @Req() req: { user?: { tenantId?: string | null; isPlatformAdmin?: boolean } },
    @Query('tenantId') tenantId?: string,
  ) {
    // Si es platform admin y especifica tenantId, usar ese
    // Si no, usar el tenantId del usuario autenticado
    const targetTenantId = req.user?.isPlatformAdmin && tenantId
      ? tenantId
      : req.user?.tenantId ?? null;

    if (!targetTenantId && !req.user?.isPlatformAdmin) {
      throw new ForbiddenException('Tenant requerido para obtener estadísticas');
    }

    return this.appService.getStats(targetTenantId);
  }
}
