import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

/**
 * Módulo que valida variables de entorno críticas al iniciar la aplicación.
 * Lanza errores si faltan variables requeridas en producción.
 */
@Global()
@Module({})
export class ConfigValidationModule implements OnModuleInit {
  private readonly logger = new Logger(ConfigValidationModule.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.validateCriticalConfig();
  }

  private validateCriticalConfig() {
    const isProd = process.env.NODE_ENV === 'production';
    const errors: string[] = [];

    // Variables críticas siempre requeridas
    const requiredVars = [
      { key: 'DATABASE_URL', description: 'URL de conexión a la base de datos' },
      { key: 'JWT_ACCESS_SECRET', description: 'Secret para firmar tokens JWT' },
    ];

    // Variables requeridas solo en producción
    const prodOnlyVars: Array<{ key: string; description: string; condition?: () => boolean }> = [
      {
        key: 'STRIPE_WEBHOOK_SECRET',
        description: 'Secret para validar webhooks de Stripe',
        condition: () => !!this.config.get<string>('STRIPE_SECRET_KEY'),
      },
    ];

    // Validar variables siempre requeridas
    for (const { key, description } of requiredVars) {
      const value = this.config.get<string>(key);
      if (!value || value.trim().length === 0) {
        errors.push(`${key} (${description})`);
      }
    }

    // Validar variables requeridas solo en producción
    if (isProd) {
      for (const { key, description, condition } of prodOnlyVars) {
        // Si hay una condición, solo validar si se cumple
        if (condition && !condition()) {
          continue;
        }
        const value = this.config.get<string>(key);
        if (!value || value.trim().length === 0) {
          errors.push(`${key} (${description})`);
        }
      }
    }

    // Si hay errores, lanzar excepción
    if (errors.length > 0) {
      const errorMessage = `Variables de entorno faltantes o vacías:\n${errors.map(e => `  - ${e}`).join('\n')}\n\nConfigura estas variables antes de iniciar la aplicación.`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.log('Validación de configuración completada exitosamente');
  }
}
