import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { config } from 'dotenv';
import { resolve } from 'path';

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
  } catch (error) {
    continue;
  }
}

if (!envLoaded) {
  console.warn('⚠ Warning: .env file not found. Make sure DATABASE_URL is set in environment variables.');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
