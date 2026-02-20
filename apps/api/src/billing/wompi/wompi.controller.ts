import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WompiService } from './wompi.service';
import { CreateWompiTransactionDto } from './dto/create-wompi-transaction.dto';
import { WompiTransactionResponseDto } from './dto/create-wompi-transaction.dto';

@ApiTags('billing')
@Controller('billing/wompi')
export class WompiController {
  private readonly logger = new Logger(WompiController.name);

  constructor(private readonly wompi: WompiService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Configuración pública de Wompi',
    description:
      'Indica si Wompi está habilitado y devuelve la llave pública para tokenizar tarjetas en el front. No requiere auth para que el checkout pueda cargar.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        publicKey: { type: 'string', nullable: true },
      },
    },
  })
  getConfig() {
    return {
      enabled: this.wompi.isConfigured(),
      publicKey: this.wompi.getPublicKey(),
    };
  }

  @Get('acceptance-tokens')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Tokens de aceptación Wompi',
    description:
      'Obtiene los tokens de aceptación de términos y datos personales para crear una transacción. El usuario debe aceptar explícitamente en la UI antes de pagar.',
  })
  @ApiResponse({ status: 200, description: 'Tokens y enlaces a PDFs de términos.' })
  async getAcceptanceTokens() {
    return this.wompi.getMerchantAcceptanceTokens();
  }

  @Post('transaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear transacción Wompi para suscripción',
    description:
      'Crea una transacción en Wompi para pagar el plan seleccionado. Devuelve transactionId y, si aplica, async_payment_url para redirigir al usuario (PSE, Bancolombia, etc.). Para NEQUI/CARD el estado se consulta por polling.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transacción creada',
    type: WompiTransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Wompi no configurado o datos inválidos.' })
  @ApiResponse({ status: 404, description: 'Plan o suscripción no encontrados.' })
  async createTransaction(
    @Req() req: { user?: { tenantId?: string | null }; ip?: string; headers?: { 'x-forwarded-for'?: string } },
    @Body() dto: CreateWompiTransactionDto,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'Solo los usuarios de una empresa pueden crear un pago con Wompi.',
      );
    }
    const clientIp =
      req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip;
    return this.wompi.createSubscriptionTransaction(tenantId, dto, clientIp);
  }

  @Get('transaction/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Consultar estado de transacción Wompi',
    description:
      'Consulta el estado en Wompi. Si el estado es APPROVED, activa la suscripción automáticamente. Usar para polling desde el front.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        status_message: { type: 'string', nullable: true },
        async_payment_url: { type: 'string', nullable: true },
        activated: { type: 'boolean', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Transacción no encontrada.' })
  async getTransaction(
    @Req() req: { user?: { tenantId?: string | null } },
    @Param('id') transactionId: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Se requiere tenant.');
    }
    return this.wompi.getTransactionAndConfirmIfApproved(
      transactionId,
      tenantId,
    );
  }
}
