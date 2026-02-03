import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MODULE_KEY = 'requireModule';

/**
 * Especifica uno o más módulos requeridos. El tenant debe tener al menos uno habilitado.
 * Ej: @RequireModule('inventory') o @RequireModule('suppliers')
 */
export const RequireModule = (...moduleCodes: string[]) =>
  SetMetadata(REQUIRE_MODULE_KEY, moduleCodes);
