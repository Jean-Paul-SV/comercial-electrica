import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { CreatePortalSessionDto } from './dto/create-portal-session.dto';
import { ChangePlanDto } from './dto/change-plan.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingPortalController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('plans')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar planes disponibles',
    description:
      'Planes activos con precios mensual y anual para que el cliente pueda cambiar. Solo usuarios con tenant.',
  })
  @ApiResponse({ status: 200, description: 'Lista de planes.' })
  getPlans(@Req() req: { user?: { tenantId?: string | null } }) {
    if (!req.user?.tenantId) {
      throw new BadRequestException(
        'Solo los usuarios de una empresa pueden ver los planes. Los administradores de plataforma usan el panel proveedor.',
      );
    }
    return this.billing.getActivePlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('plan/validate-downgrade')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Validar si se puede hacer downgrade a un plan',
    description:
      'Devuelve si el cambio al plan indicado está permitido (downgrade) y lista de errores/advertencias. Útil para deshabilitar el botón o mostrar avisos antes de confirmar.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de validación',
    schema: {
      type: 'object',
      properties: {
        allowed: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async validateDowngrade(
    @Req() req: { user?: { tenantId?: string | null } },
    @Query('planId') planId: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'Solo los usuarios de una empresa pueden validar el cambio de plan.',
      );
    }
    if (!planId || typeof planId !== 'string') {
      throw new BadRequestException('planId es requerido.');
    }
    return this.billing.validateDowngrade(tenantId, planId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('plan')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cambiar plan del tenant',
    description:
      'Upgrade: inmediato con prorrateo. Downgrade: programado al final del ciclo. Devuelve scheduledChangeAt si el cambio es diferido.',
  })
  @ApiResponse({ status: 200, description: 'Plan actualizado (o cambio programado).' })
  @ApiResponse({ status: 400, description: 'Downgrade bloqueado (ej. demasiados usuarios, DIAN activa).' })
  @ApiResponse({ status: 404, description: 'Plan o empresa no encontrados.' })
  async changePlan(
    @Req() req: { user?: { tenantId?: string | null } },
    @Body() dto: ChangePlanDto,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'Solo los usuarios de una empresa pueden cambiar el plan.',
      );
    }
    return this.billing.changeTenantPlan(tenantId, dto.planId, dto.billingInterval);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Informaci?n de suscripci?n del tenant',
    description:
      'Devuelve plan, estado de la suscripci?n y si el usuario puede abrir el portal de Stripe (gesti?n de pago y facturas). Solo para usuarios con tenant (no platform admin).',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos de plan y suscripci?n',
    schema: {
      type: 'object',
      properties: {
        plan: {
          type: 'object',
          nullable: true,
          properties: { name: { type: 'string' }, slug: { type: 'string' } },
        },
        subscription: {
          type: 'object',
          nullable: true,
          properties: {
            status: { type: 'string' },
            currentPeriodEnd: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            currentPeriodStart: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
          },
        },
        canManageBilling: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario sin tenant o sin suscripci?n',
  })
  getSubscription(@Req() req: { user?: { tenantId?: string | null } }) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'Solo los usuarios de una empresa pueden ver la facturaci?n. Los administradores de plataforma usan el panel proveedor.',
      );
    }
    return this.billing.getSubscriptionForTenant(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('portal-session')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear sesi?n del portal de facturaci?n Stripe',
    description:
      'Genera una URL de Stripe Customer Portal para que el usuario gestione m?todo de pago, facturas y suscripci?n. Redirigir al usuario a la URL devuelta.',
  })
  @ApiResponse({
    status: 201,
    description: 'URL del portal',
    schema: {
      type: 'object',
      properties: { url: { type: 'string', format: 'uri' } },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Sin suscripci?n Stripe o Stripe no configurado',
  })
  async createPortalSession(
    @Req() req: { user?: { tenantId?: string | null } },
    @Body() dto: CreatePortalSessionDto,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'Solo los usuarios de una empresa pueden abrir el portal de facturaci?n.',
      );
    }
    const baseUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const returnUrl =
      dto.returnUrl?.trim() || `${baseUrl.replace(/\/$/, '')}/settings/billing`;
    return this.billing.createPortalSession(tenantId, returnUrl);
  }
}
