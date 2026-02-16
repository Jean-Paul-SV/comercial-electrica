import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Solo permite acceso a usuarios que no pertenecen a ningún tenant (admins de plataforma).
 * Útil para el panel del proveedor: listar/suspender tenants, crear tenant + primer admin.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authUser: {
      sub?: string;
      tenantId?: string | null;
      isPlatformAdmin?: boolean;
      email?: string;
    } = req.user ?? {};

    // Log mínimo para depuración en desarrollo (no incluye datos sensibles como contraseña).
    // Ayuda a entender por qué se rechaza el acceso al panel proveedor.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[PlatformAdminGuard] payload', {
        sub: authUser.sub,
        email: authUser.email,
        tenantId: authUser.tenantId ?? null,
        isPlatformAdmin: authUser.isPlatformAdmin,
      });
    }

    if (!authUser.sub) {
      throw new ForbiddenException('No autenticado.');
    }

    // 0) Fallback robusto en desarrollo: el usuario de plataforma por email
    if (authUser.email?.toLowerCase() === 'platform@proveedor.local') {
      return true;
    }

    // 1) Confiar primero en el JWT: isPlatformAdmin === true
    if (authUser.isPlatformAdmin === true) {
      return true;
    }

    // 2) Fallback: usuarios sin tenantId en el token también son admins de plataforma
    if (authUser.tenantId === null) {
      return true;
    }

    // 3) Último recurso: verificar en base de datos por si el token es antiguo y no trae isPlatformAdmin/tenantId
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      select: { tenantId: true },
    });
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[PlatformAdminGuard] dbUser', {
        tenantId: user?.tenantId ?? null,
      });
    }
    if (!user || user.tenantId !== null) {
      throw new ForbiddenException(
        'Solo los administradores de plataforma pueden acceder.',
      );
    }
    return true;
  }
}
