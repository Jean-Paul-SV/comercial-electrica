import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../common/services/audit.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import { createWriteStream, statSync } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { TenantModulesService } from '../auth/tenant-modules.service';
import { AlertService } from '../common/services/alert.service';

const execAsync = promisify(exec);

/** Escapa un valor para CSV (comillas si contiene coma, comilla o salto de línea). */
function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Convierte un array de objetos en texto CSV con cabecera. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\n');
}

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private readonly backupDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly tenantModules: TenantModulesService,
    private readonly alertService: AlertService,
  ) {
    this.backupDir =
      this.config.get<string>('BACKUP_DIR') || join(process.cwd(), 'backups');
  }

  private getBackupPolicyForPlanSlug(planSlug: string | null | undefined):
    | {
        tier: 'basic';
        daysPerWeek: 1 | 2 | 3;
        retentionDays: number;
        maxToKeep: number;
      }
    | { tier: 'daily'; retentionDays: number; maxToKeep: number }
    | { tier: 'daily_retention'; retentionDays: number; maxToKeep: number } {
    const slug = (planSlug ?? '').trim().toLowerCase();

    // Política acordada:
    // Básico sin DIAN  -> basic (1 día/semana)
    // Premium sin DIAN -> basic (2 días/semana)
    // Básico con DIAN  -> basic (3 días/semana)
    // Premium con DIAN -> daily
    // Enterprise       -> daily_retention
    if (slug === 'basico-sin-dian') {
      return {
        tier: 'basic',
        daysPerWeek: 1,
        retentionDays: 30,
        maxToKeep: 12,
      };
    }
    if (slug === 'premium-sin-dian') {
      return {
        tier: 'basic',
        daysPerWeek: 2,
        retentionDays: 45,
        maxToKeep: 24,
      };
    }
    if (slug === 'basico-con-dian') {
      return {
        tier: 'basic',
        daysPerWeek: 3,
        retentionDays: 60,
        maxToKeep: 36,
      };
    }
    if (slug === 'premium-con-dian') {
      return { tier: 'daily', retentionDays: 90, maxToKeep: 120 };
    }
    if (slug === 'enterprise' || slug === 'all') {
      return { tier: 'daily_retention', retentionDays: 365, maxToKeep: 400 };
    }

    // Fallback conservador (si hay backups por add-on o tenant legacy):
    return { tier: 'basic', daysPerWeek: 1, retentionDays: 30, maxToKeep: 12 };
  }

  private getStableWeekdays(
    tenantId: string,
    daysPerWeek: 1 | 2 | 3,
  ): number[] {
    // Distribución estable por tenant (evita que todos corran el mismo día).
    const base = createHash('sha256').update(tenantId).digest()[0] % 7; // 0..6
    if (daysPerWeek === 1) return [base];
    if (daysPerWeek === 2) return [base, (base + 3) % 7].sort((a, b) => a - b);
    return [base, (base + 2) % 7, (base + 4) % 7].sort((a, b) => a - b);
  }

  private startOfToday(d = new Date()): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private async hasTenantBackupToday(tenantId: string, excludeDeleted: boolean = false): Promise<boolean> {
    const start = this.startOfToday();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    // Para planes Enterprise, excluir backups eliminados para permitir crear otro después de eliminar
    // Para otros planes, contar incluso backups eliminados (soft delete) para prevenir abuso
    const count = await this.prisma.backupRun.count({
      where: {
        tenantId,
        scope: 'TENANT',
        status: 'COMPLETED',
        startedAt: { gte: start, lt: end },
        ...(excludeDeleted ? { deletedAt: null } : {}),
      },
    });
    return count > 0;
  }

  /**
   * Cuenta backups creados en la semana actual (lunes a domingo) para planes básicos.
   * Incluye backups eliminados (soft delete) para prevenir abuso: crear → borrar → crear.
   */
  private async countBackupsThisWeek(tenantId: string): Promise<number> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = domingo, 1 = lunes, ...
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Lunes de esta semana
    monday.setHours(0, 0, 0, 0);
    
    // Contar TODOS los backups de la semana (incluyendo eliminados) para prevenir abuso
    return this.prisma.backupRun.count({
      where: {
        tenantId,
        scope: 'TENANT',
        startedAt: { gte: monday },
        // NO filtrar por deletedAt: contar incluso backups eliminados
      },
    });
  }

  private async assertTenantBackupAllowed(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isActive: true, plan: { select: { slug: true } } },
    });
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenException('Empresa inactiva o no encontrada.');
    }

    const enabled = await this.tenantModules.getEnabledModules(tenantId);
    if (!enabled.includes('backups')) {
      throw new ForbiddenException('Tu plan no incluye Backups.');
    }

    const policy = this.getBackupPolicyForPlanSlug(tenant.plan?.slug);
    const todayDow = new Date().getDay(); // 0..6

    if (policy.tier === 'basic') {
      const allowedDays = this.getStableWeekdays(tenantId, policy.daysPerWeek);
      if (!allowedDays.includes(todayDow)) {
        throw new ForbiddenException(
          `Tu plan permite backups ${policy.daysPerWeek} día(s) por semana. Hoy no es un día programado para tu empresa.`,
        );
      }
      
      // Contar backups creados esta semana (incluyendo eliminados) para prevenir abuso
      const backupsThisWeek = await this.countBackupsThisWeek(tenantId);
      if (backupsThisWeek >= policy.daysPerWeek) {
        throw new ForbiddenException(
          `Ya has creado ${backupsThisWeek} backup(s) esta semana. Tu plan permite ${policy.daysPerWeek} backup(s) por semana.`,
        );
      }
    }

    // Para planes Enterprise (daily_retention), permitir múltiples backups por día
    // Solo contar backups activos (no eliminados) para permitir crear otro después de eliminar
    if (policy.tier === 'daily_retention') {
      // No aplicar límite diario para Enterprise - pueden crear múltiples backups por día
      // El límite total de backups activos (maxToKeep: 400) ya previene abuso
      return;
    }

    // Para otros planes (basic y daily), mantener límite de un backup por día
    // Para daily, excluir eliminados para permitir crear otro después de eliminar
    const excludeDeleted = policy.tier === 'daily';
    if (await this.hasTenantBackupToday(tenantId, excludeDeleted)) {
      throw new BadRequestException(
        'Ya existe un backup de hoy para tu empresa.',
      );
    }
  }

  /**
   * Crea un backup: si hay tenantId, exporta CSV (ZIP) del tenant; si no (plataforma), pg_dump completo.
   */
  async createBackup(tenantId?: string | null): Promise<{
    id: string;
    storagePath: string;
    checksum: string;
    status: string;
  }> {
    const isTenantBackup =
      typeof tenantId === 'string' && tenantId.trim() !== '';
    if (isTenantBackup) {
      await this.assertTenantBackupAllowed(tenantId);
    }
    const tidForRun = isTenantBackup
      ? tenantId
      : (await this.prisma.tenant.findFirst({ select: { id: true } }))?.id;
    if (!tidForRun)
      throw new BadRequestException('No hay tenant para el backup.');
    const backupRun = await this.prisma.backupRun.create({
      data: {
        tenantId: tidForRun,
        scope: isTenantBackup ? 'TENANT' : 'PLATFORM',
        status: 'IN_PROGRESS',
      },
    });

    try {
      if (!existsSync(this.backupDir)) {
        mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let filepath: string;

      if (isTenantBackup) {
        // Backup por tenant: ZIP con CSVs (cada admin descarga los datos de su empresa)
        const filename = `backup-tenant-${timestamp}.zip`;
        filepath = join(this.backupDir, filename);
        await this.createTenantCsvZip(tidForRun, filepath);
      } else {
        // Plataforma: volcado completo con pg_dump
        const filename = `backup-${timestamp}.sql`;
        filepath = join(this.backupDir, filename);
        const databaseUrl = this.config.get<string>('DATABASE_URL');
        if (!databaseUrl) {
          throw new BadRequestException('DATABASE_URL no configurada');
        }
        const url = new URL(databaseUrl);
        const dbName = url.pathname.slice(1);
        const dbHost = url.hostname;
        const dbPort = url.port || '5432';
        const dbUser = url.username;
        const dbPassword = url.password;
        const env = { ...process.env, PGPASSWORD: dbPassword };
        let command: string;
        try {
          await execAsync('pg_dump --version', { timeout: 2000 });
          command = `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F c -f "${filepath}"`;
          this.logger.log(
            `Usando pg_dump directamente para backup: ${backupRun.id}`,
          );
        } catch {
          const dockerHost =
            process.platform === 'linux' ? dbHost : 'host.docker.internal';
          const dockerBackupPath = `/backups/${filename}`;
          const backupDirNormalized = this.backupDir.replace(/\\/g, '/');
          command = `docker run --rm -v "${backupDirNormalized}:/backups" -e PGPASSWORD="${dbPassword}" postgres:16-alpine pg_dump -h ${dockerHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F c -f "${dockerBackupPath}"`;
          this.logger.log(`pg_dump vía Docker para backup: ${backupRun.id}`);
        }
        await execAsync(command, { env, maxBuffer: 10 * 1024 * 1024 });
      }

      const fileContent = await readFile(filepath);
      const checksum = createHash('sha256').update(fileContent).digest('hex');

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

      if (!isTenantBackup) {
        await this.uploadToS3IfConfigured(filepath, updated.id).catch((err) => {
          this.logger.warn(
            `Copia off-site S3 fallida para backup ${updated.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }

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

      // Enviar alerta si las alertas están habilitadas
      const alertsEnabled = this.config.get<string>('ALERTS_ENABLED') === 'true';
      if (alertsEnabled) {
        const tenant = isTenantBackup && tidForRun
          ? await this.prisma.tenant.findUnique({
              where: { id: tidForRun },
              select: { name: true },
            })
          : null;

        await this.alertService.sendAlert({
          title: '🚨 Backup fallido',
          message: `El backup ${isTenantBackup ? 'del tenant' : 'de plataforma'} falló. ${error instanceof Error ? error.message : String(error)}`,
          severity: 'critical',
          tenantId: isTenantBackup ? tidForRun : undefined,
          tenantName: tenant?.name ?? undefined,
          metadata: {
            backupId: backupRun.id,
            scope: isTenantBackup ? 'TENANT' : 'PLATFORM',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          },
        }).catch((alertError) => {
          this.logger.error('Error enviando alerta de backup fallido:', alertError);
        });
      }

      throw error;
    }
  }

  /**
   * Exporta todos los datos del tenant a un ZIP con un CSV por tabla.
   */
  private async createTenantCsvZip(
    tenantId: string,
    zipPath: string,
  ): Promise<void> {
    const toRecord = (
      row: Record<string, unknown>,
    ): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v instanceof Date) {
          out[k] = v.toISOString();
        } else if (v != null && typeof v === 'object' && 'toNumber' in v) {
          out[k] = (v as { toNumber(): number }).toNumber();
        } else {
          out[k] = v;
        }
      }
      return out;
    };

    const archive = archiver('zip', { zlib: { level: 6 } });
    const out = createWriteStream(zipPath);
    const finished = new Promise<void>((resolve, reject) => {
      out.on('close', () => resolve());
      archive.on('error', reject);
    });
    archive.pipe(out);

    const tables: {
      name: string;
      getData: () => Promise<Record<string, unknown>[]>;
    }[] = [
      {
        name: 'categories',
        getData: async () =>
          (await this.prisma.category.findMany({ where: { tenantId } })).map(
            toRecord,
          ),
      },
      {
        name: 'products',
        getData: async () =>
          (await this.prisma.product.findMany({ where: { tenantId } })).map(
            toRecord,
          ),
      },
      {
        name: 'customers',
        getData: async () =>
          (await this.prisma.customer.findMany({ where: { tenantId } })).map(
            toRecord,
          ),
      },
      {
        name: 'suppliers',
        getData: async () =>
          (await this.prisma.supplier.findMany({ where: { tenantId } })).map(
            toRecord,
          ),
      },
      {
        name: 'sales',
        getData: async () =>
          (await this.prisma.sale.findMany({ where: { tenantId } })).map(
            toRecord,
          ),
      },
      {
        name: 'sale_items',
        getData: async () => {
          const sales = await this.prisma.sale.findMany({
            where: { tenantId },
            select: { id: true },
          });
          const ids = sales.map((s) => s.id);
          const items = await this.prisma.saleItem.findMany({
            where: { saleId: { in: ids } },
          });
          return items.map(toRecord);
        },
      },
      {
        name: 'quotes',
        getData: async () =>
          (await this.prisma.quote.findMany({ where: { tenantId } })).map(
            toRecord,
          ),
      },
      {
        name: 'quote_items',
        getData: async () => {
          const quotes = await this.prisma.quote.findMany({
            where: { tenantId },
            select: { id: true },
          });
          const items = await this.prisma.quoteItem.findMany({
            where: { quoteId: { in: quotes.map((q) => q.id) } },
          });
          return items.map(toRecord);
        },
      },
      {
        name: 'invoices',
        getData: async () =>
          (await this.prisma.invoice.findMany({ where: { tenantId } })).map(
            toRecord,
          ),
      },
      {
        name: 'purchase_orders',
        getData: async () =>
          (
            await this.prisma.purchaseOrder.findMany({ where: { tenantId } })
          ).map(toRecord),
      },
      {
        name: 'purchase_order_items',
        getData: async () => {
          const pos = await this.prisma.purchaseOrder.findMany({
            where: { tenantId },
            select: { id: true },
          });
          const items = await this.prisma.purchaseOrderItem.findMany({
            where: { purchaseOrderId: { in: pos.map((p) => p.id) } },
          });
          return items.map(toRecord);
        },
      },
      {
        name: 'supplier_invoices',
        getData: async () =>
          (
            await this.prisma.supplierInvoice.findMany({ where: { tenantId } })
          ).map(toRecord),
      },
      {
        name: 'cash_sessions',
        getData: async () =>
          (await this.prisma.cashSession.findMany({ where: { tenantId } })).map(
            toRecord,
          ),
      },
      {
        name: 'expenses',
        getData: async () =>
          (await this.prisma.expense.findMany({ where: { tenantId } })).map(
            toRecord,
          ),
      },
      {
        name: 'inventory_movements',
        getData: async () =>
          (
            await this.prisma.inventoryMovement.findMany({
              where: { tenantId },
            })
          ).map(toRecord),
      },
      {
        name: 'inventory_movement_items',
        getData: async () => {
          const movs = await this.prisma.inventoryMovement.findMany({
            where: { tenantId },
            select: { id: true },
          });
          const items = await this.prisma.inventoryMovementItem.findMany({
            where: { movementId: { in: movs.map((m) => m.id) } },
          });
          return items.map(toRecord);
        },
      },
      {
        name: 'product_dictionary_entries',
        getData: async () =>
          (
            await this.prisma.productDictionaryEntry.findMany({
              where: { tenantId },
            })
          ).map(toRecord),
      },
    ];

    for (const { name, getData } of tables) {
      const rows = await getData();
      const csv = toCsv(rows);
      archive.append(Buffer.from(csv, 'utf8'), { name: `${name}.csv` });
    }

    // Stock por producto del tenant
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    const stocks = await this.prisma.stockBalance.findMany({
      where: { productId: { in: productIds } },
    });
    archive.append(Buffer.from(toCsv(stocks.map(toRecord)), 'utf8'), {
      name: 'stock_balances.csv',
    });

    archive.finalize();
    await finished;
  }

  /**
   * Lista backups. Si tenantId está definido, solo los de ese tenant; si no (plataforma), todos.
   * Solo muestra backups activos (no eliminados con soft delete).
   */
  async listBackups(tenantId?: string | null) {
    const where =
      typeof tenantId === 'string' && tenantId.trim() !== ''
        ? { tenantId, scope: 'TENANT' as const, deletedAt: null }
        : { deletedAt: null };
    return this.prisma.backupRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Obtiene un backup por ID. Si tenantId está definido, solo si pertenece a ese tenant.
   * Solo devuelve backups activos (no eliminados con soft delete).
   * Defensa en profundidad: filtra por tenantId en la query para no cargar datos de otro tenant.
   */
  async getBackup(id: string, tenantId?: string | null) {
    const where: {
      id: string;
      deletedAt: null;
      tenantId?: string;
      scope?: 'TENANT';
    } = { id, deletedAt: null };
    if (typeof tenantId === 'string' && tenantId.trim() !== '') {
      where.tenantId = tenantId;
      where.scope = 'TENANT';
    }
    const backup = await this.prisma.backupRun.findFirst({ where });
    if (!backup) {
      throw new NotFoundException(`Backup ${id} no encontrado`);
    }
    return backup;
  }

  /**
   * Devuelve ruta y nombre para descargar. Plataforma puede descargar cualquier backup; un tenant solo el suyo.
   * Solo permite descargar backups activos (no eliminados con soft delete).
   */
  async getBackupDownload(
    id: string,
    tenantId?: string | null,
  ): Promise<{ filePath: string; fileName: string }> {
    const backup = await this.getBackup(id, tenantId ?? undefined);
    if (backup.status !== 'COMPLETED' || !backup.storagePath) {
      throw new NotFoundException(
        `Backup ${id} no está disponible para descarga (estado: ${backup.status})`,
      );
    }
    if (!existsSync(backup.storagePath)) {
      throw new NotFoundException(
        `Archivo del backup ${id} no encontrado en disco`,
      );
    }
    const started = backup.startedAt;
    const dateStr = started.toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const isZip = backup.storagePath.toLowerCase().endsWith('.zip');
    const fileName = isZip
      ? `backup-tenant-${dateStr}.zip`
      : `backup-${dateStr}.dump`;
    return { filePath: backup.storagePath, fileName };
  }

  /**
   * Verifica la integridad de un backup. Si tenantId está definido, solo del propio tenant.
   */
  async verifyBackup(id: string, tenantId?: string | null): Promise<boolean> {
    const backup = await this.getBackup(id, tenantId);
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
   * Elimina un backup (soft delete). Si tenantId está definido, solo si pertenece a ese tenant.
   * Para planes básicos, bloquea eliminación de backups recientes (últimos 7 días) para prevenir abuso.
   * Los backups eliminados se mantienen en BD para conteo de límites semanales.
   */
  async deleteBackup(
    id: string,
    deletedByUserId?: string | null,
    tenantId?: string | null,
  ): Promise<void> {
    const backup = await this.getBackup(id, tenantId);
    
    // Validar si el plan permite eliminar backups recientes (prevenir abuso: crear → borrar → crear)
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: { select: { slug: true } } },
      });
      const policy = this.getBackupPolicyForPlanSlug(tenant?.plan?.slug);
      
      // Planes básicos: no permitir borrar backups de los últimos 7 días
      if (policy.tier === 'basic') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        if (backup.startedAt >= sevenDaysAgo) {
          // Calcular cuándo podrá eliminar el backup (7 días después de su creación)
          const canDeleteAfter = new Date(backup.startedAt);
          canDeleteAfter.setDate(canDeleteAfter.getDate() + 7);
          const daysUntilCanDelete = Math.ceil(
            (canDeleteAfter.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          
          let message = 'Este backup no se puede eliminar aún. ';
          if (daysUntilCanDelete === 0) {
            message += 'Podrás eliminarlo mañana.';
          } else if (daysUntilCanDelete === 1) {
            message += 'Podrás eliminarlo mañana.';
          } else if (daysUntilCanDelete <= 7) {
            message += `Podrás eliminarlo en ${daysUntilCanDelete} días.`;
          } else {
            message += 'Podrás eliminarlo después de 7 días desde su creación.';
          }
          
          throw new ForbiddenException(message);
        }
      }
    }
    
    // Soft delete: marcar como eliminado en lugar de borrar físicamente
    // Esto permite mantener el conteo para límites semanales
    await this.prisma.backupRun.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    
    // Eliminar archivo físico del disco (opcional; puedes mantenerlo para recuperación)
    if (backup.storagePath && existsSync(backup.storagePath)) {
      await unlink(backup.storagePath).catch((err) => {
        this.logger.warn(`No se pudo eliminar archivo físico del backup ${id}: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
    
    await this.audit.logDelete('backupRun', id, deletedByUserId ?? null, {
      storagePath: backup.storagePath ?? undefined,
      status: backup.status,
    });
    this.logger.log(`Backup eliminado (soft delete): ${id}`);
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
      this.logger.log(
        'Iniciando backups automáticos programados (tenants + plataforma)',
      );

      await this.runScheduledTenantBackups();
      await this.cleanupScheduledTenantBackups();

      // Backup de plataforma (pg_dump completo)
      const platformResult = await this.createBackup();
      this.logger.log(
        `Backup plataforma completado: ${platformResult.id}, checksum: ${platformResult.checksum.substring(0, 8)}...`,
      );

      const maxPlatformBackups = this.config.get<number>(
        'MAX_PLATFORM_BACKUPS_TO_KEEP',
        30,
      );
      await this.cleanupPlatformBackups(maxPlatformBackups);
    } catch (error) {
      this.logger.error('Error en backup automático:', error);
    }
  }

  /**
   * Sube el archivo de backup a S3 si BACKUP_S3_BUCKET está configurado.
   * No lanza error: si falla, solo se registra en log (el backup local ya está creado).
   */
  private async uploadToS3IfConfigured(
    filePath: string,
    backupId: string,
  ): Promise<void> {
    const bucket = this.config.get<string>('BACKUP_S3_BUCKET');
    if (!bucket || !bucket.trim()) {
      return;
    }

    const region =
      this.config.get<string>('AWS_REGION') ||
      this.config.get<string>('AWS_DEFAULT_REGION') ||
      'us-east-1';
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    const client = new S3Client({
      region,
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          }
        : {}),
    });

    const body = await readFile(filePath);
    const key = `backups/backup-${backupId}.dump`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'application/octet-stream',
        Metadata: {
          'backup-id': backupId,
          'created-at': new Date().toISOString(),
        },
      }),
    );

    this.logger.log(`Copia off-site S3 completada: s3://${bucket}/${key}`);
  }

  /**
   * Crea backups de tenants según su plan (política estable por día de la semana).
   */
  private async runScheduledTenantBackups(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, plan: { select: { slug: true } } },
    });

    const todayDow = new Date().getDay(); // 0..6

    for (const t of tenants) {
      try {
        const enabled = await this.tenantModules.getEnabledModules(t.id);
        if (!enabled.includes('backups')) continue;

        const policy = this.getBackupPolicyForPlanSlug(t.plan?.slug);
        const alreadyToday = await this.hasTenantBackupToday(t.id);
        if (alreadyToday) continue;

        if (policy.tier === 'daily' || policy.tier === 'daily_retention') {
          await this.createBackup(t.id);
          continue;
        }

        const allowedDays = this.getStableWeekdays(t.id, policy.daysPerWeek);
        if (!allowedDays.includes(todayDow)) continue;

        await this.createBackup(t.id);
      } catch (err) {
        this.logger.warn(
          `Auto backup tenant fallido (tenantId=${t.id}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async cleanupScheduledTenantBackups(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, plan: { select: { slug: true } } },
    });

    for (const t of tenants) {
      try {
        const enabled = await this.tenantModules.getEnabledModules(t.id);
        if (!enabled.includes('backups')) continue;

        const policy = this.getBackupPolicyForPlanSlug(t.plan?.slug);
        await this.cleanupTenantBackups(
          t.id,
          policy.retentionDays,
          policy.maxToKeep,
        );
      } catch (err) {
        this.logger.warn(
          `Cleanup tenant backups fallido (tenantId=${t.id}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async cleanupTenantBackups(
    tenantId: string,
    retentionDays: number,
    maxToKeep: number,
  ): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    // Solo considerar backups activos (no eliminados) para cleanup
    const old = await this.prisma.backupRun.findMany({
      where: {
        tenantId,
        scope: 'TENANT',
        status: 'COMPLETED',
        startedAt: { lt: cutoff },
        deletedAt: null, // Solo backups activos
      },
      select: { id: true },
      orderBy: { startedAt: 'asc' },
    });

    for (const b of old) {
      try {
        await this.deleteBackup(b.id);
      } catch (err) {
        this.logger.warn(
          `Error al eliminar backup antiguo ${b.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Solo considerar backups activos para el límite maxToKeep
    const extra = await this.prisma.backupRun.findMany({
      where: {
        tenantId,
        scope: 'TENANT',
        status: 'COMPLETED',
        deletedAt: null, // Solo backups activos
      },
      orderBy: { startedAt: 'desc' },
      skip: maxToKeep,
      select: { id: true },
    });
    for (const b of extra) {
      try {
        await this.deleteBackup(b.id);
      } catch (err) {
        this.logger.warn(
          `Error al eliminar backup excedente ${b.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async cleanupPlatformBackups(maxToKeep: number): Promise<void> {
    // Solo considerar backups activos (no eliminados) para cleanup
    const backups = await this.prisma.backupRun.findMany({
      where: {
        scope: 'PLATFORM',
        status: 'COMPLETED',
        deletedAt: null, // Solo backups activos
      },
      orderBy: { startedAt: 'desc' },
      skip: maxToKeep,
      select: { id: true },
    });

    for (const backup of backups) {
      try {
        await this.deleteBackup(backup.id);
        this.logger.log(`Backup plataforma antiguo eliminado: ${backup.id}`);
      } catch (error) {
        this.logger.warn(
          `Error al eliminar backup plataforma ${backup.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Lista backups con metadatos para el panel proveedor (sin acceso al contenido).
   * Incluye información del tenant y estadísticas básicas.
   */
  async listBackupsForProvider(limit: number = 100) {
    const backups = await this.prisma.backupRun.findMany({
      where: { deletedAt: null }, // Solo backups activos
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return backups.map((b) => {
      const duration = b.finishedAt
        ? Math.round((b.finishedAt.getTime() - b.startedAt.getTime()) / 1000)
        : null;
      
      let fileSize: number | null = null;
      if (b.storagePath && existsSync(b.storagePath)) {
        try {
          fileSize = statSync(b.storagePath).size;
        } catch (err) {
          // Archivo puede haber sido eliminado o no ser accesible
          this.logger.warn(`No se pudo obtener tamaño del backup ${b.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return {
        id: b.id,
        tenantId: b.tenantId,
        tenantName: b.tenant.name,
        tenantSlug: b.tenant.slug,
        planName: b.tenant.plan?.name ?? null,
        planSlug: b.tenant.plan?.slug ?? null,
        scope: b.scope,
        status: b.status,
        startedAt: b.startedAt.toISOString(),
        finishedAt: b.finishedAt?.toISOString() ?? null,
        duration: duration, // segundos
        fileSize: fileSize, // bytes
        checksum: b.checksum,
        createdAt: b.createdAt.toISOString(),
      };
    });
  }

  /**
   * Obtiene estadísticas agregadas de backups para el panel proveedor.
   */
  async getBackupsStatistics() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Total de tenants activos
    const totalTenants = await this.prisma.tenant.count({
      where: { isActive: true },
    });

    // Tenants que han creado al menos un backup
    const tenantsWithBackups = await this.prisma.backupRun.findMany({
      where: {
        scope: 'TENANT',
        deletedAt: null,
      },
      select: { tenantId: true },
      distinct: ['tenantId'],
    });
    const tenantsWithBackupsCount = tenantsWithBackups.length;
    const tenantsNeverUsedBackups = totalTenants - tenantsWithBackupsCount;

    // Backups totales (activos)
    const totalBackups = await this.prisma.backupRun.count({
      where: { deletedAt: null },
    });

    // Backups de los últimos 30 días
    const backupsLast30Days = await this.prisma.backupRun.count({
      where: {
        deletedAt: null,
        startedAt: { gte: thirtyDaysAgo },
      },
    });

    // Backups de los últimos 7 días
    const backupsLast7Days = await this.prisma.backupRun.count({
      where: {
        deletedAt: null,
        startedAt: { gte: sevenDaysAgo },
      },
    });

    // Backups fallidos (últimos 30 días)
    const failedBackups = await this.prisma.backupRun.count({
      where: {
        status: 'FAILED',
        deletedAt: null,
        startedAt: { gte: thirtyDaysAgo },
      },
    });

    // Backups completados (últimos 30 días)
    const completedBackups = await this.prisma.backupRun.count({
      where: {
        status: 'COMPLETED',
        deletedAt: null,
        startedAt: { gte: thirtyDaysAgo },
      },
    });

    // Tasa de éxito
    const successRate =
      completedBackups + failedBackups > 0
        ? Math.round((completedBackups / (completedBackups + failedBackups)) * 100)
        : 100;

    // Promedio de backups por tenant (últimos 30 días)
    const averageBackupsPerTenant =
      tenantsWithBackupsCount > 0
        ? Math.round((backupsLast30Days / tenantsWithBackupsCount) * 10) / 10
        : 0;

    // Tamaño promedio de backups completados (últimos 30 días)
    const completedBackupsWithSize = await this.prisma.backupRun.findMany({
      where: {
        status: 'COMPLETED',
        deletedAt: null,
        startedAt: { gte: thirtyDaysAgo },
        storagePath: { not: null },
      },
      select: { storagePath: true },
    });

    let totalSize = 0;
    let backupsWithValidSize = 0;
    for (const b of completedBackupsWithSize) {
      if (b.storagePath && existsSync(b.storagePath)) {
        try {
          const size = statSync(b.storagePath).size;
          totalSize += size;
          backupsWithValidSize++;
        } catch {
          // Ignorar errores de lectura
        }
      }
    }
    const averageSize = backupsWithValidSize > 0 ? Math.round(totalSize / backupsWithValidSize) : 0;

    // Duración promedio (últimos 30 días)
    const completedBackupsWithDuration = await this.prisma.backupRun.findMany({
      where: {
        status: 'COMPLETED',
        deletedAt: null,
        startedAt: { gte: thirtyDaysAgo },
        finishedAt: { not: null },
      },
      select: { startedAt: true, finishedAt: true },
    });

    let totalDuration = 0;
    for (const b of completedBackupsWithDuration) {
      if (b.finishedAt) {
        totalDuration += Math.round((b.finishedAt.getTime() - b.startedAt.getTime()) / 1000);
      }
    }
    const averageDuration =
      completedBackupsWithDuration.length > 0
        ? Math.round(totalDuration / completedBackupsWithDuration.length)
        : 0;

    // Backups por día de la semana (últimos 30 días)
    const backupsByDay = await this.prisma.backupRun.findMany({
      where: {
        deletedAt: null,
        startedAt: { gte: thirtyDaysAgo },
      },
      select: { startedAt: true },
    });

    const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const b of backupsByDay) {
      const dayOfWeek = b.startedAt.getDay();
      dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;
    }

    return {
      totalTenants,
      tenantsWithBackups: tenantsWithBackupsCount,
      tenantsNeverUsedBackups,
      adoptionRate: totalTenants > 0 ? Math.round((tenantsWithBackupsCount / totalTenants) * 100) : 0,
      totalBackups,
      backupsLast30Days,
      backupsLast7Days,
      failedBackups,
      completedBackups,
      successRate,
      averageBackupsPerTenant,
      averageSize, // bytes
      averageDuration, // segundos
      backupsByDayOfWeek: {
        domingo: dayCounts[0],
        lunes: dayCounts[1],
        martes: dayCounts[2],
        miércoles: dayCounts[3],
        jueves: dayCounts[4],
        viernes: dayCounts[5],
        sábado: dayCounts[6],
      },
    };
  }

  /**
   * Obtiene alertas de backups para el panel proveedor (fallidos recientes, tamaños anormales, etc.).
   */
  async getBackupsAlerts() {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const alerts: Array<{
      type: 'failed' | 'large_size' | 'slow' | 'excessive_usage';
      severity: 'warning' | 'error';
      message: string;
      tenantId?: string;
      tenantName?: string;
      backupId?: string;
      details?: Record<string, unknown>;
    }> = [];

    // Backups fallidos recientes
    const failedBackups = await this.prisma.backupRun.findMany({
      where: {
        status: 'FAILED',
        deletedAt: null,
        startedAt: { gte: sevenDaysAgo },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    for (const b of failedBackups) {
      alerts.push({
        type: 'failed',
        severity: 'error',
        message: `Backup fallido para ${b.tenant.name}`,
        tenantId: b.tenantId,
        tenantName: b.tenant.name,
        backupId: b.id,
        details: {
          startedAt: b.startedAt.toISOString(),
        },
      });
    }

    // Backups con tamaño anormalmente grande (últimos 7 días)
    const completedBackups = await this.prisma.backupRun.findMany({
      where: {
        status: 'COMPLETED',
        deletedAt: null,
        startedAt: { gte: sevenDaysAgo },
        storagePath: { not: null },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: {
              select: { slug: true },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Calcular tamaño promedio para detectar anomalías
    const sizes: number[] = [];
    for (const b of completedBackups) {
      if (b.storagePath && existsSync(b.storagePath)) {
        try {
          const size = statSync(b.storagePath).size;
          sizes.push(size);
        } catch {
          // Ignorar errores
        }
      }
    }

    if (sizes.length > 0) {
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const threshold = avgSize * 3; // 3x el promedio se considera anormal

      for (const b of completedBackups) {
        if (b.storagePath && existsSync(b.storagePath)) {
          try {
            const size = statSync(b.storagePath).size;
            if (size > threshold) {
              alerts.push({
                type: 'large_size',
                severity: 'warning',
                message: `Backup inusualmente grande (${Math.round(size / 1024 / 1024)}MB) para ${b.tenant.name}`,
                tenantId: b.tenantId,
                tenantName: b.tenant.name,
                backupId: b.id,
                details: {
                  size: size,
                  averageSize: Math.round(avgSize),
                  startedAt: b.startedAt.toISOString(),
                },
              });
            }
          } catch {
            // Ignorar errores
          }
        }
      }
    }

    // Backups muy lentos (>30 minutos)
    const slowBackups = await this.prisma.backupRun.findMany({
      where: {
        status: 'COMPLETED',
        deletedAt: null,
        startedAt: { gte: sevenDaysAgo },
        finishedAt: { not: null },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    for (const b of slowBackups) {
      if (b.finishedAt) {
        const duration = Math.round((b.finishedAt.getTime() - b.startedAt.getTime()) / 1000);
        if (duration > 1800) {
          // 30 minutos
          alerts.push({
            type: 'slow',
            severity: 'warning',
            message: `Backup muy lento (${Math.round(duration / 60)} min) para ${b.tenant.name}`,
            tenantId: b.tenantId,
            tenantName: b.tenant.name,
            backupId: b.id,
            details: {
              duration: duration,
              startedAt: b.startedAt.toISOString(),
            },
          });
        }
      }
    }

    // Uso excesivo (planes básicos con muchos backups completados)
    const basicPlanBackups = await this.prisma.backupRun.findMany({
      where: {
        scope: 'TENANT',
        deletedAt: null,
        status: 'COMPLETED', // Solo backups completados cuentan para límites
        startedAt: { gte: sevenDaysAgo },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: {
              select: { slug: true },
            },
          },
        },
      },
    });

    const backupsByTenant: Record<string, { count: number; tenant: typeof basicPlanBackups[0]['tenant'] }> = {};
    for (const b of basicPlanBackups) {
      if (!backupsByTenant[b.tenantId]) {
        backupsByTenant[b.tenantId] = { count: 0, tenant: b.tenant };
      }
      backupsByTenant[b.tenantId].count++;
    }

    for (const [tenantId, data] of Object.entries(backupsByTenant)) {
      const tenant = data.tenant;
      if (tenant && tenant.plan?.slug) {
        const policy = this.getBackupPolicyForPlanSlug(tenant.plan.slug);
        if (policy.tier === 'basic' && data.count > policy.daysPerWeek * 2) {
          // Más del doble del límite semanal
          alerts.push({
            type: 'excessive_usage',
            severity: 'warning',
            message: `${tenant.name} ha creado ${data.count} backups esta semana (límite: ${policy.daysPerWeek}/semana)`,
            tenantId: tenant.id,
            tenantName: tenant.name,
            details: {
              backupsThisWeek: data.count,
              limit: policy.daysPerWeek,
            },
          });
        }
      }
    }

    return alerts.sort((a, b) => {
      // Ordenar por severidad (error primero) y luego por fecha
      if (a.severity !== b.severity) {
        return a.severity === 'error' ? -1 : 1;
      }
      return 0;
    });
  }
}
