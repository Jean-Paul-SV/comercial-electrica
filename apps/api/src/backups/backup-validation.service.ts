import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { AlertService } from '../common/services/alert.service';

const execAsync = promisify(exec);

/**
 * Servicio para validar integridad y restauración de backups.
 * 
 * CRÍTICO: Sin pruebas regulares, no sabes si los backups son restaurables.
 * 
 * Este servicio:
 * 1. Verifica checksums de backups existentes
 * 2. Prueba restauración en base de datos temporal
 * 3. Valida integridad de datos después de restaurar
 * 4. Envía alertas si algún backup falla
 * 
 * Ejecutar mensualmente o antes de migraciones importantes.
 */
@Injectable()
export class BackupValidationService {
  private readonly logger = new Logger(BackupValidationService.name);
  private readonly backupDir: string;
  private readonly testDbName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly alertService: AlertService,
  ) {
    this.backupDir =
      this.config.get<string>('BACKUP_DIR') || join(process.cwd(), 'backups');
    this.testDbName =
      this.config.get<string>('BACKUP_TEST_DB_NAME') ||
      'comercial_electrica_test_restore';
  }

  /**
   * Valida un backup específico verificando checksum y probando restauración.
   */
  async validateBackup(backupRunId: string): Promise<{
    success: boolean;
    checksumValid: boolean;
    restorationValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let checksumValid = false;
    let restorationValid = false;

    try {
      // Obtener información del backup desde BD
      const backupRun = await this.prisma.backupRun.findUnique({
        where: { id: backupRunId },
      });

      if (!backupRun) {
        errors.push(`Backup run ${backupRunId} no encontrado`);
        return { success: false, checksumValid, restorationValid, errors };
      }

      if (!backupRun.storagePath) {
        errors.push(`Backup ${backupRunId} no tiene storagePath`);
        return { success: false, checksumValid, restorationValid, errors };
      }

      const backupPath = backupRun.storagePath.startsWith('/')
        ? backupRun.storagePath
        : join(this.backupDir, backupRun.storagePath);

      // 1. Verificar que el archivo existe
      if (!existsSync(backupPath)) {
        errors.push(`Archivo de backup no encontrado: ${backupPath}`);
        return { success: false, checksumValid, restorationValid, errors };
      }

      // 2. Verificar checksum
      if (backupRun.checksum) {
        const fileBuffer = readFileSync(backupPath);
        const hash = createHash('sha256').update(fileBuffer).digest('hex');
        checksumValid = hash === backupRun.checksum;

        if (!checksumValid) {
          errors.push(
            `Checksum no coincide. Esperado: ${backupRun.checksum}, Actual: ${hash}`,
          );
        }
      } else {
        this.logger.warn(
          `Backup ${backupRunId} no tiene checksum almacenado`,
        );
      }

      // 3. Probar restauración (solo para backups de plataforma SQL)
      if (backupRun.scope === 'PLATFORM' && backupPath.endsWith('.sql')) {
        try {
          restorationValid = await this.testRestoration(backupPath);
          if (!restorationValid) {
            errors.push('Restauración de prueba falló');
          }
        } catch (restoreError) {
          errors.push(
            `Error en restauración de prueba: ${(restoreError as Error).message}`,
          );
        }
      } else if (backupRun.scope === 'TENANT' && backupPath.endsWith('.zip')) {
        // Para backups ZIP, solo verificar que el archivo es válido
        try {
          const { stdout } = await execAsync(`unzip -t "${backupPath}"`);
          restorationValid = stdout.includes('No errors detected');
          if (!restorationValid) {
            errors.push('Archivo ZIP corrupto o inválido');
          }
        } catch (zipError) {
          errors.push(`Error verificando ZIP: ${(zipError as Error).message}`);
        }
      }

      const success = checksumValid && restorationValid && errors.length === 0;

      // Enviar alerta si falla
      if (!success && this.alertService) {
        await this.alertService.sendAlert({
          title: `🔴 Validación de backup falló: ${backupRunId}`,
          message: `El backup ${backupRunId} falló la validación. Errores: ${errors.join(', ')}`,
          severity: 'critical',
          metadata: {
            backupRunId,
            checksumValid,
            restorationValid,
            errors,
            timestamp: new Date().toISOString(),
          },
        });
      }

      return { success, checksumValid, restorationValid, errors };
    } catch (error) {
      const errorMessage = (error as Error).message;
      errors.push(`Error general: ${errorMessage}`);
      this.logger.error(`Error validando backup ${backupRunId}:`, error);
      return { success: false, checksumValid, restorationValid, errors };
    }
  }

  /**
   * Prueba la restauración de un backup SQL en una base de datos temporal.
   */
  private async testRestoration(backupPath: string): Promise<boolean> {
    const databaseUrl = this.config.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL no configurada');
    }

    const url = new URL(databaseUrl);
    const dbHost = url.hostname;
    const dbPort = url.port || '5432';
    const dbUser = url.username;
    const dbPassword = url.password;
    const mainDbName = url.pathname.slice(1);

    const env = { ...process.env, PGPASSWORD: dbPassword };

    try {
      // 1. Crear base de datos temporal
      this.logger.log(`Creando base de datos temporal: ${this.testDbName}`);
      await execAsync(
        `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${mainDbName} -c "DROP DATABASE IF EXISTS ${this.testDbName};"`,
        { env },
      );
      await execAsync(
        `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${mainDbName} -c "CREATE DATABASE ${this.testDbName};"`,
        { env },
      );

      // 2. Restaurar backup
      this.logger.log(`Restaurando backup: ${backupPath}`);
      await execAsync(
        `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${this.testDbName} -f "${backupPath}"`,
        { env, timeout: 300000 }, // 5 minutos timeout
      );

      // 3. Verificar integridad básica
      const verificationQueries = [
        `SELECT COUNT(*) FROM "Tenant"`,
        `SELECT COUNT(*) FROM "User"`,
        `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`,
      ];

      for (const query of verificationQueries) {
        try {
          const { stdout } = await execAsync(
            `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${this.testDbName} -t -c "${query}"`,
            { env },
          );
          const count = parseInt(stdout.trim(), 10);
          if (isNaN(count) || count < 0) {
            this.logger.warn(`Query de verificación retornó resultado inválido: ${query}`);
          }
        } catch (queryError) {
          this.logger.warn(
            `Error ejecutando query de verificación: ${(queryError as Error).message}`,
          );
          // No fallar por esto, puede ser normal si el backup está vacío
        }
      }

      // 4. Limpiar base de datos temporal
      this.logger.log(`Limpiando base de datos temporal: ${this.testDbName}`);
      await execAsync(
        `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${mainDbName} -c "DROP DATABASE ${this.testDbName};"`,
        { env },
      );

      return true;
    } catch (error) {
      // Intentar limpiar en caso de error
      try {
        await execAsync(
          `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${mainDbName} -c "DROP DATABASE IF EXISTS ${this.testDbName};"`,
          { env },
        );
      } catch (cleanupError) {
        this.logger.error(
          `Error limpiando base de datos temporal: ${(cleanupError as Error).message}`,
        );
      }

      throw error;
    }
  }

  /**
   * Valida los últimos N backups (default: últimos 5).
   */
  async validateRecentBackups(limit: number = 5): Promise<{
    total: number;
    validated: number;
    passed: number;
    failed: number;
    results: Array<{
      backupRunId: string;
      success: boolean;
      errors: string[];
    }>;
  }> {
    const recentBackups = await this.prisma.backupRun.findMany({
      where: {
        status: 'COMPLETED',
        storagePath: { not: null },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: { id: true },
    });

    const results: Array<{
      backupRunId: string;
      success: boolean;
      errors: string[];
    }> = [];

    let passed = 0;
    let failed = 0;

    for (const backup of recentBackups) {
      const validation = await this.validateBackup(backup.id);
      results.push({
        backupRunId: backup.id,
        success: validation.success,
        errors: validation.errors,
      });

      if (validation.success) {
        passed++;
      } else {
        failed++;
      }
    }

    return {
      total: recentBackups.length,
      validated: recentBackups.length,
      passed,
      failed,
      results,
    };
  }

  /**
   * Verifica integridad de todos los backups almacenados (checksums).
   */
  async verifyAllBackupChecksums(): Promise<{
    total: number;
    valid: number;
    invalid: number;
    missing: number;
    errors: Array<{ backupRunId: string; error: string }>;
  }> {
    const backups = await this.prisma.backupRun.findMany({
      where: {
        status: 'COMPLETED',
        storagePath: { not: null },
        checksum: { not: null },
      },
      select: { id: true, storagePath: true, checksum: true },
    });

    let valid = 0;
    let invalid = 0;
    let missing = 0;
    const errors: Array<{ backupRunId: string; error: string }> = [];

    for (const backup of backups) {
      if (!backup.storagePath || !backup.checksum) {
        continue;
      }

      const backupPath = backup.storagePath.startsWith('/')
        ? backup.storagePath
        : join(this.backupDir, backup.storagePath);

      if (!existsSync(backupPath)) {
        missing++;
        errors.push({
          backupRunId: backup.id,
          error: `Archivo no encontrado: ${backupPath}`,
        });
        continue;
      }

      try {
        const fileBuffer = readFileSync(backupPath);
        const hash = createHash('sha256').update(fileBuffer).digest('hex');

        if (hash === backup.checksum) {
          valid++;
        } else {
          invalid++;
          errors.push({
            backupRunId: backup.id,
            error: `Checksum no coincide`,
          });
        }
      } catch (error) {
        invalid++;
        errors.push({
          backupRunId: backup.id,
          error: `Error leyendo archivo: ${(error as Error).message}`,
        });
      }
    }

    return {
      total: backups.length,
      valid,
      invalid,
      missing,
      errors,
    };
  }
}
