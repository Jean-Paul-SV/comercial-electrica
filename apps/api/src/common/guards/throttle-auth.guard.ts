import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Guard personalizado para rate limiting.
 * - En desarrollo: no aplica límites.
 * - En producción: solo limita POST /auth/forgot-password (3 por 15 min por email).
 *   El resto de rutas no se limitan para evitar 429 al navegar (ventas, reportes, etc.).
 */
@Injectable()
export class ThrottleAuthGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ method?: string; url?: string; originalUrl?: string }>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const normalizedPath = path.replace(/^\/+/, '') || '/';
    const isForgotPassword =
      req.method === 'POST' &&
      (normalizedPath === 'auth/forgot-password' || normalizedPath === '/auth/forgot-password');
    if (!isForgotPassword) {
      return true;
    }
    return super.canActivate(context);
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const path = (req.url as string) ?? (req.originalUrl as string) ?? '';
    const body = req.body as { email?: string } | undefined;
    const isForgotPassword =
      path.includes('forgot-password') &&
      body?.email &&
      typeof body.email === 'string';
    if (isForgotPassword) {
      const email = String(body.email).toLowerCase().trim();
      return Promise.resolve(`forgot:${email}`);
    }

    const user = req.user as { sub?: string } | undefined;
    if (user?.sub) {
      return Promise.resolve(`auth:${user.sub}`);
    }
    const connection = req.connection as { remoteAddress?: string } | undefined;
    return Promise.resolve(
      (req.ip as string) || connection?.remoteAddress || 'unknown',
    );
  }
}
