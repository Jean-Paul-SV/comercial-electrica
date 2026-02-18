import { TestingModuleBuilder, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/common/services/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoleName } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

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
  return moduleBuilder
    .overrideProvider(AuditService)
    .useValue(mockAuditService);
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
    // Proveedores / compras / cuentas por pagar (FK -> padres)
    () => prisma.supplierPayment.deleteMany(),
    () => prisma.supplierInvoice.deleteMany(),
    () => prisma.purchaseOrderItem.deleteMany(),
    () => prisma.purchaseOrder.deleteMany(),
    () => prisma.quoteItem.deleteMany(),
    () => prisma.quote.deleteMany(),
    () => prisma.saleReturnItem.deleteMany(),
    () => prisma.saleReturn.deleteMany(),
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
    () => prisma.supplier.deleteMany(),
    () => prisma.userRole.deleteMany(),
    () => prisma.tenantFeedback.deleteMany(),
    () => prisma.user.deleteMany(),
    () => prisma.subscription.deleteMany(),
    () => prisma.tenantAddOn.deleteMany(),
    () => prisma.tenantModule.deleteMany(),
    () => prisma.tenant.deleteMany(),
  ];

  // Ejecutar todas las operaciones, ignorando errores individuales
  // Esto es más robusto cuando hay datos residuales de otras suites
  for (const operation of cleanupOperations) {
    try {
      await operation();
    } catch (error) {
      // Ignorar errores de FK violations - pueden ocurrir si hay datos residuales
      if (
        error instanceof Error &&
        error.message.includes('Foreign key constraint')
      ) {
        continue;
      }
      // Ignorar si la tabla no existe (migración no aplicada en esta BD)
      if (
        error instanceof Error &&
        (error.message.includes('does not exist in the current database') ||
          (error as { code?: string }).code === 'P2021')
      ) {
        continue;
      }
      throw error;
    }
  }
}

/**
 * Helper para crear un usuario de test y obtener token de autenticación.
 * Si se pasa tenantId, el usuario se asocia a ese tenant (necesario para multi-tenant).
 */
export async function setupTestUser(
  prisma: PrismaService,
  app: INestApplication,
  testEmail: string,
  tenantId?: string | null,
): Promise<{ token: string; userId: string }> {
  const normalizedEmail = testEmail.toLowerCase();
  const passwordHash = await argon2.hash('Test123!');

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      passwordHash,
      role: RoleName.ADMIN,
      isActive: true,
      ...(tenantId != null && { tenantId }),
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      role: RoleName.ADMIN,
      isActive: true,
      ...(tenantId != null && { tenantId }),
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
  if (
    (loginResponse.status !== 200 && loginResponse.status !== 201) ||
    !loginResponse.body?.accessToken
  ) {
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
  tenantId: string;
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

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Default Test Tenant',
      slug: `default-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      isActive: true,
    },
  });

  const moduleCodes = [
    'core',
    'inventory',
    'suppliers',
    'electronic_invoicing',
    'advanced_reports',
    'audit',
    'backups',
  ];
  await prisma.tenantModule.createMany({
    data: moduleCodes.map((moduleCode) => ({
      tenantId: tenant.id,
      moduleCode,
      enabled: true,
    })),
  });

  const { token, userId } = await setupTestUser(
    prisma,
    app,
    testEmail,
    tenant.id,
  );

  return {
    app,
    prisma,
    authToken: token,
    userId,
    tenantId: tenant.id,
  };
}

/**
 * Setup de app para tests que requieren usuario administrador de plataforma (sin tenant).
 * Usar para E2E de backups, provider, etc.
 */
export interface TestAppSetupPlatformAdmin {
  app: INestApplication;
  prisma: PrismaService;
  authToken: string;
  userId: string;
}

export async function setupTestAppForPlatformAdmin(
  moduleFixture: TestingModule,
  testEmail: string,
): Promise<TestAppSetupPlatformAdmin> {
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

  // Un tenant mínimo para que createBackup tenga tenantId (backup de BD completa)
  await prisma.tenant.create({
    data: {
      name: 'Platform Backup Tenant',
      slug: `platform-backup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      isActive: true,
    },
  });

  const adminRole = await prisma.role.findFirst({
    where: { slug: 'admin', tenantId: null },
  });
  if (!adminRole) {
    throw new Error(
      'Rol admin (tenantId null) no encontrado. Ejecuta el seed o las migraciones.',
    );
  }

  const normalizedEmail = testEmail.toLowerCase();
  const passwordHash = await argon2.hash('Test123!');
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: RoleName.ADMIN,
      tenantId: null,
      isActive: true,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: adminRole.id,
      tenantId: null,
    },
  });

  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: normalizedEmail, password: 'Test123!' });

  if (
    (loginResponse.status !== 200 && loginResponse.status !== 201) ||
    !loginResponse.body?.accessToken
  ) {
    throw new Error(
      `Login platform admin failed. Status: ${loginResponse.status}, Body: ${JSON.stringify(loginResponse.body)}`,
    );
  }

  return {
    app,
    prisma,
    authToken: loginResponse.body.accessToken,
    userId: user.id,
  };
}

/**
 * Cierra conexiones BullMQ/Redis para que Jest pueda finalizar sin forceExit.
 * En suites E2E, esto evita "Jest did not exit one second after..." por handles abiertos.
 */
export async function closeTestQueues(app: INestApplication): Promise<void> {
  const queueNames = ['dian', 'backup', 'reports'] as const;

  for (const name of queueNames) {
    try {
      const queue = app.get<Queue>(getQueueToken(name), {
        strict: false,
      } as any);
      if (queue && typeof (queue as any).close === 'function') {
        await queue.close();
      }
    } catch {
      // Ignorar si el queue/provider no existe en este contexto
    }
  }
}

export async function shutdownTestApp(setup: {
  app?: INestApplication;
  prisma?: PrismaService;
}): Promise<void> {
  if (setup.app) {
    await closeTestQueues(setup.app);
    await setup.app.close();
  }
  if (setup.prisma) {
    await setup.prisma.$disconnect();
  }
}
