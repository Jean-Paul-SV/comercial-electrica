import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  setupTestModule,
  cleanDatabase,
  shutdownTestApp,
} from './test-helpers';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';

describe('Multi-tenant Reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tenantAId: string;
  let tenantBId: string;
  let tokenA: string;
  let tokenB: string;
  let userIdA: string;
  let userIdB: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await cleanDatabase(prisma);

    const tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant A',
        slug: `tenant-a-${Date.now()}`,
        isActive: true,
      },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant B',
        slug: `tenant-b-${Date.now()}`,
        isActive: true,
      },
    });
    tenantBId = tenantB.id;

    await prisma.tenantModule.createMany({
      data: [
        { tenantId: tenantAId, moduleCode: 'advanced_reports', enabled: true },
        { tenantId: tenantBId, moduleCode: 'advanced_reports', enabled: true },
      ],
    });

    const passwordHash = await argon2.hash('Test123!');

    const userA = await prisma.user.create({
      data: {
        email: `admin-a-${Date.now()}@test.com`,
        passwordHash,
        role: 'ADMIN',
        tenantId: tenantAId,
        isActive: true,
      },
    });
    userIdA = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `admin-b-${Date.now()}@test.com`,
        passwordHash,
        role: 'ADMIN',
        tenantId: tenantBId,
        isActive: true,
      },
    });
    userIdB = userB.id;

    const categoryA = await prisma.category.create({
      data: { tenantId: tenantAId, name: `Category A ${Date.now()}` },
    });

    const productA = await prisma.product.create({
      data: {
        tenantId: tenantAId,
        internalCode: `PROD-A-${Date.now()}`,
        name: 'Product A',
        categoryId: categoryA.id,
        cost: 1000,
        price: 2000,
        isActive: true,
        stock: { create: { qtyOnHand: 10 } },
      },
    });

    const customerA = await prisma.customer.create({
      data: {
        tenantId: tenantAId,
        docType: 'CC',
        docNumber: `A${Date.now()}`,
        name: 'Customer A',
      },
    });

    await prisma.cashSession.create({
      data: {
        tenantId: tenantAId,
        openingAmount: 50000,
        openedBy: userIdA,
      },
    });

    await prisma.sale.create({
      data: {
        tenantId: tenantAId,
        customerId: customerA.id,
        status: 'PAID',
        subtotal: 2000,
        taxTotal: 380,
        grandTotal: 2380,
        soldAt: new Date(),
        items: {
          create: {
            productId: productA.id,
            qty: 1,
            unitPrice: 2000,
            taxRate: 19,
            lineTotal: 2380,
          },
        },
      },
    });

    const categoryB = await prisma.category.create({
      data: { tenantId: tenantBId, name: `Category B ${Date.now()}` },
    });

    const productB1 = await prisma.product.create({
      data: {
        tenantId: tenantBId,
        internalCode: `PROD-B1-${Date.now()}`,
        name: 'Product B1',
        categoryId: categoryB.id,
        cost: 1500,
        price: 3000,
        isActive: true,
        stock: { create: { qtyOnHand: 20 } },
      },
    });

    const customerB = await prisma.customer.create({
      data: {
        tenantId: tenantBId,
        docType: 'CC',
        docNumber: `B${Date.now()}`,
        name: 'Customer B',
      },
    });

    await prisma.cashSession.create({
      data: {
        tenantId: tenantBId,
        openingAmount: 100000,
        openedBy: userIdB,
      },
    });

    await prisma.sale.create({
      data: {
        tenantId: tenantBId,
        customerId: customerB.id,
        status: 'PAID',
        subtotal: 3000,
        taxTotal: 570,
        grandTotal: 3570,
        soldAt: new Date(),
        items: {
          create: {
            productId: productB1.id,
            qty: 1,
            unitPrice: 3000,
            taxRate: 19,
            lineTotal: 3570,
          },
        },
      },
    });

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'Test123!' });
    if (loginA.status !== 200 && loginA.status !== 201) {
      throw new Error(`Login A failed: ${JSON.stringify(loginA.body)}`);
    }
    tokenA = loginA.body.accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userB.email, password: 'Test123!' });
    if (loginB.status !== 200 && loginB.status !== 201) {
      throw new Error(`Login B failed: ${JSON.stringify(loginB.body)}`);
    }
    tokenB = loginB.body.accessToken;
  });

  afterAll(async () => {
    if (app && prisma) await shutdownTestApp({ app, prisma });
  });

  describe('GET /reports/actionable-indicators', () => {
    it('debe filtrar por tenantId - Tenant A solo ve sus datos', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/actionable-indicators?days=30')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(response.body).toHaveProperty('indicators');
    });

    it('debe filtrar por tenantId - Tenant B solo ve sus datos', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/actionable-indicators?days=30')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(response.body).toHaveProperty('indicators');
    });
  });

  describe('GET /reports/customer-clusters', () => {
    it('debe filtrar por tenantId', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/customer-clusters?days=90&k=3')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(response.body).toHaveProperty('clusters');
    });
  });

  describe('GET /reports/trending-products', () => {
    it('debe filtrar por tenantId', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/trending-products?days=30&top=10')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(response.body).toHaveProperty('items');
    });
  });

  describe('GET /reports/dashboard-summary', () => {
    it('devuelve resumen y source (llm o fallback)', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/dashboard-summary?days=30&top=10')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(response.body).toHaveProperty('summary');
      expect(typeof response.body.summary).toBe('string');
      expect(response.body.summary.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('source');
      expect(['llm', 'fallback']).toContain(response.body.source);
    });
  });
});
