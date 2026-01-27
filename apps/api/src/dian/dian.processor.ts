import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DianService } from './dian.service';

/**
 * Processor/Worker para procesar la cola DIAN
 * 
 * Este worker procesa los trabajos encolados en la cola 'dian'
 * y ejecuta el procesamiento completo de documentos DIAN
 */
@Processor('dian')
export class DianProcessor extends WorkerHost {
  private readonly logger = new Logger(DianProcessor.name);

  constructor(private readonly dianService: DianService) {
    super();
  }

  /**
   * Procesa trabajos de tipo 'send' de la cola DIAN
   * Este método es llamado automáticamente por BullMQ cuando hay trabajos en la cola
   * 
   * @param job - Trabajo que contiene el dianDocumentId a procesar
   */
  async process(job: Job<{ dianDocumentId: string }>) {
    const { dianDocumentId } = job.data;

    this.logger.log(`[Job ${job.id}] Procesando documento DIAN: ${dianDocumentId}`);

    try {
      // Procesar el documento completo
      await this.dianService.processDocument(dianDocumentId);

      this.logger.log(`[Job ${job.id}] Documento ${dianDocumentId} procesado exitosamente`);

      return {
        success: true,
        dianDocumentId,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[Job ${job.id}] Error procesando documento ${dianDocumentId}: ${error.message}`,
        error.stack,
      );

      // El error se propaga para que BullMQ maneje los reintentos
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`[Job ${job.id}] Completado exitosamente`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`[Job ${job.id}] Falló: ${error.message}`, error.stack);
  }
}
