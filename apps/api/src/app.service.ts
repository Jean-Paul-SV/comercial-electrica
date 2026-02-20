import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './common/services/cache.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @InjectQueue('dian') private readonly dianQueue: Queue,
    @InjectQueue('backup') private readonly backupQueue: Queue,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  getHello(): string {
    return 'Orion API v1.0';
  }

  async getHealth() {
    const startTime = Date.now();
    let dbStatus = 'unknown';
    let dbResponseTime: number | null = null;
    let redisStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
    let redisResponseTime: number | null = null;
    const queues: Record<
      string,
      | {
          status: 'connected';
          waiting: number;
          active: number;
          delayed: number;
          failed: number;
        }
      | { status: 'disconnected' }
    > = {};

    // Verificar base de datos con medición de tiempo y métricas de conexiones
    let dbConnections: {
      active: number;
      idle: number;
      total: number;
    } | null = null;
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - dbStart;
      dbStatus = 'connected';

      // Obtener métricas de conexiones (si está disponible)
      try {
        const connectionStats = await this.prisma.$queryRaw<
          Array<{
            state: string;
            count: bigint;
          }>
        >`
          SELECT state, COUNT(*)::bigint as count
          FROM pg_stat_activity
          WHERE datname = current_database()
          GROUP BY state
        `;
        const active = Number(
          connectionStats.find((s) => s.state === 'active')?.count || 0,
        );
        const idle = Number(
          connectionStats.find((s) => s.state === 'idle')?.count || 0,
        );
        dbConnections = {
          active,
          idle,
          total: active + idle,
        };
      } catch (connError) {
        // Si falla obtener conexiones, continuar sin esa métrica
        this.logger.debug('No se pudieron obtener métricas de conexiones:', connError);
      }
    } catch (error) {
      dbStatus = 'disconnected';
      this.logger.error('Database health check failed:', error);
    }

    // Verificar Redis con medición de tiempo
    try {
      const redisStart = Date.now();
      redisStatus = await this.cache.ping();
      redisResponseTime = Date.now() - redisStart;
    } catch (error) {
      redisStatus = 'disconnected';
      this.logger.error('Redis health check failed:', error);
    }

    const checkQueue = async (name: string, q: Queue) => {
      try {
        const counts = await q.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
        );
        queues[name] = {
          status: 'connected',
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
        };
      } catch {
        queues[name] = { status: 'disconnected' };
      }
    };

    await Promise.all([
      checkQueue('dian', this.dianQueue),
      checkQueue('backup', this.backupQueue),
      checkQueue('reports', this.reportsQueue),
    ]);

    const responseTime = Date.now() - startTime;
    const uptime = (Date.now() - this.startTime) / 1000;

    // Verificar si hay problemas críticos
    const warnings: string[] = [];
    
    // Alerta si conexiones BD están altas (80%+ del pool)
    if (dbConnections) {
      const connectionLimit = parseInt(
        process.env.DATABASE_CONNECTION_LIMIT || '50',
        10,
      );
      const connectionUsagePercent = (dbConnections.total / connectionLimit) * 100;
      if (connectionUsagePercent > 80) {
        warnings.push(
          `⚠️ Alto uso de conexiones BD: ${dbConnections.total}/${connectionLimit} (${Math.round(connectionUsagePercent)}%). ${dbConnections.active} activas, ${dbConnections.idle} idle. Considerar aumentar pool o usar PgBouncer.`,
        );
      }
    }

    // En producción, sugerir habilitar archivado si está desactivado
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ARCHIVE_ENABLED !== 'true'
    ) {
      warnings.push(
        'ℹ️ Archivado automático desactivado (ARCHIVE_ENABLED≠true). Para controlar crecimiento de BD, configurar ARCHIVE_ENABLED=true, AUDIT_RETENTION_DAYS y SALES_RETENTION_YEARS. Ver env.example.',
      );
    }

    const hasCriticalIssues =
      dbStatus !== 'connected' ||
      Object.values(queues).some((q) => (q as any).failed > 10);

    const overallOk =
      dbStatus === 'connected' &&
      redisStatus === 'connected' &&
      Object.values(queues).every((q) => q.status === 'connected') &&
      !hasCriticalIssues &&
      warnings.length === 0;

    return {
      status: overallOk ? 'ok' : hasCriticalIssues ? 'error' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          status: dbStatus,
          responseTime: dbResponseTime ? `${dbResponseTime}ms` : null,
          connections: dbConnections || undefined,
        },
        redis: {
          status: redisStatus,
          responseTime: redisResponseTime ? `${redisResponseTime}ms` : null,
        },
        queues,
        healthCheckResponseTime: `${responseTime}ms`,
      },
      warnings: hasCriticalIssues
        ? [
            dbStatus !== 'connected'
              ? 'Base de datos desconectada'
              : null,
            Object.values(queues).some((q) => (q as any).failed > 10)
              ? 'Algunas colas tienen muchos trabajos fallidos'
              : null,
          ]
            .filter(Boolean)
            .concat(warnings)
        : warnings,
    };
  }

  async getStats(tenantId: string | null) {
    if (!tenantId) {
      throw new BadRequestException(
        'Tenant requerido para obtener estadísticas',
      );
    }

    const [
      totalUsers,
      totalProducts,
      totalCustomers,
      totalSales,
      totalQuotes,
      openCashSessions,
      lowStockProducts,
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.product.count({ where: { tenantId, isActive: true } }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.sale.count({ where: { tenantId, status: 'PAID' } }),
      this.prisma.quote.count({ where: { tenantId } }),
      this.prisma.cashSession.count({ where: { tenantId, closedAt: null } }),
      this.prisma.product.count({
        where: {
          tenantId,
          isActive: true,
          stock: {
            qtyOnHand: { lte: 10 },
          },
        },
      }),
    ]);

    // Calcular ventas del día
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySales = await this.prisma.sale.aggregate({
      where: {
        tenantId,
        status: 'PAID',
        soldAt: { gte: todayStart },
      },
      _sum: {
        grandTotal: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      timestamp: new Date().toISOString(),
      tenantId,
      users: {
        total: totalUsers,
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts,
      },
      customers: {
        total: totalCustomers,
      },
      sales: {
        total: totalSales,
        today: {
          count: todaySales._count.id,
          total: Number(todaySales._sum.grandTotal || 0),
        },
      },
      quotes: {
        total: totalQuotes,
      },
      cash: {
        openSessions: openCashSessions,
      },
    };
  }
}
