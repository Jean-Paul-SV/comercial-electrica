import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { URL } from 'node:url';

/** Extrae la URL de Redis si viene pegada como "redis-cli --tls -u redis://..." (Upstash). */
function normalizeRedisUrl(urlStr: string): string {
  const trimmed = urlStr.trim();
  const match = trimmed.match(/\s-u\s+(rediss?:\/\/[^\s]+)/i) ?? trimmed.match(/(rediss?:\/\/[^\s]+)/);
  return match ? (match[1] ?? trimmed).trim() : trimmed;
}

function parseRedis(urlStr: string) {
  const normalized = normalizeRedisUrl(urlStr);
  const u = new URL(normalized);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    password: u.password || undefined,
    username: u.username || undefined,
    db:
      u.pathname && u.pathname !== '/'
        ? Number(u.pathname.replace('/', ''))
        : undefined,
  };
}

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>(
          'REDIS_URL',
          'redis://localhost:6379',
        );
        const conn = parseRedis(redisUrl);
        return {
          connection: conn,
        };
      },
    }),
    BullModule.registerQueue(
      { name: 'dian' },
      { name: 'backup' },
      { name: 'reports' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
