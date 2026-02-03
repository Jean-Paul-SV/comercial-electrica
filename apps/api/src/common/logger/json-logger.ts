import { LoggerService } from '@nestjs/common';

/**
 * Logger que escribe líneas JSON (una por evento) cuando LOG_FORMAT=json.
 * Útil para agregadores de logs (ELK, Datadog, CloudWatch) y correlación.
 * Campos: timestamp (ISO), level, context, message; opcional trace para error.
 */
export class JsonLogger implements LoggerService {
  private format(level: string, message: string, context?: string, trace?: string) {
    const payload: Record<string, string> = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    if (context) payload.context = context;
    if (trace) payload.trace = trace;
    return JSON.stringify(payload);
  }

  log(message: string, context?: string) {
    console.log(this.format('log', message, context));
  }

  error(message: string, trace?: string, context?: string) {
    console.error(this.format('error', message, context, trace));
  }

  warn(message: string, context?: string) {
    console.warn(this.format('warn', message, context));
  }

  debug(message: string, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.format('debug', message, context));
    }
  }

  verbose(message: string, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.format('verbose', message, context));
    }
  }
}
