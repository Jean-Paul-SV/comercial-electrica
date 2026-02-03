import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Guard personalizado para rate limiting.
 * - En desarrollo (NODE_ENV !== 'production'): no aplica límites para evitar 429 durante desarrollo.
 * - Usuarios autenticados: tracker por user id.
 * - POST /auth/forgot-password: tracker por email (límite por cuenta, no solo por IP).
 * - Resto: tracker por IP.
 */
@Injectable()
export class ThrottleAuthGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ method?: string; url?: string; originalUrl?: string }>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    if (req.method === 'GET' && (path === '' || path === '/')) {
      return true;
    }
    // No limitar login para evitar 429 al iniciar sesión desde Vercel/frontend
    if (req.method === 'POST' && (path === '/auth/login' || path === 'auth/login')) {
      return true;
    }
    // Rutas que el frontend carga al entrar al dashboard; evitar 429 en carga inicial
    const skipPaths = [
      '/auth/me',
      'auth/me',
      '/onboarding/status',
      'onboarding/status',
    ];
    if (req.method === 'GET' && skipPaths.some((p) => path === p || path.endsWith(p))) {
      return true;
    }
    if (req.method === 'GET' && (path.startsWith('/reports/') || path.startsWith('reports/'))) {
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
