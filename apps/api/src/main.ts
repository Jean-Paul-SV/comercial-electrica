import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, HttpException } from '@nestjs/common';
import { config } from 'dotenv';
import { resolve } from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

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
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
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
        // Personalizar mensajes de validación
        const messages = errors.map((error) => {
          const constraints = Object.values(error.constraints || {});
          return constraints.length > 0
            ? constraints.join(', ')
            : `${error.property} tiene un valor inválido`;
        });
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
    .addTag('products', 'Gestión de productos y catálogo')
    .addTag('categories', 'Gestión de categorías')
    .addTag('customers', 'Gestión de clientes')
    .addTag('inventory', 'Gestión de inventario y movimientos de stock')
    .addTag('cash', 'Gestión de caja y sesiones')
    .addTag('sales', 'Gestión de ventas y facturación')
    .addTag('quotes', 'Gestión de cotizaciones')
    .addTag('reports', 'Reportes y analytics')
    .addTag('dian', 'Procesamiento de documentos DIAN')
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
