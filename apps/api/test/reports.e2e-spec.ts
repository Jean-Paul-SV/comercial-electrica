import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp, shutdownTestApp } from './test-helpers';
import request from 'supertest';
import { App } from 'supertest/types';

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let productId: string;
  let customerId: string;
  let saleId: string;
  let cashSessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    // Setup simplificado usando helper común
    const setup = await setupTestApp(moduleFixture, 'reports-test@example.com');
    ({ app, prisma, authToken, userId } = setup);

    // Crear datos de prueba
    // Usar upsert para evitar unique constraint
    const category = await prisma.category.upsert({
      where: { name: 'Test Category' },
      update: {},
      create: { name: 'Test Category' },
    });

    // Usar código único para evitar conflictos entre tests
    const productCode = `REPORTS-TEST-${Date.now()}`;
    const product = await prisma.product.upsert({
      where: { internalCode: productCode },
      update: {
        name: 'Test Product',
        categoryId: category.id,
        cost: 1000,
        price: 2000,
        taxRate: 19,
        isActive: true,
      },
      create: {
        internalCode: productCode,
        name: 'Test Product',
        categoryId: category.id,
        cost: 1000,
        price: 2000,
        taxRate: 19,
        stock: { create: { qtyOnHand: 100 } },
      },
    });
    productId = product.id;

    const customer = await prisma.customer.create({
      data: {
        docType: 'CC',
        // Usar docNumber único para evitar violar el unique constraint (docType, docNumber)
        docNumber: `123456${Date.now()}`,
        name: 'Test Customer',
      },
    });
    customerId = customer.id;

    // Crear sesión de caja con openedBy (requerido para algunas operaciones)
    const cashSession = await prisma.cashSession.create({
      data: {
        openingAmount: 100000,
        openedBy: userId,
      },
    });
    cashSessionId = cashSession.id;

    const sale = await prisma.sale.create({
      data: {
        customerId,
        status: 'PAID',
        subtotal: 2000,
        taxTotal: 380,
        grandTotal: 2380,
        items: {
          create: {
            productId,
            qty: 1,
            unitPrice: 2000,
            taxRate: 19,
            lineTotal: 2380,
          },
        },
      },
    });
    saleId = sale.id;

    await prisma.cashMovement.create({
      data: {
        sessionId: cashSessionId,
        type: 'IN',
        method: 'CASH',
        amount: 2380,
        relatedSaleId: sale.id,
      },
    });
  });

  afterAll(async () => {
    // Limpiar solo datos relacionados a reports, no productos/categorías/clientes
    // para evitar conflictos con otras suites
    await prisma.saleItem.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.cashMovement.deleteMany();
    await prisma.cashSession.deleteMany();
    await shutdownTestApp({ app, prisma });
  });

  describe('GET /reports/dashboard', () => {
    it('debe retornar dashboard con KPIs', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('date');
      expect(response.body).toHaveProperty('sales');
      expect(response.body).toHaveProperty('inventory');
      expect(response.body).toHaveProperty('cash');
      expect(response.body).toHaveProperty('quotes');
      expect(response.body).toHaveProperty('customers');
      expect(response.body.sales.today).toBeDefined();
      expect(response.body.inventory.totalProducts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /reports/sales', () => {
    it('debe retornar reporte de ventas', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('sales');
      expect(response.body.summary).toHaveProperty('totalSales');
      expect(response.body.summary).toHaveProperty('totalAmount');
      expect(Array.isArray(response.body.sales)).toBe(true);
    });

    it('debe filtrar ventas por fecha', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(app.getHttpServer())
        .get(
          `/reports/sales?startDate=${yesterday.toISOString()}&endDate=${today.toISOString()}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period.startDate).toBeDefined();
      expect(response.body.period.endDate).toBeDefined();
    });

    it('debe filtrar ventas por cliente', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reports/sales?customerId=${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.sales).toBeDefined();
      // Todas las ventas deben ser del cliente especificado
      response.body.sales.forEach((sale: { customerId: string | null }) => {
        expect(sale.customerId).toBe(customerId);
      });
    });
  });

  describe('GET /reports/inventory', () => {
    it('debe retornar reporte de inventario', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('filters');
      expect(response.body).toHaveProperty('statistics');
      expect(response.body).toHaveProperty('products');
      expect(response.body.statistics).toHaveProperty('totalProducts');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('debe filtrar productos con stock bajo', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/inventory?lowStock=true&lowStockThreshold=50')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.filters.lowStock).toBe(true);
      expect(response.body.filters.lowStockThreshold).toBe(50);
      // Todos los productos deben tener stock <= threshold
      response.body.products.forEach(
        (product: { stock: { qtyOnHand: number } | null }) => {
          if (product.stock) {
            expect(product.stock.qtyOnHand).toBeLessThanOrEqual(50);
          }
        },
      );
    });
  });

  describe('GET /reports/cash', () => {
    it('debe retornar reporte de caja', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/cash')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('sessions');
      expect(response.body.summary).toHaveProperty('totalSessions');
      expect(Array.isArray(response.body.sessions)).toBe(true);
    });

    it('debe filtrar por sesión específica', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reports/cash?sessionId=${cashSessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period.sessionId).toBe(cashSessionId);
      // Todas las sesiones deben ser la especificada
      response.body.sessions.forEach((session: { id: string }) => {
        expect(session.id).toBe(cashSessionId);
      });
    });
  });

  describe('GET /reports/customers', () => {
    it('debe retornar reporte de clientes', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('totalCustomers');
      expect(response.body).toHaveProperty('topCustomers');
      expect(Array.isArray(response.body.topCustomers)).toBe(true);
    });

    it('debe limitar número de clientes con top', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/customers?top=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.topCustomers.length).toBeLessThanOrEqual(5);
    });
  });
});
