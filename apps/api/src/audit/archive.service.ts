import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Servicio para archivado de datos históricos.
 * - AuditLog: archiva registros antiguos (configurable, default: 2 años)
 * - Sales: archiva ventas antiguas (default: 2 años)
 *
 * Los datos archivados se pueden mover a una tabla de archivo o exportar a archivos.
 * Por ahora, se marcan con un flag o se eliminan según política de retención.
 */
@Injectable()
export class ArchiveService {
  private readonly logger = new Logger(ArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Archiva registros de AuditLog más antiguos que el período de retención.
   * Por defecto: 2 años (730 días).
   * Eventos fiscales/críticos se mantienen mínimo 5 años según normativa DIAN.
   */
  async archiveAuditLogs(): Promise<{
    archived: number;
    deleted: number;
    errors: number;
  }> {
    const retentionDays = parseInt(
      this.config.get<string>('AUDIT_RETENTION_DAYS', '730'),
      10,
    );
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Eventos fiscales/críticos: mínimo 5 años (1825 días)
    const fiscalCutoffDate = new Date();
    fiscalCutoffDate.setDate(fiscalCutoffDate.getDate() - 1825);

    this.logger.log(
      `Iniciando archivado de AuditLogs anteriores a ${cutoffDate.toISOString()}`,
    );

    let archived = 0;
    let deleted = 0;
    let errors = 0;

    try {
      // Identificar registros a archivar (no fiscales/críticos)
      const nonFiscalLogs = await this.prisma.auditLog.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          category: {
            notIn: ['fiscal', 'critical', 'dian'],
          },
          severity: {
            notIn: ['critical'],
          },
        },
        select: { id: true },
        take: 1000, // Procesar en lotes
      });

      // Identificar registros fiscales/críticos antiguos (más de 5 años)
      const oldFiscalLogs = await this.prisma.auditLog.findMany({
        where: {
          createdAt: { lt: fiscalCutoffDate },
          OR: [
            { category: { in: ['fiscal', 'critical', 'dian'] } },
            { severity: 'critical' },
          ],
        },
        select: { id: true },
        take: 100, // Menos frecuentes, procesar menos
      });

      // Por ahora, eliminamos registros no fiscales antiguos
      // En producción, podrías moverlos a una tabla de archivo o exportarlos
      if (nonFiscalLogs.length > 0) {
        const deleteResult = await this.prisma.auditLog.deleteMany({
          where: {
            id: { in: nonFiscalLogs.map((l) => l.id) },
          },
        });
        deleted += deleteResult.count;
        this.logger.log(
          `Eliminados ${deleteResult.count} registros de AuditLog no fiscales antiguos`,
        );
      }

      // Los registros fiscales/críticos se mantienen más tiempo
      // Solo eliminamos si tienen más de 5 años
      if (oldFiscalLogs.length > 0) {
        const deleteFiscalResult = await this.prisma.auditLog.deleteMany({
          where: {
            id: { in: oldFiscalLogs.map((l) => l.id) },
          },
        });
        deleted += deleteFiscalResult.count;
        this.logger.log(
          `Eliminados ${deleteFiscalResult.count} registros fiscales/críticos antiguos (>5 años)`,
        );
      }

      archived = nonFiscalLogs.length + oldFiscalLogs.length;
    } catch (error) {
      this.logger.error('Error en archivado de AuditLogs:', error);
      errors += 1;
    }

    return { archived, deleted, errors };
  }

  /**
   * Archiva ventas antiguas (más de 2 años por defecto).
   * Las ventas se pueden archivar moviendo datos a una tabla de resumen
   * o exportando a archivos antes de eliminar.
   */
  async archiveOldSales(): Promise<{
    archived: number;
    errors: number;
  }> {
    const retentionYears = parseInt(
      this.config.get<string>('SALES_RETENTION_YEARS', '2'),
      10,
    );
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

    this.logger.log(
      `Iniciando archivado de ventas anteriores a ${cutoffDate.toISOString()}`,
    );

    let archived = 0;
    let errors = 0;

    try {
      // Identificar ventas antiguas
      const oldSales = await this.prisma.sale.findMany({
        where: {
          soldAt: { lt: cutoffDate },
          status: 'PAID', // Solo ventas pagadas (completadas)
        },
        select: {
          id: true,
          tenantId: true,
          soldAt: true,
          grandTotal: true,
        },
        take: 500, // Procesar en lotes
      });

      if (oldSales.length === 0) {
        this.logger.log('No hay ventas antiguas para archivar');
        return { archived: 0, errors: 0 };
      }

      // Por ahora, solo registramos las ventas a archivar
      // En producción, podrías:
      // 1. Crear registros de resumen en una tabla `ArchivedSale`
      // 2. Exportar a archivos CSV/JSON
      // 3. Mover a almacenamiento frío (S3 Glacier, etc.)

      this.logger.log(
        `Identificadas ${oldSales.length} ventas antiguas para archivar`,
      );

      // Ejemplo: crear resumen antes de eliminar (comentado por seguridad)
      // await this.createSalesSummary(oldSales);

      archived = oldSales.length;

      // NOTA: No eliminamos ventas automáticamente por seguridad.
      // Descomentar solo después de implementar backup/exportación:
      // await this.prisma.sale.deleteMany({
      //   where: { id: { in: oldSales.map(s => s.id) } }
      // });
    } catch (error) {
      this.logger.error('Error en archivado de ventas:', error);
      errors += 1;
    }

    return { archived, errors };
  }

  /**
   * Ejecuta el proceso completo de archivado.
   */
  async runArchiveProcess(): Promise<{
    auditLogs: { archived: number; deleted: number; errors: number };
    sales: { archived: number; errors: number };
  }> {
    this.logger.log('Iniciando proceso de archivado completo');

    const auditLogs = await this.archiveAuditLogs();
    const sales = await this.archiveOldSales();

    this.logger.log(
      `Proceso de archivado completado: AuditLogs=${auditLogs.deleted} eliminados, Ventas=${sales.archived} identificadas`,
    );

    return { auditLogs, sales };
  }
}
