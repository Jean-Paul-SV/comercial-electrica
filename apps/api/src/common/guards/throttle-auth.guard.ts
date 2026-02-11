import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Guard personalizado para rate limiting.
 * - En desarrollo: no aplica límites.
 * - En producción:
 *   - POST /auth/login: 50 req/min por IP (o desactivar con THROTTLE_LOGIN_DISABLED=true)
 *   - POST /auth/forgot-password: 3 por 15 min por email
 *   - GET /reports/*: 30 req/min por usuario autenticado
 *   - GET /reports/export: 10 req/min por usuario autenticado
 *   - Resto: sin límite (navegación normal)
 */
@Injectable()
export class ThrottleAuthGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      originalUrl?: string;
      user?: { sub?: string };
    }>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const normalizedPath = path.replace(/^\/+/, '') || '/';

    // Login: límite por IP (puede desactivarse con THROTTLE_LOGIN_DISABLED=true si el contador no se resetea)
    const isLogin =
      req.method === 'POST' &&
      (normalizedPath === 'auth/login' || normalizedPath === '/auth/login');
    if (isLogin) {
      if (process.env.THROTTLE_LOGIN_DISABLED === 'true') {
        return true;
      }
      return super.canActivate(context);
    }

    // Forgot password: límite por email
    const isForgotPassword =
      req.method === 'POST' &&
      (normalizedPath === 'auth/forgot-password' ||
        normalizedPath === '/auth/forgot-password');
    if (isForgotPassword) {
      return super.canActivate(context);
    }

    // Reportes y export: límite por usuario autenticado
    const isExpensiveReport =
      req.method === 'GET' &&
      (normalizedPath.startsWith('reports/') ||
        normalizedPath === 'reports/export');
    if (isExpensiveReport && req.user?.sub) {
      return super.canActivate(context);
    }

    // Resto: sin límite (navegación normal)
    return true;
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const path = (req.url as string) ?? (req.originalUrl as string) ?? '';
    const body = req.body as { email?: string } | undefined;

    // Login: por IP
    if (
      path.includes('auth/login') &&
      (req.method as string) === 'POST'
    ) {
      const connection = req.connection as { remoteAddress?: string } | undefined;
      return Promise.resolve(
        (req.ip as string) || connection?.remoteAddress || 'unknown',
      );
    }

    // Forgot password: por email
    if (
      path.includes('forgot-password') &&
      body?.email &&
      typeof body.email === 'string'
    ) {
      const email = String(body.email).toLowerCase().trim();
      return Promise.resolve(`forgot:${email}`);
    }

    // Reportes: por userId
    const user = req.user as { sub?: string } | undefined;
    if (user?.sub && path.startsWith('reports/')) {
      return Promise.resolve(`user:${user.sub}`);
    }

    // Default: por IP
    const connection = req.connection as { remoteAddress?: string } | undefined;
    return Promise.resolve(
      (req.ip as string) || connection?.remoteAddress || 'unknown',
    );
  }
}
