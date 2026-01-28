import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import { Request, Response } from 'express';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - start;
        const route =
          (req.route && typeof req.route.path === 'string' && req.route.path) ||
          req.path ||
          req.url;
        this.metrics.recordHttpRequest({
          method: req.method,
          route,
          statusCode: res.statusCode,
          durationMs,
        });
      }),
    );
  }
}

