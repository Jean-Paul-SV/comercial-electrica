import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_MODULE_KEY } from './require-module.decorator';
import { TenantModulesService } from './tenant-modules.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModulesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantModules: TenantModulesService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ user?: { sub?: string } }>();
    const userId = req.user?.sub;
    if (!userId) return false;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });
    const tenantId = user?.tenantId ?? null;

    const enabled = await this.tenantModules.getEnabledModules(tenantId);
    const hasAny = required.some((code) => enabled.includes(code));
    if (!hasAny) {
      throw new ForbiddenException(
        'Módulo no contratado. Contacte a su administrador o mejore su plan.',
      );
    }
    return true;
  }
}
