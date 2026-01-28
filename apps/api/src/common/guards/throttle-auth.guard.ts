import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Guard personalizado para rate limiting
 * Permite diferentes límites para usuarios autenticados vs no autenticados
 */
@Injectable()
export class ThrottleAuthGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    // Si el usuario está autenticado, usar su ID como tracker
    // Esto permite límites más altos para usuarios autenticados
    const user = req.user as { sub?: string } | undefined;
    if (user?.sub) {
      return Promise.resolve(`auth:${user.sub}`);
    }
    // Si no está autenticado, usar IP
    const connection = req.connection as { remoteAddress?: string } | undefined;
    return Promise.resolve(
      (req.ip as string) || connection?.remoteAddress || 'unknown',
    );
  }
}
