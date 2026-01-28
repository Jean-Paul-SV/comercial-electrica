import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Servicio de caché usando Redis
 * Proporciona métodos para cachear consultas frecuentes
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private readonly defaultTtl: number;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.defaultTtl = this.config.get<number>('CACHE_TTL_SECONDS', 300); // 5 minutos por defecto

    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  /**
   * Obtiene un valor del caché
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Guarda un valor en el caché
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds ?? this.defaultTtl;
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.warn(`Error setting cache key ${key}:`, error);
    }
  }

  /**
   * Elimina una clave del caché
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Error deleting cache key ${key}:`, error);
    }
  }

  /**
   * Elimina todas las claves que coincidan con un patrón
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      // Evitar KEYS en producción (bloquea Redis en datasets grandes).
      // Usamos SCAN por streaming para borrar por lotes.
      const stream = this.redis.scanStream({ match: pattern, count: 500 });
      const batch: string[] = [];

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          batch.push(...keys);
          if (batch.length >= 500) {
            const toDelete = batch.splice(0, batch.length);
            void this.redis.del(...toDelete);
          }
        });
        stream.on('end', async () => {
          try {
            if (batch.length > 0) {
              const toDelete = batch.splice(0, batch.length);
              await this.redis.del(...toDelete);
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        stream.on('error', (e: unknown) => reject(e));
      });
    } catch (error) {
      this.logger.warn(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  /**
   * Health check de Redis
   */
  async ping(): Promise<'connected' | 'disconnected'> {
    try {
      const res = await this.redis.ping();
      return res === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
    }
  }

  /**
   * Invalida el caché de una entidad específica
   */
  async invalidateEntity(entity: string, entityId?: string): Promise<void> {
    const pattern = entityId
      ? `cache:${entity}:${entityId}:*`
      : `cache:${entity}:*`;
    await this.deletePattern(pattern);
  }

  /**
   * Genera una clave de caché consistente
   */
  buildKey(prefix: string, ...parts: (string | number | undefined)[]): string {
    const filtered = parts.filter((p) => p !== undefined && p !== null);
    return `cache:${prefix}:${filtered.join(':')}`;
  }

  /**
   * Cierra la conexión Redis
   */
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
