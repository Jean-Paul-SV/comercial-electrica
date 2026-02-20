import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupValidationService } from './backup-validation.service';

/**
 * Scheduler que ejecuta validación periódica de backups.
 * 
 * CRÍTICO: Sin pruebas regulares, no sabes si los backups son restaurables.
 * 
 * Ejecuta mensualmente para validar que los backups pueden restaurarse.
 * También verifica checksums semanalmente.
 */
@Injectable()
export class BackupValidationScheduler {
  private readonly logger = new Logger(BackupValidationScheduler.name);

  constructor(
    private readonly backupValidation: BackupValidationService,
  ) {}

  /**
   * Verifica checksums de todos los backups semanalmente.
   * Cron: Cada domingo a las 3:00 AM
   */
  @Cron('0 3 * * 0')
  async verifyBackupChecksums(): Promise<void> {
    try {
      this.logger.log('Iniciando verificación de checksums de backups...');
      const result = await this.backupValidation.verifyAllBackupChecksums();

      this.logger.log(
        `Verificación de checksums completada: ${result.total} backups revisados, ${result.valid} válidos, ${result.invalid} inválidos, ${result.missing} faltantes`,
      );

      if (result.invalid > 0 || result.missing > 0) {
        this.logger.error(
          `⚠️ ${result.invalid} backups con checksums inválidos, ${result.missing} backups faltantes. Revisar logs para detalles.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error en verificación de checksums de backups:',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Prueba restauración de los últimos 5 backups mensualmente.
   * CRÍTICO: Esta es la única forma de saber si los backups son restaurables.
   * Cron: Primer domingo del mes a las 4:00 AM
   */
  @Cron('0 4 1-7 * 0')
  async validateRecentBackups(): Promise<void> {
    try {
      this.logger.log('Iniciando validación de restauración de backups recientes...');
      const result = await this.backupValidation.validateRecentBackups(5);

      this.logger.log(
        `Validación de backups completada: ${result.total} backups revisados, ${result.passed} pasaron, ${result.failed} fallaron`,
      );

      if (result.failed > 0) {
        this.logger.error(
          `⚠️ ${result.failed} backups fallaron la validación. Revisar logs para detalles.`,
        );
        result.results
          .filter((r) => !r.success)
          .forEach((r) => {
            this.logger.error(
              `Backup ${r.backupRunId} falló: ${r.errors.join(', ')}`,
            );
          });
      } else {
        this.logger.log('✅ Todos los backups validados exitosamente');
      }
    } catch (error) {
      this.logger.error(
        'Error en validación de backups recientes:',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
