import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { ValidationLimitsService } from './services/validation-limits.service';
import { CacheService } from './services/cache.service';
import { StorageService } from './services/storage.service';

/**
 * Módulo común que exporta servicios compartidos
 * Marcado como @Global() para que esté disponible en todos los módulos
 */
@Global()
@Module({
  providers: [AuditService, ValidationLimitsService, CacheService, StorageService],
  exports: [AuditService, ValidationLimitsService, CacheService, StorageService],
})
export class CommonModule {}
