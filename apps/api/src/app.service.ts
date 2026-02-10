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
    return 'Sistema Comercial Eléctrica API v1.0';
  }

  async getHealth() {
    const startTime = Date.now();
    let dbStatus = 'unknown';
    let redisStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
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

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
      this.logger.error('Database health check failed:', error);
    }

    try {
      redisStatus = await this.cache.ping();
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

    const overallOk =
      dbStatus === 'connected' &&
      redisStatus === 'connected' &&
      Object.values(queues).every((q) => q.status === 'connected');

    return {
      status: overallOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: dbStatus,
        redis: redisStatus,
        queues,
        responseTime: `${responseTime}ms`,
      },
    };
  }

  async getStats(tenantId: string | null) {
    if (!tenantId) {
      throw new BadRequestException('Tenant requerido para obtener estadísticas');
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
