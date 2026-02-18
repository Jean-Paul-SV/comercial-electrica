import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantContextService } from '../common/services/tenant-context.service';
import type { CreatePayuPaymentInput } from './payu.service';
import { PayuService } from './payu.service';

@ApiTags('payu')
@Controller('payu')
export class PayuController {
  constructor(
    private readonly payu: PayuService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('payments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async createPayment(
    @Body() body: CreatePayuPaymentInput,
    @Req() req: { user?: { sub?: string; tenantId?: string | null } },
  ) {
    const tenantId = this.tenantContext.ensureTenant(
      req.user?.tenantId ?? null,
    );
    const userId = req.user?.sub ?? null;
    return this.payu.createPaymentForTenant(body, tenantId, userId);
  }

  /**
   * URL de confirmación PayU. Configurar esta URL en el panel PayU (confirmationUrl).
   * PayU envía POST con state, referenceCode, transactionId, etc.
   */
  @Post('webhook')
  @ApiExcludeEndpoint()
  async payuWebhook(@Body() body: Record<string, unknown>) {
    await this.payu.handleConfirmation(body);
    return { received: true };
  }
}
