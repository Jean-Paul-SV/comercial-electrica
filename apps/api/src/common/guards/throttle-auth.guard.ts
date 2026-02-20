import { Injectable, ExecutionContext } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';
import { PlanLimitsService } from '../services/plan-limits.service';

/**
 * Guard personalizado para rate limiting.
 * - En desarrollo: no aplica límites.
 * - En producción:
 *   - POST /auth/login: 50 req/min por IP (o desactivar con THROTTLE_LOGIN_DISABLED=true)
 *   - POST /auth/forgot-password: 3 por 15 min por email
 *   - GET /reports/*: límite dinámico según plan del tenant (básico: 30/min, pro: 300/min, enterprise: 1000/min)
 *   - GET /reports/export: límite dinámico según plan (básico: 10/min, pro: 100/min, enterprise: 500/min)
 *   - Resto: sin límite (navegación normal)
 */
@Injectable()
export class ThrottleAuthGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerOptions[],
    storageService: any,
    reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {
    super(options, storageService, reflector);
  }

  private getPlanLimitsService(): PlanLimitsService {
    return this.moduleRef.get(PlanLimitsService, { strict: false });
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      originalUrl?: string;
      user?: { sub?: string; tenantId?: string | null };
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

    // Bootstrap admin: límite muy estricto por IP (evitar abuso)
    const isBootstrap =
      req.method === 'POST' &&
      (normalizedPath === 'auth/bootstrap-admin' ||
        normalizedPath === '/auth/bootstrap-admin');
    if (isBootstrap) {
      return super.canActivate(context);
    }

    // Reset password y accept-invite (públicos con token): límite por IP
    const isPublicToken =
      req.method === 'POST' &&
      (normalizedPath === 'auth/reset-password' ||
        normalizedPath === '/auth/reset-password' ||
        normalizedPath === 'auth/accept-invite' ||
        normalizedPath === '/auth/accept-invite');
    if (isPublicToken) {
      return super.canActivate(context);
    }

    // Reportes y export: límite dinámico según plan del tenant
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

  /**
   * Sobrescribe el límite dinámicamente según el plan del tenant para endpoints costosos.
   */
  protected async getLimit(context: ExecutionContext): Promise<number> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      originalUrl?: string;
      user?: { sub?: string; tenantId?: string | null };
    }>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const normalizedPath = path.replace(/^\/+/, '') || '/';

    // Endpoints costosos que requieren rate limiting por tenant
    const isExpensiveReport =
      req.method === 'GET' &&
      (normalizedPath.startsWith('reports/') ||
        normalizedPath === 'reports/export');
    
    const isExpensiveExport =
      req.method === 'GET' &&
      (normalizedPath.includes('/export') ||
        normalizedPath.includes('/download'));
    
    const isDianProcessing =
      req.method === 'POST' &&
      (normalizedPath.startsWith('dian/') ||
        normalizedPath.includes('/process') ||
        normalizedPath.includes('/send'));
    
    const isBackupCreation =
      req.method === 'POST' && normalizedPath === 'backups';
    
    const isBulkOperation =
      req.method === 'POST' &&
      (normalizedPath.includes('/bulk') ||
        normalizedPath.includes('/batch'));

    const isExpensiveOperation =
      isExpensiveReport ||
      isExpensiveExport ||
      isDianProcessing ||
      isBackupCreation ||
      isBulkOperation;

    if (isExpensiveOperation && req.user?.tenantId) {
      try {
        const planLimitsService = this.getPlanLimitsService();
        const planLimit = await planLimitsService.getRateLimitForTenant(
          req.user.tenantId,
        );

        // Para exports y downloads, usar 1/3 del límite de reportes
        if (isExpensiveExport) {
          return Math.max(1, Math.floor(planLimit / 3));
        }

        // Para procesamiento DIAN, usar límite más estricto (1/2 del límite del plan)
        if (isDianProcessing) {
          return Math.max(5, Math.floor(planLimit / 2));
        }

        // Para backups, usar límite muy estricto (1/10 del límite del plan)
        if (isBackupCreation) {
          return Math.max(1, Math.floor(planLimit / 10));
        }

        // Para operaciones bulk, usar límite estricto (1/5 del límite del plan)
        if (isBulkOperation) {
          return Math.max(2, Math.floor(planLimit / 5));
        }

        // Para reportes normales, usar el límite del plan
        return planLimit;
      } catch (error) {
        // Si hay error obteniendo el servicio o el límite, usar límite por defecto
        // Esto puede pasar si el servicio no está disponible o hay problemas de BD
        return 100;
      }
    }

    // Para otros endpoints, usar el límite por defecto del throttler configurado
    return 100;
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const path = (req.url as string) ?? (req.originalUrl as string) ?? '';
    const body = req.body as { email?: string } | undefined;

    // Login: por IP
    if (path.includes('auth/login') && (req.method as string) === 'POST') {
      const connection = req.connection as
        | { remoteAddress?: string }
        | undefined;
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

    // Endpoints costosos: por tenantId para rate limiting por tenant
    const user = req.user as
      | { sub?: string; tenantId?: string | null }
      | undefined;
    
    const isExpensivePath =
      path.startsWith('reports/') ||
      path.includes('/export') ||
      path.includes('/download') ||
      path.startsWith('dian/') ||
      path === 'backups' ||
      path.includes('/bulk') ||
      path.includes('/batch');
    
    if (user?.tenantId && isExpensivePath) {
      return Promise.resolve(`tenant:${user.tenantId}`);
    }
    
    // Reportes legacy: por userId si no hay tenantId
    if (user?.sub && path.startsWith('reports/')) {
      const tenantKey = user.tenantId ?? user.sub;
      return Promise.resolve(`tenant:${tenantKey}`);
    }

    // Default: por IP
    const connection = req.connection as { remoteAddress?: string } | undefined;
    return Promise.resolve(
      (req.ip as string) || connection?.remoteAddress || 'unknown',
    );
  }
}
