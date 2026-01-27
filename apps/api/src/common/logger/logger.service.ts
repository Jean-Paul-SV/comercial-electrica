import { Injectable, Logger, LoggerService } from '@nestjs/common';

/**
 * Servicio de logging estructurado
 * Por ahora usa el Logger de NestJS integrado
 * En el futuro se puede migrar a Winston para logging a archivos
 */
@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger = new Logger('AppLogger');

  log(message: string, context?: string) {
    this.logger.log(message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, trace, context);
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, context);
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, context);
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, context);
  }
}
