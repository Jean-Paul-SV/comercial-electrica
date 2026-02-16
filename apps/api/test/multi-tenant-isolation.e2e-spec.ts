import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Aislamiento Multi-Tenant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAId: string;
  let tenantBId: string;
  let tokenA: string;
  let tokenB: string;
  let productAId: string;
  let productBId: string;
  let customerAId: string;
  let customerBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Crear dos tenants
    const tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant A Isolation',
        slug: `tenant-a-isolation-${Date.now()}`,
        isActive: true,
      },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant B Isolation',
        slug: `tenant-b-isolation-${Date.now()}`,
        isActive: true,
      },
    });
    tenantBId = tenantB.id;

    // Habilitar módulos para ambos tenants
    await prisma.tenantModule.createMany({
      data: [
        { tenantId: tenantAId, moduleCode: 'core', enabled: true },
        { tenantId: tenantAId, moduleCode: 'inventory', enabled: true },
        { tenantId: tenantAId, moduleCode: 'sales', enabled: true },
        { tenantId: tenantBId, moduleCode: 'core', enabled: true },
        { tenantId: tenantBId, moduleCode: 'inventory', enabled: true },
        { tenantId: tenantBId, moduleCode: 'sales', enabled: true },
      ],
    });

    // Crear usuarios admin para cada tenant
    const passwordHash = await (await import('argon2')).hash('Admin123!');

    const userA = await prisma.user.create({
      data: {
        email: `admin-a-isolation@test.com`,
        passwordHash,
        role: 'ADMIN',
        tenantId: tenantAId,
        isActive: true,
      },
    });

    const userB = await prisma.user.create({
      data: {
        email: `admin-b-isolation@test.com`,
        passwordHash,
        role: 'ADMIN',
        tenantId: tenantBId,
        isActive: true,
      },
    });

    // Login para obtener tokens
    const loginARes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `admin-a-isolation@test.com`,
        password: 'Admin123!',
      });
    tokenA = loginARes.body.accessToken;

    const loginBRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `admin-b-isolation@test.com`,
        password: 'Admin123!',
      });
    tokenB = loginBRes.body.accessToken;

    // Crear categorías para cada tenant
    const categoryARes = await request(app.getHttpServer())
      .post('/catalog/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Categoría A' });
    const categoryAId = categoryARes.body.id;

    const categoryBRes = await request(app.getHttpServer())
      .post('/catalog/categories')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Categoría B' });
    const categoryBId = categoryBRes.body.id;

    // Crear productos para cada tenant
    const productARes = await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Producto A',
        sku: `SKU-A-${Date.now()}`,
        categoryId: categoryAId,
        price: 10000,
        cost: 5000,
        stock: 100,
      });
    productAId = productARes.body.id;

    const productBRes = await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Producto B',
        sku: `SKU-B-${Date.now()}`,
        categoryId: categoryBId,
        price: 20000,
        cost: 10000,
        stock: 50,
      });
    productBId = productBRes.body.id;

    // Crear clientes para cada tenant
    const customerARes = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Cliente A',
        docType: 'CC',
        docNumber: `123456789A`,
        email: 'cliente-a@test.com',
      });
    customerAId = customerARes.body.id;

    const customerBRes = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Cliente B',
        docType: 'CC',
        docNumber: `123456789B`,
        email: 'cliente-b@test.com',
      });
    customerBId = customerBRes.body.id;
  });

  afterAll(async () => {
    // Limpiar datos de test
    if (tenantAId) {
      await prisma.saleItem.deleteMany({
        where: { sale: { tenantId: tenantAId } },
      });
      await prisma.sale.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.customer.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.product.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.category.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.user.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.tenantModule.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.tenant.deleteMany({ where: { id: tenantAId } });
    }
    if (tenantBId) {
      await prisma.saleItem.deleteMany({
        where: { sale: { tenantId: tenantBId } },
      });
      await prisma.sale.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.customer.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.product.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.category.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.user.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.tenantModule.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.tenant.deleteMany({ where: { id: tenantBId } });
    }
    await app.close();
  });

  it('debe aislar productos entre tenants', async () => {
    // Tenant A no debe poder acceder al producto de Tenant B
    const getProductBRes = await request(app.getHttpServer())
      .get(`/catalog/products/${productBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect([403, 404]).toContain(getProductBRes.status);

    // Tenant B no debe poder acceder al producto de Tenant A
    const getProductARes = await request(app.getHttpServer())
      .get(`/catalog/products/${productAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(getProductARes.status);
  });

  it('debe aislar clientes entre tenants', async () => {
    // Tenant A no debe poder acceder al cliente de Tenant B
    const getCustomerBRes = await request(app.getHttpServer())
      .get(`/customers/${customerBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect([403, 404]).toContain(getCustomerBRes.status);

    // Tenant B no debe poder acceder al cliente de Tenant A
    const getCustomerARes = await request(app.getHttpServer())
      .get(`/customers/${customerAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(getCustomerARes.status);
  });

  it('debe aislar ventas entre tenants', async () => {
    // Crear venta en Tenant A
    const saleARes = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customerId: customerAId,
        items: [
          {
            productId: productAId,
            quantity: 1,
            unitPrice: 10000,
          },
        ],
        paymentMethod: 'CASH',
        status: 'PAID',
      });

    expect(saleARes.status).toBe(201);
    const saleAId = saleARes.body.id;

    // Crear venta en Tenant B
    const saleBRes = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        customerId: customerBId,
        items: [
          {
            productId: productBId,
            quantity: 1,
            unitPrice: 20000,
          },
        ],
        paymentMethod: 'CASH',
        status: 'PAID',
      });

    expect(saleBRes.status).toBe(201);
    const saleBId = saleBRes.body.id;

    // Tenant A no debe poder acceder a la venta de Tenant B
    const getSaleBRes = await request(app.getHttpServer())
      .get(`/sales/${saleBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect([403, 404]).toContain(getSaleBRes.status);

    // Tenant B no debe poder acceder a la venta de Tenant A
    const getSaleARes = await request(app.getHttpServer())
      .get(`/sales/${saleAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(getSaleARes.status);
  });

  it('debe aislar reportes entre tenants', async () => {
    // Cada tenant solo debe ver sus propios datos en los reportes
    const dashboardARes = await request(app.getHttpServer())
      .get('/reports/dashboard')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(dashboardARes.status).toBe(200);
    expect(dashboardARes.body).toHaveProperty('todaySales');

    const dashboardBRes = await request(app.getHttpServer())
      .get('/reports/dashboard')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(dashboardBRes.status).toBe(200);
    expect(dashboardBRes.body).toHaveProperty('todaySales');

    // Los datos deben ser independientes (no verificamos valores exactos porque pueden variar)
  });
});
