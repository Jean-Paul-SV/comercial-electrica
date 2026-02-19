import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from './cache.service';
import { AlertService } from './alert.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Servicio que monitorea la salud del sistema y envía alertas cuando detecta problemas críticos.
 * Se ejecuta periódicamente mediante un cron job.
 */
@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);
  private lastHealthStatus: 'ok' | 'degraded' | 'error' = 'ok';
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 2; // Alertar después de 2 fallos consecutivos

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    private readonly alertService: AlertService,
    @InjectQueue('dian') private readonly dianQueue: Queue,
    @InjectQueue('backup') private readonly backupQueue: Queue,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  /**
   * Verifica la salud del sistema y envía alertas si detecta problemas críticos.
   * Debe llamarse periódicamente (ej. cada 5 minutos).
   */
  async checkHealthAndAlert(): Promise<void> {
    const alertsEnabled = this.config.get<string>('ALERTS_ENABLED') === 'true';
    if (!alertsEnabled) {
      return; // Alertas deshabilitadas
    }

    const health = await this.checkHealth();
    const isHealthy = health.status === 'ok';

    // Si el estado cambió de ok a degraded/error, o si hay fallos consecutivos
    if (!isHealthy) {
      this.consecutiveFailures++;
      
      if (
        this.lastHealthStatus === 'ok' ||
        this.consecutiveFailures >= this.maxConsecutiveFailures
      ) {
        await this.sendHealthAlert(health);
      }
    } else {
      // Si se recuperó después de estar degradado
      if (this.lastHealthStatus !== 'ok') {
        await this.sendRecoveryAlert(health);
      }
      this.consecutiveFailures = 0;
    }

    this.lastHealthStatus = health.status as 'ok' | 'degraded' | 'error';
  }

  /**
   * Verifica la salud del sistema sin enviar alertas.
   */
  private async checkHealth(): Promise<{
    status: 'ok' | 'degraded' | 'error';
    issues: string[];
    details: Record<string, unknown>;
  }> {
    const issues: string[] = [];
    const details: Record<string, unknown> = {};

    // Verificar base de datos
    let dbStatus = 'unknown';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
      issues.push('Base de datos desconectada');
      details.databaseError = error instanceof Error ? error.message : String(error);
    }
    details.database = dbStatus;

    // Verificar Redis
    let redisStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
    try {
      redisStatus = await this.cache.ping();
      if (redisStatus !== 'connected') {
        issues.push('Redis desconectado');
      }
    } catch (error) {
      redisStatus = 'disconnected';
      issues.push('Redis desconectado');
      details.redisError = error instanceof Error ? error.message : String(error);
    }
    details.redis = redisStatus;

    // Verificar colas
    const queues: Record<string, unknown> = {};
    const queueChecks = [
      { name: 'dian', queue: this.dianQueue },
      { name: 'backup', queue: this.backupQueue },
      { name: 'reports', queue: this.reportsQueue },
    ];

    for (const { name, queue } of queueChecks) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        queues[name] = {
          status: 'connected',
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
        };

        // Alertar si hay muchos trabajos fallidos
        const failed = counts.failed ?? 0;
        if (failed > 10) {
          issues.push(`Cola ${name} tiene ${failed} trabajos fallidos`);
        }
      } catch (error) {
        queues[name] = { status: 'disconnected' };
        issues.push(`Cola ${name} desconectada`);
        details[`${name}QueueError`] = error instanceof Error ? error.message : String(error);
      }
    }
    details.queues = queues;

    // Determinar estado general
    const isDbOk = dbStatus === 'connected';
    const isRedisOk = redisStatus === 'connected';
    const areQueuesOk = Object.values(queues).every(
      (q: any) => q.status === 'connected',
    );

    let status: 'ok' | 'degraded' | 'error';
    if (!isDbOk) {
      status = 'error'; // DB desconectada es crítico
    } else if (!isRedisOk || !areQueuesOk) {
      status = 'degraded'; // Redis o colas desconectadas es degradación
    } else if (issues.length > 0) {
      status = 'degraded'; // Hay problemas pero no críticos
    } else {
      status = 'ok';
    }

    return { status, issues, details };
  }

  /**
   * Envía alerta cuando se detecta un problema de salud.
   */
  private async sendHealthAlert(health: {
    status: string;
    issues: string[];
    details: Record<string, unknown>;
  }): Promise<void> {
    const severity = health.status === 'error' ? 'critical' : 'warning';
    const title =
      health.status === 'error'
        ? '🚨 Sistema crítico: API o servicios desconectados'
        : '⚠️ Degradación del sistema detectada';

    await this.alertService.sendAlert({
      title,
      message: `Problemas detectados en el sistema:\n${health.issues.join('\n')}`,
      severity,
      metadata: {
        status: health.status,
        issues: health.issues,
        ...health.details,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.error(`Health check failed: ${health.issues.join(', ')}`);
  }

  /**
   * Envía alerta cuando el sistema se recupera después de estar degradado.
   */
  private async sendRecoveryAlert(health: {
    status: string;
    issues: string[];
    details: Record<string, unknown>;
  }): Promise<void> {
    await this.alertService.sendAlert({
      title: '✅ Sistema recuperado',
      message: 'El sistema ha vuelto a funcionar correctamente después de una degradación.',
      severity: 'info',
      metadata: {
        previousStatus: this.lastHealthStatus,
        currentStatus: health.status,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.log('System recovered after degradation');
  }
}
