import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface SlowQuery {
  query: string;
  duration: number;
  timestamp: Date;
  params?: unknown;
}

/**
 * Servicio para monitorear y detectar queries lentas.
 * Registra queries que exceden un umbral configurable.
 */
@Injectable()
export class QueryPerformanceService {
  private readonly logger = new Logger(QueryPerformanceService.name);
  private readonly slowQueryThreshold: number;
  private slowQueries: SlowQuery[] = [];
  private readonly maxSlowQueries = 100; // Mantener últimas 100 queries lentas

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.slowQueryThreshold =
      this.config.get<number>('SLOW_QUERY_THRESHOLD_MS', 1000) || 1000;

    // Interceptar queries de Prisma si está habilitado
    if (this.config.get<string>('QUERY_PERFORMANCE_MONITORING') === 'true') {
      this.setupQueryInterceptor();
    }
  }

  /**
   * Configura interceptor para monitorear queries lentas.
   * Nota: Prisma no tiene hook directo, pero podemos usar eventos.
   */
  private setupQueryInterceptor() {
    // Prisma emite eventos 'query' cuando está en modo log: ['query']
    // Este servicio complementa el logging de Prisma
    this.logger.log(
      `Monitoreo de queries lentas habilitado (umbral: ${this.slowQueryThreshold}ms)`,
    );
  }

  /**
   * Registra una query lenta manualmente.
   * Útil para queries complejas o reportes.
   */
  recordSlowQuery(query: string, duration: number, params?: unknown) {
    if (duration >= this.slowQueryThreshold) {
      const slowQuery: SlowQuery = {
        query,
        duration,
        timestamp: new Date(),
        params,
      };

      this.slowQueries.push(slowQuery);

      // Mantener solo las últimas N queries
      if (this.slowQueries.length > this.maxSlowQueries) {
        this.slowQueries.shift();
      }

      this.logger.warn(
        `Query lenta detectada: ${duration}ms - ${query.substring(0, 100)}...`,
      );

      // En producción, podría enviar alerta
      if (process.env.NODE_ENV === 'production') {
        // Opcional: enviar a sistema de alertas
      }
    }
  }

  /**
   * Obtiene las queries lentas registradas.
   */
  getSlowQueries(limit = 20): SlowQuery[] {
    return this.slowQueries
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Limpia el historial de queries lentas.
   */
  clearSlowQueries() {
    this.slowQueries = [];
    this.logger.log('Historial de queries lentas limpiado');
  }

  /**
   * Analiza queries lentas y genera recomendaciones.
   */
  analyzeSlowQueries(): {
    total: number;
    averageDuration: number;
    maxDuration: number;
    recommendations: string[];
  } {
    if (this.slowQueries.length === 0) {
      return {
        total: 0,
        averageDuration: 0,
        maxDuration: 0,
        recommendations: ['No hay queries lentas registradas'],
      };
    }

    const durations = this.slowQueries.map((q) => q.duration);
    const averageDuration =
      durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);

    const recommendations: string[] = [];

    if (averageDuration > 2000) {
      recommendations.push(
        'Considerar agregar índices adicionales en tablas frecuentemente consultadas',
      );
    }

    if (maxDuration > 5000) {
      recommendations.push(
        'Revisar queries que exceden 5 segundos - considerar optimización o archivado de datos',
      );
    }

    // Detectar patrones comunes
    const queryPatterns = new Map<string, number>();
    this.slowQueries.forEach((q) => {
      const pattern = q.query.substring(0, 50); // Primeros 50 caracteres
      queryPatterns.set(pattern, (queryPatterns.get(pattern) || 0) + 1);
    });

    const mostCommonPattern = Array.from(queryPatterns.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];

    if (mostCommonPattern && mostCommonPattern[1] > 5) {
      recommendations.push(
        `Query pattern frecuente detectado: "${mostCommonPattern[0]}..." - considerar optimización específica`,
      );
    }

    return {
      total: this.slowQueries.length,
      averageDuration: Math.round(averageDuration),
      maxDuration,
      recommendations,
    };
  }
}
