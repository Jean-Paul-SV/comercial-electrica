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
  private readonly isTestEnv =
    process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

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

    if (!this.isTestEnv) {
      this.logger.log(
        `[Job ${job.id}] Procesando documento DIAN: ${dianDocumentId}`,
      );
    }

    try {
      // Procesar el documento completo
      await this.dianService.processDocument(dianDocumentId);

      if (!this.isTestEnv) {
        this.logger.log(
          `[Job ${job.id}] Documento ${dianDocumentId} procesado exitosamente`,
        );
      }

      return {
        success: true,
        dianDocumentId,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // En tests, si el documento ya fue limpiado por la suite, NO reintentar (evita ruido y open handles)
      if (
        this.isTestEnv &&
        (errorMessage.includes('no encontrado') ||
          // Prisma "Record to update not found"
          error?.code === 'P2025')
      ) {
        this.logger.debug(
          `[Job ${job.id}] Saltando DIAN en tests (documento no encontrado): ${dianDocumentId}`,
        );
        return {
          success: false,
          skipped: true,
          reason: 'DOCUMENT_NOT_FOUND_IN_TESTS',
          dianDocumentId,
          processedAt: new Date().toISOString(),
        };
      }

      this.logger.error(
        `[Job ${job.id}] Error procesando documento ${dianDocumentId}: ${errorMessage}`,
        errorStack,
      );

      // El error se propaga para que BullMQ maneje los reintentos
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    if (!this.isTestEnv) {
      this.logger.log(`[Job ${job.id}] Completado exitosamente`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    if (this.isTestEnv) return;
    this.logger.error(`[Job ${job.id}] Falló: ${error.message}`, error.stack);
  }
}
