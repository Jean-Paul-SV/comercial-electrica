import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as express from 'express';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BillingService } from './billing.service';
import Stripe from 'stripe';

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

  constructor(
    private readonly billing: BillingService,
    @InjectQueue('stripe-webhooks') private readonly webhookQueue: Queue,
  ) {}

  /** GET solo para comprobar que la URL existe; Stripe envía POST. */
  @Get('stripe')
  @ApiExcludeEndpoint()
  stripeWebhookGet(@Res({ passthrough: true }) res: express.Response) {
    return { ok: true, message: 'Webhook Stripe: Stripe envía eventos por POST a esta URL.' };
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async stripeWebhook(
    @Req() req: RequestWithRawBody,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<{ received: boolean }> {
    // Validar configuración en producción
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !this.billing.isWebhookConfigured()) {
      this.logger.error('STRIPE_WEBHOOK_SECRET no configurado en producción');
      res.status(500).json({ error: 'Webhook no configurado' });
      return { received: false };
    }

    const signature = req.headers['stripe-signature'] as string | undefined;
    const rawBody =
      req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : undefined);

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

      // Encolar para reintento automático (máximo 3 intentos con backoff exponencial)
      try {
        await this.webhookQueue.add(
          `stripe-event-${event.id}`,
          { event },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000, // 5s, 10s, 20s
            },
            removeOnComplete: {
              age: 86400, // Mantener completados por 24h
            },
            removeOnFail: {
              age: 604800, // Mantener fallidos por 7 días para debugging
            },
          },
        );
        this.logger.log(
          `Evento Stripe ${event.id} encolado para reintento automático`,
        );
      } catch (queueErr) {
        this.logger.error(
          `Error encolando evento Stripe ${event.id} para reintento: ${(queueErr as Error).message}`,
        );
      }

      // Responder 200 a Stripe para evitar reenvíos inmediatos
      // El evento se procesará en segundo plano
      return { received: true };
    }

    return { received: true };
  }
}
