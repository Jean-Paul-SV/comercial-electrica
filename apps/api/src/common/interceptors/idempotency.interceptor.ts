import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, EMPTY } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CacheService } from '../services/cache.service';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 horas
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidIdempotencyKey(key: string): boolean {
  return (
    typeof key === 'string' &&
    key.trim().length > 0 &&
    UUID_REGEX.test(key.trim())
  );
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly cache: CacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const method = req.method?.toUpperCase();

    if (method !== 'POST' && method !== 'PATCH' && method !== 'PUT') {
      return next.handle();
    }

    const rawKey = req.headers['idempotency-key'];
    const key =
      typeof rawKey === 'string'
        ? rawKey.trim()
        : Array.isArray(rawKey)
          ? rawKey[0]?.trim()
          : undefined;

    if (!key || !isValidIdempotencyKey(key)) {
      return next.handle();
    }

    const cacheKey = `idempotency:${key}`;
    const cached = await this.cache.get<{ body: unknown }>(cacheKey);

    if (cached?.body !== undefined) {
      res.status(200).json(cached.body);
      return EMPTY;
    }

    return next.handle().pipe(
      tap((data) => {
        void this.cache.set(cacheKey, { body: data }, IDEMPOTENCY_TTL_SECONDS);
      }),
    );
  }
}
