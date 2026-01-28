import { TestingModuleBuilder, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/common/services/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoleName } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Mock del AuditService que no hace nada
 * Esto evita problemas de foreign key constraints en tests
 * NOTA: El AuditService ya tiene protección interna para tests, pero este mock es una capa extra de seguridad
 */
export const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
  logCreate: jest.fn().mockResolvedValue(undefined),
  logUpdate: jest.fn().mockResolvedValue(undefined),
  logDelete: jest.fn().mockResolvedValue(undefined),
  logAccess: jest.fn().mockResolvedValue(undefined),
  logAuth: jest.fn().mockResolvedValue(undefined),
};

/**
 * Helper para configurar el módulo de testing con AuditService mockeado
 * SOLUCIÓN SIMPLIFICADA: El AuditService ya tiene protección interna, este override es redundante pero seguro
 */
export function setupTestModule(
  moduleBuilder: TestingModuleBuilder,
): TestingModuleBuilder {
  return moduleBuilder.overrideProvider(AuditService).useValue(mockAuditService);
}

/**
 * Limpia la base de datos en el orden correcto para evitar problemas de foreign keys
 * SOLUCIÓN MEJORADA: Orden seguro de eliminación con manejo de errores
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Orden: primero tablas con foreign keys, luego las referenciadas
  // Usar try-catch para cada operación para evitar que un error detenga todo el proceso
  const cleanupOperations = [
    () => prisma.auditLog.deleteMany(),
    () => prisma.dianEvent.deleteMany(),
    () => prisma.quoteItem.deleteMany(),
    () => prisma.quote.deleteMany(),
    () => prisma.saleItem.deleteMany(),
    () => prisma.sale.deleteMany(),
    () => prisma.invoice.deleteMany(),
    () => prisma.dianDocument.deleteMany(),
    () => prisma.cashMovement.deleteMany(),
    () => prisma.cashSession.deleteMany(),
    () => prisma.inventoryMovementItem.deleteMany(),
    () => prisma.inventoryMovement.deleteMany(),
    () => prisma.stockBalance.deleteMany(),
    () => prisma.backupRun.deleteMany(),
    () => prisma.product.deleteMany(),
    () => prisma.category.deleteMany(),
    () => prisma.customer.deleteMany(),
    () => prisma.user.deleteMany(),
  ];

  // Ejecutar todas las operaciones, ignorando errores individuales
  // Esto es más robusto cuando hay datos residuales de otras suites
  for (const operation of cleanupOperations) {
    try {
      await operation();
    } catch (error) {
      // Ignorar errores de FK violations - pueden ocurrir si hay datos residuales
      // que serán limpiados en la siguiente iteración
      if (error instanceof Error && error.message.includes('Foreign key constraint')) {
        // Continuar con la siguiente operación
        continue;
      }
      // Re-lanzar otros errores
      throw error;
    }
  }
}

/**
 * Helper para crear un usuario de test y obtener token de autenticación
 * SOLUCIÓN SIMPLIFICADA: Eliminada lógica redundante de verificación
 */
export async function setupTestUser(
  prisma: PrismaService,
  app: INestApplication,
  testEmail: string,
): Promise<{ token: string; userId: string }> {
  const normalizedEmail = testEmail.toLowerCase();
  const passwordHash = await argon2.hash('Test123!');

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      passwordHash,
      role: RoleName.ADMIN,
      isActive: true,
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      role: RoleName.ADMIN,
      isActive: true,
    },
  });

  // Login para obtener token
  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: normalizedEmail,
      password: 'Test123!',
    });

  // Aceptar tanto 200 como 201 (algunos endpoints retornan 201 Created)
  if ((loginResponse.status !== 200 && loginResponse.status !== 201) || !loginResponse.body?.accessToken) {
    throw new Error(
      `Login failed. Status: ${loginResponse.status}, Body: ${JSON.stringify(loginResponse.body)}`,
    );
  }

  return {
    token: loginResponse.body.accessToken,
    userId: user.id,
  };
}

/**
 * Setup completo de aplicación de test con usuario autenticado
 * SOLUCIÓN SIMPLIFICADA: Un solo helper para todo el setup común
 */
export interface TestAppSetup {
  app: INestApplication;
  prisma: PrismaService;
  authToken: string;
  userId: string;
}

export async function setupTestApp(
  moduleFixture: TestingModule,
  testEmail: string,
): Promise<TestAppSetup> {
  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  const prisma = moduleFixture.get<PrismaService>(PrismaService);
  await cleanDatabase(prisma);

  const { token, userId } = await setupTestUser(prisma, app, testEmail);

  return {
    app,
    prisma,
    authToken: token,
    userId,
  };
}
