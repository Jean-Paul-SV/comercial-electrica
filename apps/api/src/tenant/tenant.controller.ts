import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanLimitsService } from '../common/services/plan-limits.service';

@ApiTags('tenant')
@ApiBearerAuth('JWT-auth')
@Controller('tenant')
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(private readonly planLimits: PlanLimitsService) {}

  @Get('limits')
  @ApiOperation({
    summary: 'Obtener límites y módulos habilitados del tenant',
    description:
      'Devuelve información completa de límites del plan: límites de usuarios (maxUsers, currentUsers, canAddUsers) y módulos habilitados (enabledModules) del tenant actual.',
  })
  @ApiResponse({
    status: 200,
    description: 'Límites y módulos del tenant',
    schema: {
      type: 'object',
      properties: {
        maxUsers: {
          type: 'number',
          nullable: true,
          description: 'Límite máximo de usuarios permitidos. null = sin límite',
        },
        currentUsers: {
          type: 'number',
          description: 'Número actual de usuarios activos',
        },
        canAddUsers: {
          type: 'boolean',
          description: 'Indica si se pueden agregar más usuarios',
        },
        enabledModules: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de códigos de módulos habilitados para el tenant',
          example: ['core', 'inventory', 'electronic_invoicing'],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getLimits(@Req() req: { user?: { sub?: string; tenantId?: string | null } }) {
    return this.planLimits.getTenantLimits(req.user?.tenantId ?? null);
  }
}
