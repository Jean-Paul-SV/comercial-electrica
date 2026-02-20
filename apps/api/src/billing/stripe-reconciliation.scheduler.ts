import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service';

/**
 * Scheduler que ejecuta la reconciliación de suscripciones Stripe periódicamente.
 * C1.1: Sincroniza BD con Stripe cuando hay inconsistencias detectadas.
 * 
 * Ejecuta cada 6 horas para corregir inconsistencias sin sobrecargar Stripe API.
 */
@Injectable()
export class StripeReconciliationScheduler {
  private readonly logger = new Logger(StripeReconciliationScheduler.name);

  constructor(private readonly billingService: BillingService) {}

  /**
   * Ejecuta la reconciliación cada hora (reducido de 6h para reducir ventana de pérdida).
   * CRÍTICO: Ventana de 6 horas = pérdida potencial de ingresos si webhooks fallan.
   * Cron: cada hora (00:00, 01:00, 02:00, ..., 23:00)
   */
  @Cron('0 * * * *')
  async reconcileStripeSubscriptions(): Promise<void> {
    try {
      this.logger.log('Iniciando reconciliación de suscripciones Stripe...');
      const result = await this.billingService.reconcileStripeSubscriptions();
      
      this.logger.log(
        `Reconciliación completada: ${result.checked} revisadas, ${result.synced} sincronizadas, ${result.errors} errores`,
      );
      
      if (result.errors > 0) {
        this.logger.warn(
          `⚠️ ${result.errors} suscripciones tienen errores de reconciliación. Revisar logs para detalles.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error en reconciliación de suscripciones Stripe:',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * C2.4: Reconciliación proactiva de pagos no reconocidos.
   * Detecta facturas pagadas en Stripe que no fueron procesadas en BD.
   * CRÍTICO: Reduce ventana de pérdida de ingresos si webhooks fallan.
   * Cron: cada hora (00:15, 01:15, 02:15, ..., 23:15)
   */
  @Cron('15 * * * *')
  async reconcilePaidInvoices(): Promise<void> {
    try {
      this.logger.log('Iniciando reconciliación proactiva de pagos...');
      const result = await this.billingService.reconcilePaidInvoices();

      this.logger.log(
        `Reconciliación de pagos completada: ${result.checked} facturas revisadas, ${result.paidNotRecognized} pagos no reconocidos, ${result.activated} suscripciones activadas, ${result.errors} errores`,
      );

      if (result.paidNotRecognized > 0) {
        this.logger.warn(
          `⚠️ ${result.paidNotRecognized} pagos no reconocidos detectados. ${result.activated} suscripciones activadas manualmente. Revisar webhooks Stripe.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error en reconciliación proactiva de pagos:',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * C2.1: Ejecuta la reconciliación de facturas abiertas diariamente.
   * Detecta facturas pendientes que no fueron notificadas por webhooks.
   * Cron: diariamente a las 8:00 AM
   */
  @Cron('0 8 * * *')
  async reconcileOpenInvoices(): Promise<void> {
    try {
      this.logger.log('Iniciando reconciliación de facturas abiertas...');
      const result = await this.billingService.reconcileOpenInvoices();
      
      this.logger.log(
        `Reconciliación de facturas completada: ${result.checked} suscripciones revisadas, ${result.openInvoices} facturas abiertas detectadas, ${result.notified} suscripciones actualizadas, ${result.alertsSent} alertas enviadas`,
      );

      if (result.openInvoices > 0) {
        this.logger.warn(
          `⚠️ ${result.openInvoices} facturas abiertas detectadas. ${result.alertsSent} alertas enviadas. Revisar logs para detalles.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error en reconciliación de facturas abiertas:',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
