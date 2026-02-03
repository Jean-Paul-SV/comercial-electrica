import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Especifica uno o más permisos (resource:action). El usuario debe tener al menos uno.
 * Ej: @RequirePermission('sales:create') o @RequirePermission('audit:read', 'backups:manage')
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
