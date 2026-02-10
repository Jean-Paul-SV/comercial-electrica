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
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenException('No autenticado.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });
    if (!user || user.tenantId !== null) {
      throw new ForbiddenException(
        'Solo los administradores de plataforma pueden acceder.',
      );
    }
    return true;
  }
}
