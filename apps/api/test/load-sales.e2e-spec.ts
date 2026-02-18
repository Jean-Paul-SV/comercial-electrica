import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp, shutdownTestApp } from './test-helpers';
import * as request from 'supertest';

/**
 * Test de carga básico: Crear múltiples ventas concurrentes
 *
 * Este test verifica que el sistema puede manejar múltiples
 * requests concurrentes sin errores de integridad de datos.
 *
 * Nota: Este es un test básico. Para tests de carga más avanzados,
 * usar herramientas como k6, Artillery, o Apache Bench.
 */
describe('Load Test - Concurrent Sales (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let userId: string;
  let productId: string;
  let customerId: string;
  let cashSessionId: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    const setup = await setupTestApp(moduleFixture, 'load-test@example.com');
    ({ app, prisma } = setup);

    // Crear tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Load Test Tenant',
        slug: `load-test-${Date.now()}`,
        isActive: true,
      },
    });
    tenantId = tenant.id;

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email: 'load-test-user@example.com',
        password: '$argon2id$v=19$m=65536,t=3,p=4$test',
        name: 'Load Test User',
        tenantId,
        isActive: true,
        role: 'ADMIN',
      },
    });
    userId = user.id;

    // Login para obtener token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'load-test-user@example.com',
        password: 'Admin123!',
      });
    accessToken = loginResponse.body.accessToken;

    // Crear producto con stock suficiente
    const product = await prisma.product.create({
      data: {
        internalCode: 'LOAD-TEST-001',
        name: 'Load Test Product',
        cost: 1000,
        price: 2000,
        taxRate: 19,
        tenantId,
      },
    });
    productId = product.id;

    // Agregar stock
    await prisma.inventoryMovement.create({
      data: {
        type: 'IN',
        reason: 'Stock inicial para load test',
        tenantId,
        userId,
        items: {
          create: {
            productId,
            qty: 10000, // Stock suficiente para todas las ventas
            unitCost: 1000,
          },
        },
      },
    });

    // Crear cliente
    const customer = await prisma.customer.create({
      data: {
        docType: 'CC',
        docNumber: `LOAD-TEST-${Date.now()}`,
        name: 'Load Test Customer',
        tenantId,
      },
    });
    customerId = customer.id;

    // Crear sesión de caja
    const cashSession = await prisma.cashSession.create({
      data: {
        openingAmount: 10000000,
        tenantId,
        userId,
        status: 'OPEN',
      },
    });
    cashSessionId = cashSession.id;
  });

  afterAll(async () => {
    if (app && prisma) {
      // Limpiar datos de prueba
      await prisma.sale.deleteMany({ where: { tenantId } });
      await prisma.inventoryMovement.deleteMany({ where: { tenantId } });
      await prisma.product.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { tenantId } });
      await prisma.cashSession.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
      await shutdownTestApp({ app, prisma });
    }
  });

  describe('Concurrent Sales Creation', () => {
    it('debe manejar 50 ventas concurrentes sin errores', async () => {
      const concurrentRequests = 50;
      const requests: Promise<any>[] = [];

      // Crear múltiples requests concurrentes
      for (let i = 0; i < concurrentRequests; i++) {
        const saleRequest = request(app.getHttpServer())
          .post('/sales')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            customerId,
            cashSessionId,
            items: [
              {
                productId,
                qty: 1,
                price: 2000,
              },
            ],
          });
        requests.push(saleRequest);
      }

      // Ejecutar todos los requests concurrentemente
      const responses = await Promise.allSettled(requests);

      // Verificar resultados
      const successful = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 201,
      ).length;
      const failed = responses.filter(
        (r) =>
          r.status === 'rejected' ||
          (r.status === 'fulfilled' && r.value.status !== 201),
      ).length;

      console.log(`✅ Exitosas: ${successful}, ❌ Fallidas: ${failed}`);

      // Al menos el 95% deben ser exitosas
      expect(successful).toBeGreaterThanOrEqual(concurrentRequests * 0.95);

      // Verificar integridad de datos
      const totalSales = await prisma.sale.count({
        where: { tenantId },
      });
      expect(totalSales).toBeGreaterThanOrEqual(successful);

      // Verificar que el stock se actualizó correctamente
      const balance = await prisma.inventoryBalance.findUnique({
        where: {
          productId_tenantId: {
            productId,
            tenantId,
          },
        },
      });
      expect(balance).toBeDefined();
      expect(balance?.qty).toBeLessThanOrEqual(10000 - successful);
    }, 30000); // Timeout de 30 segundos

    it('debe manejar 100 ventas concurrentes con rate limiting', async () => {
      const concurrentRequests = 100;
      const requests: Promise<any>[] = [];

      // Crear múltiples requests concurrentes
      for (let i = 0; i < concurrentRequests; i++) {
        const saleRequest = request(app.getHttpServer())
          .post('/sales')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            customerId,
            cashSessionId,
            items: [
              {
                productId,
                qty: 1,
                price: 2000,
              },
            ],
          });
        requests.push(saleRequest);
      }

      // Ejecutar todos los requests concurrentemente
      const responses = await Promise.allSettled(requests);

      // Verificar resultados
      const successful = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 201,
      ).length;
      const rateLimited = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 429,
      ).length;
      const failed = responses.filter(
        (r) =>
          r.status === 'rejected' ||
          (r.status === 'fulfilled' && ![201, 429].includes(r.value.status)),
      ).length;

      console.log(
        `✅ Exitosas: ${successful}, 🚦 Rate Limited: ${rateLimited}, ❌ Fallidas: ${failed}`,
      );

      // Verificar que rate limiting está funcionando
      // Algunas requests pueden ser rate limited, pero la mayoría deben ser exitosas
      expect(successful + rateLimited).toBeGreaterThanOrEqual(
        concurrentRequests * 0.9,
      );
    }, 60000); // Timeout de 60 segundos
  });

  describe('Data Integrity Under Load', () => {
    it('debe mantener integridad de stock bajo carga', async () => {
      const initialBalance = await prisma.inventoryBalance.findUnique({
        where: {
          productId_tenantId: {
            productId,
            tenantId,
          },
        },
      });

      const initialStock = initialBalance?.qty || 0;
      const salesToCreate = 20;

      const requests: Promise<any>[] = [];
      for (let i = 0; i < salesToCreate; i++) {
        const saleRequest = request(app.getHttpServer())
          .post('/sales')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            customerId,
            cashSessionId,
            items: [
              {
                productId,
                qty: 1,
                price: 2000,
              },
            ],
          });
        requests.push(saleRequest);
      }

      await Promise.allSettled(requests);

      // Verificar stock final
      const finalBalance = await prisma.inventoryBalance.findUnique({
        where: {
          productId_tenantId: {
            productId,
            tenantId,
          },
        },
      });

      // Contar ventas exitosas
      const successfulSales = await prisma.sale.count({
        where: {
          tenantId,
          items: {
            some: {
              productId,
            },
          },
        },
      });

      // El stock debe ser consistente
      const expectedStock = initialStock - successfulSales;
      expect(finalBalance?.qty).toBe(expectedStock);
    }, 30000);
  });
});
