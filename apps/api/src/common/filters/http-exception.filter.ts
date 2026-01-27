import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../dto/error-response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error = 'Internal Server Error';
    let details: Record<string, any> | undefined;

    // Manejar diferentes tipos de excepciones
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (
          Array.isArray(responseObj.message)
            ? responseObj.message
            : (responseObj.message as string) || exception.message
        ) as string | string[];
        error = (responseObj.error as string) || exception.name;
        details = responseObj.details as Record<string, unknown> | undefined;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // Construir respuesta estandarizada
    const errorResponse: ErrorResponseDto = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details && { details }),
    };

    // Logging estructurado
    const requestWithUser = request as Request & { user?: { sub?: string } };
    const logContext = {
      statusCode: status,
      path: request.url,
      method: request.method,
      userId: requestWithUser.user?.sub,
      ip: request.ip,
      userAgent: request.get('user-agent') || undefined,
    };

    const messageStr = Array.isArray(message) ? message.join(', ') : message;
    const statusCode = Number(status);

    if (statusCode >= 500) {
      // Errores del servidor - log completo con stack trace
      this.logger.error(
        `${request.method} ${request.url} - ${statusCode} - ${messageStr}`,
        exception instanceof Error
          ? exception.stack
          : JSON.stringify(exception),
        JSON.stringify(logContext),
      );
    } else if (statusCode >= 400) {
      // Errores del cliente - log de advertencia
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${messageStr}`,
        JSON.stringify(logContext),
      );
    }

    // Enviar respuesta
    response.status(status).json(errorResponse);
  }
}
