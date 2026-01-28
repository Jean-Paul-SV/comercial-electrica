import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private readonly backupDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.backupDir =
      this.config.get<string>('BACKUP_DIR') || join(process.cwd(), 'backups');
  }

  /**
   * Crea un backup de la base de datos
   */
  async createBackup(): Promise<{
    id: string;
    storagePath: string;
    checksum: string;
    status: string;
  }> {
    const backupRun = await this.prisma.backupRun.create({
      data: {
        status: 'IN_PROGRESS',
      },
    });

    try {
      // Asegurar que el directorio existe
      if (!existsSync(this.backupDir)) {
        mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${timestamp}.sql`;
      const filepath = join(this.backupDir, filename);

      // Obtener DATABASE_URL
      const databaseUrl = this.config.get<string>('DATABASE_URL');
      if (!databaseUrl) {
        throw new BadRequestException('DATABASE_URL no configurada');
      }

      // Parsear DATABASE_URL para obtener componentes
      const url = new URL(databaseUrl);
      const dbName = url.pathname.slice(1);
      const dbHost = url.hostname;
      const dbPort = url.port || '5432';
      const dbUser = url.username;
      const dbPassword = url.password;

      // Detectar si pg_dump está disponible, si no, usar Docker como fallback
      let command: string;
      const env = { ...process.env, PGPASSWORD: dbPassword };

      try {
        // Intentar verificar si pg_dump está disponible
        await execAsync('pg_dump --version', { timeout: 2000 });
        // pg_dump está disponible, usarlo directamente
        command = `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F c -f "${filepath}"`;
        this.logger.log(`Usando pg_dump directamente para backup: ${backupRun.id}`);
      } catch {
        // pg_dump no está disponible, usar Docker como fallback
        // En Windows/Mac, usar host.docker.internal para conectar al host desde Docker
        // En Linux, usar --network host o la IP del host
        const dockerHost =
          process.platform === 'linux' ? dbHost : 'host.docker.internal';
        const dockerBackupPath = `/backups/${filename}`;
        const backupDirNormalized = this.backupDir.replace(/\\/g, '/');

        // Montar el directorio de backups como volumen y ejecutar pg_dump dentro del contenedor
        // Usar postgres:16-alpine para coincidir con la versión del servidor (16.11)
        command = `docker run --rm -v "${backupDirNormalized}:/backups" -e PGPASSWORD="${dbPassword}" postgres:16-alpine pg_dump -h ${dockerHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F c -f "${dockerBackupPath}"`;
        this.logger.log(
          `pg_dump no encontrado, usando Docker como fallback para backup: ${backupRun.id}`,
        );
      }

      this.logger.log(`Iniciando backup: ${backupRun.id}`);
      await execAsync(command, { env, maxBuffer: 10 * 1024 * 1024 });

      // Calcular checksum
      const fileContent = await readFile(filepath);
      const checksum = createHash('sha256').update(fileContent).digest('hex');

      // Actualizar registro
      const updated = await this.prisma.backupRun.update({
        where: { id: backupRun.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          storagePath: filepath,
          checksum,
        },
      });

      this.logger.log(
        `Backup completado: ${backupRun.id}, tamaño: ${fileContent.length} bytes`,
      );
      return {
        id: updated.id,
        storagePath: updated.storagePath!,
        checksum: updated.checksum!,
        status: updated.status,
      };
    } catch (error) {
      this.logger.error(`Error en backup ${backupRun.id}:`, error);
      await this.prisma.backupRun.update({
        where: { id: backupRun.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  /**
   * Lista todos los backups
   */
  async listBackups() {
    return this.prisma.backupRun.findMany({
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Obtiene un backup por ID
   */
  async getBackup(id: string) {
    const backup = await this.prisma.backupRun.findUnique({
      where: { id },
    });
    if (!backup) {
      throw new NotFoundException(`Backup ${id} no encontrado`);
    }
    return backup;
  }

  /**
   * Verifica la integridad de un backup
   */
  async verifyBackup(id: string): Promise<boolean> {
    const backup = await this.getBackup(id);
    if (!backup.storagePath || !backup.checksum) {
      return false;
    }

    if (!existsSync(backup.storagePath)) {
      return false;
    }

    const fileContent = await readFile(backup.storagePath);
    const currentChecksum = createHash('sha256')
      .update(fileContent)
      .digest('hex');

    return currentChecksum === backup.checksum;
  }

  /**
   * Elimina un backup
   */
  async deleteBackup(id: string): Promise<void> {
    const backup = await this.getBackup(id);
    if (backup.storagePath && existsSync(backup.storagePath)) {
      await unlink(backup.storagePath);
    }
    await this.prisma.backupRun.delete({ where: { id } });
    this.logger.log(`Backup eliminado: ${id}`);
  }

  /**
   * Job automático para crear backups periódicos
   * Se ejecuta diariamente a las 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledBackup(): Promise<void> {
    const enabled = this.config.get<string>('AUTO_BACKUP_ENABLED', 'false');
    if (enabled !== 'true') {
      this.logger.debug('Auto backup deshabilitado');
      return;
    }

    try {
      this.logger.log('Iniciando backup automático programado');
      const result = await this.createBackup();
      this.logger.log(
        `Backup automático completado: ${result.id}, checksum: ${result.checksum.substring(0, 8)}...`,
      );

      // Limpiar backups antiguos (mantener solo los últimos N)
      const maxBackups = this.config.get<number>('MAX_BACKUPS_TO_KEEP', 30);
      await this.cleanupOldBackups(maxBackups);
    } catch (error) {
      this.logger.error('Error en backup automático:', error);
    }
  }

  /**
   * Limpia backups antiguos, manteniendo solo los últimos N
   */
  private async cleanupOldBackups(maxToKeep: number): Promise<void> {
    const backups = await this.prisma.backupRun.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      skip: maxToKeep,
    });

    for (const backup of backups) {
      try {
        await this.deleteBackup(backup.id);
        this.logger.log(`Backup antiguo eliminado: ${backup.id}`);
      } catch (error) {
        this.logger.warn(`Error al eliminar backup ${backup.id}:`, error);
      }
    }

    if (backups.length > 0) {
      this.logger.log(
        `Limpieza completada: ${backups.length} backup(s) antiguo(s) eliminado(s)`,
      );
    }
  }
}
