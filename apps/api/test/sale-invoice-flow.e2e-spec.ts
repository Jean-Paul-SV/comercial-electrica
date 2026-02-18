import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Flujo Venta → Factura (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let token: string;
  let customerId: string;
  let productId: string;
  let categoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Crear tenant de prueba
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Tenant Venta Factura Test',
        slug: `tenant-venta-factura-${Date.now()}`,
        isActive: true,
      },
    });
    tenantId = tenant.id;

    // Habilitar módulos necesarios
    await prisma.tenantModule.createMany({
      data: [
        { tenantId, moduleCode: 'core', enabled: true },
        { tenantId, moduleCode: 'inventory', enabled: true },
        { tenantId, moduleCode: 'sales', enabled: true },
      ],
    });

    // Crear usuario admin
    const passwordHash = await (await import('argon2')).hash('Admin123!');
    const user = await prisma.user.create({
      data: {
        email: `admin-venta-factura@test.com`,
        passwordHash,
        role: 'ADMIN',
        tenantId,
        isActive: true,
      },
    });

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `admin-venta-factura@test.com`,
        password: 'Admin123!',
      });
    token = loginRes.body.accessToken;

    // Crear categoría
    const categoryRes = await request(app.getHttpServer())
      .post('/catalog/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Categoría Test Venta',
      });
    categoryId = categoryRes.body.id;

    // Crear producto
    const productRes = await request(app.getHttpServer())
      .post('/catalog/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Producto Test Venta',
        sku: `SKU-TEST-${Date.now()}`,
        categoryId,
        price: 10000,
        cost: 5000,
        stock: 100,
      });
    productId = productRes.body.id;

    // Crear cliente
    const customerRes = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Cliente Test Venta',
        docType: 'CC',
        docNumber: `123456789${Date.now()}`,
        email: 'cliente@test.com',
      });
    customerId = customerRes.body.id;
  });

  afterAll(async () => {
    // Limpiar datos de test
    if (tenantId) {
      await prisma.saleItem.deleteMany({
        where: { sale: { tenantId } },
      });
      await prisma.sale.deleteMany({ where: { tenantId } });
      await prisma.invoice.deleteMany({ where: { tenantId } });
      await prisma.customer.deleteMany({ where: { tenantId } });
      await prisma.product.deleteMany({ where: { tenantId } });
      await prisma.category.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.tenantModule.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
    await app.close();
  });

  it('debe crear una venta y luego generar factura', async () => {
    // 1. Crear venta
    const saleRes = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        items: [
          {
            productId,
            quantity: 2,
            unitPrice: 10000,
          },
        ],
        paymentMethod: 'CASH',
        status: 'PAID',
      });

    expect(saleRes.status).toBe(201);
    expect(saleRes.body).toHaveProperty('id');
    const saleId = saleRes.body.id;

    // 2. Generar factura desde la venta
    const invoiceRes = await request(app.getHttpServer())
      .post('/sales/' + saleId + '/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(invoiceRes.status).toBe(201);
    expect(invoiceRes.body).toHaveProperty('id');
    expect(invoiceRes.body).toHaveProperty('saleId', saleId);
    expect(invoiceRes.body).toHaveProperty('status');
  });

  it('debe validar que la venta existe antes de crear factura', async () => {
    // Intentar crear factura para una venta inexistente
    const fakeSaleId = '00000000-0000-0000-0000-000000000000';
    const invoiceRes = await request(app.getHttpServer())
      .post('/sales/' + fakeSaleId + '/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(invoiceRes.status).toBe(404);
  });

  it('debe validar que la venta pertenece al tenant', async () => {
    // Crear otro tenant
    const otherTenant = await prisma.tenant.create({
      data: {
        name: 'Otro Tenant',
        slug: `otro-tenant-${Date.now()}`,
        isActive: true,
      },
    });

    // Crear venta en otro tenant
    const otherPasswordHash = await (await import('argon2')).hash('Admin123!');
    const otherUser = await prisma.user.create({
      data: {
        email: `admin-otro@test.com`,
        passwordHash: otherPasswordHash,
        role: 'ADMIN',
        tenantId: otherTenant.id,
        isActive: true,
      },
    });

    const otherLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `admin-otro@test.com`,
        password: 'Admin123!',
      });
    const otherToken = otherLoginRes.body.accessToken;

    // Crear venta en otro tenant
    const otherSaleRes = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        customerId,
        items: [
          {
            productId,
            quantity: 1,
            unitPrice: 10000,
          },
        ],
        paymentMethod: 'CASH',
        status: 'PAID',
      });

    const otherSaleId = otherSaleRes.body.id;

    // Intentar crear factura desde el primer tenant para una venta del segundo tenant
    const invoiceRes = await request(app.getHttpServer())
      .post('/sales/' + otherSaleId + '/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    // Debe fallar porque la venta pertenece a otro tenant
    expect([403, 404]).toContain(invoiceRes.status);

    // Limpiar
    await prisma.saleItem.deleteMany({
      where: { sale: { tenantId: otherTenant.id } },
    });
    await prisma.sale.deleteMany({ where: { tenantId: otherTenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenant.id } });
    await prisma.tenant.deleteMany({ where: { id: otherTenant.id } });
  });
});
