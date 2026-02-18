import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { BillingService } from './billing.service';
import Stripe from 'stripe';

/**
 * Processor para reintentar webhooks Stripe fallidos.
 * Si un webhook falla en el controller, se encola aquí para reintento.
 */
@Processor('stripe-webhooks')
@Injectable()
export class StripeWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(StripeWebhookProcessor.name);

  constructor(private readonly billing: BillingService) {
    super();
  }

  async process(job: Job<{ event: Stripe.Event }>) {
    const { event } = job.data;
    this.logger.log(
      `Reintentando procesamiento de evento Stripe ${event.id} (${event.type})`,
    );

    try {
      await this.billing.handleStripeEvent(event);
      this.logger.log(
        `Evento Stripe ${event.id} procesado exitosamente en reintento`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Error en reintento de evento Stripe ${event.id}: ${errorMessage}`,
      );
      // Re-lanzar para que BullMQ marque el job como failed y pueda reintentar
      throw err;
    }
  }
}
