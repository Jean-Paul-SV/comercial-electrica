import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service';

/**
 * Cron que aplica los cambios de plan programados (downgrades) cuando llega su fecha.
 * Ejecuta cada hora en el minuto 0.
 */
@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(private readonly billing: BillingService) {}

  @Cron('0 * * * *') // Cada hora en el minuto 0
  async applyScheduledPlanChanges(): Promise<void> {
    try {
      const { applied } = await this.billing.applyScheduledPlanChanges();
      if (applied > 0) {
        this.logger.log(`applyScheduledPlanChanges: aplicados ${applied} cambios de plan.`);
      }
    } catch (err) {
      this.logger.error(
        `applyScheduledPlanChanges falló: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
