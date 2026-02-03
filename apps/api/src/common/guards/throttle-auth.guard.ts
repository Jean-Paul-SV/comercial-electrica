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
    return super.canActivate(context);
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const path = (req.url as string) ?? (req.originalUrl as string) ?? '';
    const body = req.body as { email?: string } | undefined;
    const isForgotPassword =
      path.includes('forgot-password') && body?.email && typeof body.email === 'string';
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
