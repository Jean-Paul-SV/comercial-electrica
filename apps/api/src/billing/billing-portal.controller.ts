import {
  Controller,
  Get,
  Post,
  Body,
  Req,
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

@ApiTags('billing')
@Controller('billing')
export class BillingPortalController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Información de suscripción del tenant',
    description:
      'Devuelve plan, estado de la suscripción y si el usuario puede abrir el portal de Stripe (gestión de pago y facturas). Solo para usuarios con tenant (no platform admin).',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos de plan y suscripción',
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
            currentPeriodEnd: { type: 'string', format: 'date-time', nullable: true },
            currentPeriodStart: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        canManageBilling: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Usuario sin tenant o sin suscripción' })
  getSubscription(@Req() req: { user?: { tenantId?: string | null } }) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'Solo los usuarios de una empresa pueden ver la facturación. Los administradores de plataforma usan el panel proveedor.',
      );
    }
    return this.billing.getSubscriptionForTenant(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('portal-session')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear sesión del portal de facturación Stripe',
    description:
      'Genera una URL de Stripe Customer Portal para que el usuario gestione método de pago, facturas y suscripción. Redirigir al usuario a la URL devuelta.',
  })
  @ApiResponse({
    status: 201,
    description: 'URL del portal',
    schema: {
      type: 'object',
      properties: { url: { type: 'string', format: 'uri' } },
    },
  })
  @ApiResponse({ status: 400, description: 'Sin suscripción Stripe o Stripe no configurado' })
  async createPortalSession(
    @Req() req: { user?: { tenantId?: string | null } },
    @Body() dto: CreatePortalSessionDto,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'Solo los usuarios de una empresa pueden abrir el portal de facturación.',
      );
    }
    const baseUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const returnUrl =
      dto.returnUrl?.trim() || `${baseUrl.replace(/\/$/, '')}/settings/billing`;
    return this.billing.createPortalSession(tenantId, returnUrl);
  }
}
