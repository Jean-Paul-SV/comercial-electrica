import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { runWithAuditContext } from '../audit/audit-context';

/**
 * Establece el contexto de auditoría (requestId, ip, userAgent) por request
 * para que AuditService pueda registrarlo sin recibir el request explícitamente.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const ip =
      (req.ip as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.socket?.remoteAddress as string) ||
      undefined;
    const userAgent = (req.headers['user-agent'] as string)?.slice(0, 500);

    const auditContext = { requestId, ip, userAgent };

    return new Observable((subscriber) => {
      runWithAuditContext(auditContext, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
