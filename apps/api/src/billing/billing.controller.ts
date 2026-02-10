import {
  Controller,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as express from 'express';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { BillingService } from './billing.service';

/** Request con body raw (para verificación de firma Stripe). */
interface RequestWithRawBody extends express.Request {
  rawBody?: Buffer;
}

/**
 * Webhook de Stripe. Debe recibir el body raw para verificar la firma.
 * En main.ts se registra express.raw() para esta ruta.
 */
@Controller('billing/webhooks')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billing: BillingService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async stripeWebhook(
    @Req() req: RequestWithRawBody,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<{ received: boolean }> {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const rawBody = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : undefined);

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.warn('Webhook Stripe recibido sin body');
      res.status(400).json({ error: 'Missing body' });
      return { received: false };
    }

    const event = this.billing.constructEvent(rawBody, signature);

    if (!event) {
      res.status(400).json({ error: 'Invalid signature' });
      return { received: false };
    }

    try {
      await this.billing.handleStripeEvent(event);
    } catch (err) {
      this.logger.error(
        `Error procesando evento ${event.id} (${event.type}): ${(err as Error).message}`,
      );
      res.status(500).json({ error: 'Webhook handler failed' });
      return { received: false };
    }

    return { received: true };
  }
}
