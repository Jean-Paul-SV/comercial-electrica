import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DianReconciliationService } from './dian-reconciliation.service';

/**
 * Scheduler que ejecuta la reconciliación de documentos DIAN periódicamente.
 * C3.2: Consulta GetStatus para documentos SENT y actualiza BD si hay inconsistencias.
 * 
 * Ejecuta diariamente a las 10:00 AM para reconciliar documentos enviados el día anterior.
 */
@Injectable()
export class DianReconciliationScheduler {
  private readonly logger = new Logger(DianReconciliationScheduler.name);

  constructor(
    private readonly reconciliationService: DianReconciliationService,
  ) {}

  /**
   * Ejecuta la reconciliación diariamente a las 10:00 AM.
   * Cron: 0 10 * * * (10:00 AM todos los días)
   */
  @Cron('0 10 * * *')
  async reconcileDianDocuments(): Promise<void> {
    try {
      this.logger.log('Iniciando reconciliación de documentos DIAN...');
      const result = await this.reconciliationService.reconcileSentDocuments();

      this.logger.log(
        `Reconciliación completada: ${result.checked} documentos revisados, ${result.synced} sincronizados (${result.accepted} aceptados, ${result.rejected} rechazados), ${result.errors} errores`,
      );

      if (result.rejected > 0) {
        this.logger.error(
          `🚨 ${result.rejected} documentos DIAN fueron rechazados por DIAN. Revisar alertas para detalles.`,
        );
      }

      if (result.errors > 0) {
        this.logger.warn(
          `⚠️ ${result.errors} errores durante la reconciliación. Revisar logs para detalles.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error en reconciliación de documentos DIAN:',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
