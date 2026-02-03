import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { TenantModulesService } from './tenant-modules.service';
import { JwtPayload } from './auth.service';

declare global {
  namespace Express {
    interface User extends JwtPayload {
      tenantId?: string | null;
    }
  }
}

/**
 * Rellena req.user.tenantId cuando el usuario está autenticado pero el JWT no trae tenantId (tokens antiguos).
 * Así los controladores pueden usar req.user.tenantId sin resolverlo en cada uno.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantModules: TenantModulesService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: Express.User }>();
    const user = req.user;
    if (!user?.sub || user.tenantId != null) {
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
