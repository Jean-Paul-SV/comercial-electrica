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
import { createWriteStream } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { TenantModulesService } from '../auth/tenant-modules.service';

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
  ) {
    this.backupDir =
      this.config.get<string>('BACKUP_DIR') || join(process.cwd(), 'backups');
  }

  private getBackupPolicyForPlanSlug(
    planSlug: string | null | undefined,
  ):
    | { tier: 'basic'; daysPerWeek: 1 | 2 | 3; retentionDays: number; maxToKeep: number }
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
      return { tier: 'basic', daysPerWeek: 1, retentionDays: 30, maxToKeep: 12 };
    }
    if (slug === 'premium-sin-dian') {
      return { tier: 'basic', daysPerWeek: 2, retentionDays: 45, maxToKeep: 24 };
    }
    if (slug === 'basico-con-dian') {
      return { tier: 'basic', daysPerWeek: 3, retentionDays: 60, maxToKeep: 36 };
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

  private getStableWeekdays(tenantId: string, daysPerWeek: 1 | 2 | 3): number[] {
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

  private async hasTenantBackupToday(tenantId: string): Promise<boolean> {
    const start = this.startOfToday();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const count = await this.prisma.backupRun.count({
      where: {
        tenantId,
        scope: 'TENANT',
        status: 'COMPLETED',
        startedAt: { gte: start, lt: end },
      },
    });
    return count > 0;
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
    }

    if (await this.hasTenantBackupToday(tenantId)) {
      throw new BadRequestException('Ya existe un backup de hoy para tu empresa.');
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
      await this.assertTenantBackupAllowed(tenantId!);
    }
    const tidForRun = isTenantBackup
      ? tenantId!
      : (await this.prisma.tenant.findFirst({ select: { id: true } }))?.id;
    if (!tidForRun) throw new BadRequestException('No hay tenant para el backup.');
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
          this.logger.log(`Usando pg_dump directamente para backup: ${backupRun.id}`);
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
      throw error;
    }
  }

  /**
   * Exporta todos los datos del tenant a un ZIP con un CSV por tabla.
   */
  private async createTenantCsvZip(tenantId: string, zipPath: string): Promise<void> {
    const toRecord = (row: Record<string, unknown>): Record<string, unknown> => {
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

    const tables: { name: string; getData: () => Promise<Record<string, unknown>[]> }[] = [
      {
        name: 'categories',
        getData: async () =>
          (await this.prisma.category.findMany({ where: { tenantId } })).map(toRecord),
      },
      {
        name: 'products',
        getData: async () =>
          (await this.prisma.product.findMany({ where: { tenantId } })).map(toRecord),
      },
      {
        name: 'customers',
        getData: async () =>
          (await this.prisma.customer.findMany({ where: { tenantId } })).map(toRecord),
      },
      {
        name: 'suppliers',
        getData: async () =>
          (await this.prisma.supplier.findMany({ where: { tenantId } })).map(toRecord),
      },
      {
        name: 'sales',
        getData: async () =>
          (await this.prisma.sale.findMany({ where: { tenantId } })).map(toRecord),
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
          (await this.prisma.quote.findMany({ where: { tenantId } })).map(toRecord),
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
          (await this.prisma.invoice.findMany({ where: { tenantId } })).map(toRecord),
      },
      {
        name: 'purchase_orders',
        getData: async () =>
          (await this.prisma.purchaseOrder.findMany({ where: { tenantId } })).map(toRecord),
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
          (await this.prisma.supplierInvoice.findMany({ where: { tenantId } })).map(toRecord),
      },
      {
        name: 'cash_sessions',
        getData: async () =>
          (await this.prisma.cashSession.findMany({ where: { tenantId } })).map(toRecord),
      },
      {
        name: 'expenses',
        getData: async () =>
          (await this.prisma.expense.findMany({ where: { tenantId } })).map(toRecord),
      },
      {
        name: 'inventory_movements',
        getData: async () =>
          (await this.prisma.inventoryMovement.findMany({ where: { tenantId } })).map(toRecord),
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
          (await this.prisma.productDictionaryEntry.findMany({ where: { tenantId } })).map(toRecord),
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
    archive.append(
      Buffer.from(toCsv(stocks.map(toRecord)), 'utf8'),
      { name: 'stock_balances.csv' },
    );

    archive.finalize();
    await finished;
  }

  /**
   * Lista backups. Si tenantId está definido, solo los de ese tenant; si no (plataforma), todos.
   */
  async listBackups(tenantId?: string | null) {
    const where =
      typeof tenantId === 'string' && tenantId.trim() !== ''
        ? { tenantId, scope: 'TENANT' as const }
        : {};
    return this.prisma.backupRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Obtiene un backup por ID. Si tenantId está definido, solo si pertenece a ese tenant.
   */
  async getBackup(id: string, tenantId?: string | null) {
    const backup = await this.prisma.backupRun.findUnique({
      where: { id },
    });
    if (!backup) {
      throw new NotFoundException(`Backup ${id} no encontrado`);
    }
    if (typeof tenantId === 'string' && tenantId.trim() !== '') {
      if (backup.scope !== 'TENANT' || backup.tenantId !== tenantId) {
        throw new ForbiddenException('No tienes permiso para acceder a este backup.');
      }
    }
    return backup;
  }

  /**
   * Devuelve ruta y nombre para descargar. Plataforma puede descargar cualquier backup; un tenant solo el suyo.
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
   * Elimina un backup. Si tenantId está definido, solo si pertenece a ese tenant.
   */
  async deleteBackup(
    id: string,
    deletedByUserId?: string | null,
    tenantId?: string | null,
  ): Promise<void> {
    const backup = await this.getBackup(id, tenantId);
    if (backup.storagePath && existsSync(backup.storagePath)) {
      await unlink(backup.storagePath);
    }
    await this.prisma.backupRun.delete({ where: { id } });
    await this.audit.logDelete('backupRun', id, deletedByUserId ?? null, {
      storagePath: backup.storagePath ?? undefined,
      status: backup.status,
    });
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
      this.logger.log('Iniciando backups automáticos programados (tenants + plataforma)');

      await this.runScheduledTenantBackups();
      await this.cleanupScheduledTenantBackups();

      // Backup de plataforma (pg_dump completo)
      const platformResult = await this.createBackup();
      this.logger.log(
        `Backup plataforma completado: ${platformResult.id}, checksum: ${platformResult.checksum.substring(0, 8)}...`,
      );

      const maxPlatformBackups = this.config.get<number>('MAX_PLATFORM_BACKUPS_TO_KEEP', 30);
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
        await this.cleanupTenantBackups(t.id, policy.retentionDays, policy.maxToKeep);
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

    const old = await this.prisma.backupRun.findMany({
      where: {
        tenantId,
        scope: 'TENANT',
        status: 'COMPLETED',
        startedAt: { lt: cutoff },
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

    const extra = await this.prisma.backupRun.findMany({
      where: { tenantId, scope: 'TENANT', status: 'COMPLETED' },
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
    const backups = await this.prisma.backupRun.findMany({
      where: { scope: 'PLATFORM', status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      skip: maxToKeep,
      select: { id: true },
    });

    for (const backup of backups) {
      try {
        await this.deleteBackup(backup.id);
        this.logger.log(`Backup plataforma antiguo eliminado: ${backup.id}`);
      } catch (error) {
        this.logger.warn(`Error al eliminar backup plataforma ${backup.id}:`, error);
      }
    }
  }
}
