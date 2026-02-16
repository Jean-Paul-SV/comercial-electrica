import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ArchiveService } from './archive.service';

/**
 * Scheduler para ejecutar tareas de archivado periódicamente.
 * - AuditLogs: mensualmente (día 1 a las 2:00 AM)
 * - Ventas históricas: mensualmente (día 1 a las 3:00 AM)
 */
@Injectable()
export class ArchiveScheduler {
  private readonly logger = new Logger(ArchiveScheduler.name);
  private readonly isTestEnv =
    process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

  constructor(
    private readonly archiveService: ArchiveService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Ejecuta archivado de AuditLogs el primer día de cada mes a las 2:00 AM
   */
  @Cron('0 2 1 * *') // Día 1 de cada mes a las 2:00 AM
  async archiveAuditLogs() {
    if (this.isTestEnv) return;

    const enabled = this.config.get<string>('ARCHIVE_ENABLED', 'false');
    if (enabled !== 'true') {
      this.logger.debug('Archivado automático deshabilitado');
      return;
    }

    try {
      this.logger.log('Ejecutando archivado automático de AuditLogs');
      const result = await this.archiveService.archiveAuditLogs();
      this.logger.log(
        `Archivado de AuditLogs completado: ${result.deleted} eliminados, ${result.errors} errores`,
      );
    } catch (error) {
      this.logger.error('Error en archivado automático de AuditLogs:', error);
    }
  }

  /**
   * Ejecuta archivado de ventas históricas el primer día de cada mes a las 3:00 AM
   */
  @Cron('0 3 1 * *') // Día 1 de cada mes a las 3:00 AM
  async archiveOldSales() {
    if (this.isTestEnv) return;

    const enabled = this.config.get<string>('ARCHIVE_ENABLED', 'false');
    if (enabled !== 'true') {
      this.logger.debug('Archivado automático deshabilitado');
      return;
    }

    try {
      this.logger.log('Ejecutando archivado automático de ventas históricas');
      const result = await this.archiveService.archiveOldSales();
      this.logger.log(
        `Archivado de ventas completado: ${result.archived} identificadas, ${result.errors} errores`,
      );
    } catch (error) {
      this.logger.error('Error en archivado automático de ventas:', error);
    }
  }
}
