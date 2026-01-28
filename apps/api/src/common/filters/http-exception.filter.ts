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
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private mapPrismaToHttp(exception: unknown): {
    status: number;
    error: string;
    message: string;
    details?: Record<string, any>;
  } | null {
    const isProd = process.env.NODE_ENV === 'production';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaCode = exception.code;
      const meta = (exception.meta ?? {}) as Record<string, unknown>;

      // P2002: unique constraint violation
      if (prismaCode === 'P2002') {
        const target = meta.target;
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message:
            typeof target === 'string' || Array.isArray(target)
              ? `Conflicto: ya existe un registro con el mismo valor en ${String(
                  Array.isArray(target) ? target.join(', ') : target,
                )}.`
              : 'Conflicto: ya existe un registro con esos valores.',
          details: { prismaCode, target },
        };
      }

      // P2025 / P2001: record not found
      if (prismaCode === 'P2025' || prismaCode === 'P2001') {
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Recurso no encontrado.',
          details: { prismaCode, cause: meta.cause },
        };
      }

      // P2003: foreign key constraint
      if (prismaCode === 'P2003') {
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message:
            'Referencia inválida: alguno de los IDs enviados no existe o no es válido.',
          details: { prismaCode, field_name: meta.field_name },
        };
      }

      // P2000: value too long
      if (prismaCode === 'P2000') {
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Valor demasiado largo para el campo.',
          details: { prismaCode, column_name: meta.column_name },
        };
      }

      // P2011: null constraint violation
      if (prismaCode === 'P2011') {
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Falta un valor requerido (no puede ser null).',
          details: { prismaCode, constraint: meta.constraint },
        };
      }

      // P2012: missing required value
      if (prismaCode === 'P2012') {
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Faltan datos requeridos para procesar la solicitud.',
          details: { prismaCode },
        };
      }

      // P2034: write conflict / deadlock
      if (prismaCode === 'P2034') {
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message:
            'Conflicto de concurrencia (deadlock/write conflict). Intenta nuevamente.',
          details: { prismaCode },
        };
      }

      // P2021/P2022 suelen ser problemas de esquema (bug/migración): 500
      if (prismaCode === 'P2021' || prismaCode === 'P2022') {
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Error interno del servidor (esquema de base de datos).',
          details: isProd ? { prismaCode } : { prismaCode, meta },
        };
      }

      // Otros errores conocidos -> 400 por defecto
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Solicitud inválida (error de base de datos).',
        details: isProd ? { prismaCode } : { prismaCode, meta },
      };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Datos inválidos para la operación.',
        details: isProd
          ? undefined
          : { prisma: 'PrismaClientValidationError', message: exception.message },
      };
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message:
          'No se pudo conectar a la base de datos. Intenta nuevamente en unos segundos.',
        details: isProd
          ? { prisma: 'PrismaClientInitializationError' }
          : {
              prisma: 'PrismaClientInitializationError',
              errorCode: exception.errorCode,
              message: exception.message,
            },
      };
    }

    if (exception instanceof Prisma.PrismaClientRustPanicError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Error interno del servidor (motor de base de datos).',
        details: isProd
          ? { prisma: 'PrismaClientRustPanicError' }
          : { prisma: 'PrismaClientRustPanicError', message: exception.message },
      };
    }

    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Error interno del servidor (solicitud desconocida).',
        details: isProd
          ? { prisma: 'PrismaClientUnknownRequestError' }
          : { prisma: 'PrismaClientUnknownRequestError', message: exception.message },
      };
    }

    return null;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      (request as Request & { requestId?: string }).requestId ||
      request.get('x-request-id') ||
      undefined;

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

    // Prisma -> HTTP (evita 500 "raros" y da mensajes claros)
    const prismaMapped = this.mapPrismaToHttp(exception);
    if (prismaMapped) {
      status = prismaMapped.status;
      error = prismaMapped.error;
      message = prismaMapped.message;
      details = prismaMapped.details;
    }

    // Construir respuesta estandarizada
    const errorResponse: ErrorResponseDto = {
      ...(requestId && { requestId }),
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
      requestId,
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
