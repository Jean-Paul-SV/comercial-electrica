import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { TenantModulesService } from './tenant-modules.service';
import { JwtPayload } from './auth.service';

/* eslint-disable @typescript-eslint/no-namespace -- Express.User augmentation requires namespace */
declare global {
  namespace Express {
    interface User extends JwtPayload {
      tenantId?: string | null;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

/**
 * Rellena req.user.tenantId cuando el usuario está autenticado pero el JWT no trae tenantId (tokens antiguos).
 * Así los controladores pueden usar req.user.tenantId sin resolverlo en cada uno.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantModules: TenantModulesService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: Express.User }>();
    const user = req.user;
    // Rellenar tenantId cuando falta (undefined) o es null (JWT antiguo o usuario sin tenant)
    const hasTenant =
      user?.tenantId !== undefined &&
      user?.tenantId !== null &&
      user?.tenantId !== '';
    if (!user?.sub || hasTenant) {
      return next.handle();
    }
    return from(this.tenantModules.getEffectiveTenantId(user.sub)).pipe(
      switchMap((tenantId) => {
        (req.user as Express.User).tenantId = tenantId ?? undefined;
        return next.handle();
      }),
    );
  }
}
