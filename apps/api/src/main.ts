import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, HttpException } from '@nestjs/common';
import { config } from 'dotenv';
import { resolve } from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JsonLogger } from './common/logger/json-logger';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// Cargar .env manualmente antes de que NestJS inicie
// Intenta diferentes ubicaciones
const envPaths = [
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '../.env'),
  resolve(process.cwd(), '.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    const result = config({ path: envPath });
    if (result.parsed && Object.keys(result.parsed).length > 0) {
      envLoaded = true;
      console.log(`✓ Loaded .env from: ${envPath}`);
      break;
    }
  } catch {
    continue;
  }
}

if (!envLoaded) {
  console.warn(
    '⚠ Warning: .env file not found. Make sure DATABASE_URL is set in environment variables.',
  );
}

async function bootstrap() {
  const useJsonLog = process.env.LOG_FORMAT === 'json';
  const app = await NestFactory.create(AppModule, {
    logger: useJsonLog ? new JsonLogger() : undefined,
  });
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  // En prod sin ALLOWED_ORIGINS configurado, permitir cualquier origen. Con valores, comparación normalizada (sin barra final).
  const corsOrigin =
    isProd && allowedOrigins.length > 0
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          if (!origin) {
            return callback(null, false);
          }
          const normalized = origin.trim().replace(/\/$/, '');
          const allowed = allowedOrigins.some((o) => o === normalized);
          callback(null, allowed);
        }
      : true;

  // Correlation / Request ID (útil para debugging y trazabilidad)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const r = req as Request & { requestId?: string };
    const headerId =
      req.get('x-request-id') ||
      (typeof req.headers['x-request-id'] === 'string'
        ? req.headers['x-request-id']
        : undefined);
    const requestId =
      headerId && headerId.trim().length > 0 ? headerId : randomUUID();
    r.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Request-Id'],
  });
  // Filtro global de excepciones para respuestas consistentes
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        // Personalizar mensajes de validación (incluye DTOs anidados: items[0].qty, etc.)
        const joinPath = (parent: string, prop: string) => {
          if (!parent) return prop;
          return /^\d+$/.test(prop)
            ? `${parent}[${prop}]`
            : `${parent}.${prop}`;
        };

        const flatten = (errs: typeof errors, parentPath = ''): string[] => {
          return errs.flatMap((err) => {
            const path = joinPath(parentPath, err.property);
            const constraints = Object.values(err.constraints || {}).map(
              (msg) => `${path}: ${msg}`,
            );
            const children = err.children?.length
              ? flatten(err.children, path)
              : [];
            return constraints.length > 0
              ? [...constraints, ...children]
              : children.length > 0
                ? children
                : [`${path} tiene un valor inválido`];
          });
        };

        const messages = flatten(errors);
        return new HttpException(
          {
            message: messages,
            error: 'Validation Error',
            statusCode: 400,
          },
          400,
        );
      },
    }),
  );

  // Configurar Swagger/OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sistema Comercial Eléctrica API')
    .setDescription(
      'API para gestión de inventario, ventas, caja, clientes y facturación electrónica DIAN',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa el token JWT',
        in: 'header',
      },
      'JWT-auth', // Este nombre se usará en los decoradores @ApiBearerAuth()
    )
    .addTag('auth', 'Endpoints de autenticación')
    .addTag('catalog', 'Gestión de catálogo (productos y categorías)')
    .addTag('customers', 'Gestión de clientes')
    .addTag('inventory', 'Gestión de inventario y movimientos de stock')
    .addTag('cash', 'Gestión de caja y sesiones')
    .addTag('sales', 'Gestión de ventas y facturación')
    .addTag('quotes', 'Gestión de cotizaciones')
    .addTag('reports', 'Reportes y analytics')
    .addTag('dian', 'Procesamiento de documentos DIAN')
    .addTag('backups', 'Gestión de backups')
    .addTag('audit', 'Logs de auditoría')
    .addTag('health', 'Health check y estado del sistema')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Mantener el token después de recargar
    },
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `🚀 API corriendo en: http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `📚 Documentación Swagger: http://localhost:${process.env.PORT ?? 3000}/api/docs`,
  );
}
void bootstrap();
