import { ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Servicio centralizado para validar y obtener el tenant actual.
 * Evita repetir la misma validación en cada servicio de dominio.
 */
@Injectable()
export class TenantContextService {
  /**
   * Asegura que exista un tenantId válido.
   * Lanza ForbiddenException si no se proporciona.
   */
  ensureTenant(tenantId?: string | null): string {
    if (!tenantId) {
      throw new ForbiddenException('Tenant requerido.');
    }
    return tenantId;
  }
}

