import { Injectable } from '@nestjs/common';

type StatusBucket = '2xx' | '3xx' | '4xx' | '5xx' | 'unknown';

@Injectable()
export class MetricsService {
  private startedAt = Date.now();

  private totalRequests = 0;
  private statusBuckets: Record<StatusBucket, number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    unknown: 0,
  };

  private totalDurationMs = 0;
  private maxDurationMs = 0;

  // Cardinalidad controlada
  private byRoute: Record<string, number> = {};
  private byRouteKeys = 0;
  private readonly maxRouteKeys = 200;

  recordHttpRequest(args: {
    method?: string;
    route?: string;
    statusCode?: number;
    durationMs: number;
  }) {
    this.totalRequests += 1;
    this.totalDurationMs += args.durationMs;
    this.maxDurationMs = Math.max(this.maxDurationMs, args.durationMs);

    const sc = typeof args.statusCode === 'number' ? args.statusCode : -1;
    const bucket: StatusBucket =
      sc >= 200 && sc < 300
        ? '2xx'
        : sc >= 300 && sc < 400
          ? '3xx'
          : sc >= 400 && sc < 500
            ? '4xx'
            : sc >= 500 && sc < 600
              ? '5xx'
              : 'unknown';
    this.statusBuckets[bucket] += 1;

    const method = (args.method ?? 'UNKNOWN').toUpperCase();
    const route = args.route ?? 'UNKNOWN';
    const key = `${method} ${route}`;

    if (this.byRoute[key] === undefined) {
      if (this.byRouteKeys >= this.maxRouteKeys) return;
      this.byRouteKeys += 1;
      this.byRoute[key] = 0;
    }
    this.byRoute[key] += 1;
  }

  snapshot() {
    const uptimeSeconds = Math.round((Date.now() - this.startedAt) / 1000);
    const avgDurationMs =
      this.totalRequests > 0
        ? Math.round(this.totalDurationMs / this.totalRequests)
        : 0;

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      http: {
        totalRequests: this.totalRequests,
        statusBuckets: this.statusBuckets,
        latencyMs: {
          avg: avgDurationMs,
          max: this.maxDurationMs,
        },
        topRoutes: Object.entries(this.byRoute)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([key, count]) => ({ route: key, count })),
      },
    };
  }
}

