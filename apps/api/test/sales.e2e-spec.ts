import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as request from 'supertest';
import { App } from 'supertest/types';

describe('Sales (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let customerId: string;
  let productId: string;
  let categoryId: string;
  let cashSessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    // Limpiar base de datos de prueba
    await prisma.auditLog.deleteMany();
    await prisma.dianDocument.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.cashMovement.deleteMany();
    await prisma.cashSession.deleteMany();
    await prisma.inventoryMovementItem.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.stockBalance.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();

    // Crear usuario admin usando bootstrap (si no existe)
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      await request(app.getHttpServer())
        .post('/auth/bootstrap-admin')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
        });
    }

    // Login para obtener token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!',
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.accessToken;
    }

    // Obtener userId
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });
    if (user) {
      userId = user.id;
    }
  });

  beforeEach(async () => {
    // Crear datos de prueba para cada test
    const category = await prisma.category.create({
      data: { name: `Test Category ${Date.now()}` },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        internalCode: `TEST-${Date.now()}`,
        name: 'Producto Test',
        categoryId: category.id,
        cost: 1000,
        price: 2000,
        taxRate: 19,
      },
    });
    productId = product.id;

    // Crear stock inicial
    await prisma.stockBalance.create({
      data: {
        productId: product.id,
        qtyOnHand: 100,
        qtyReserved: 0,
      },
    });

    const customer = await prisma.customer.create({
      data: {
        docType: 'CC',
        docNumber: `123456${Date.now()}`,
        name: 'Cliente Test',
        email: 'cliente@test.com',
      },
    });
    customerId = customer.id;

    const cashSession = await prisma.cashSession.create({
      data: {
        openingAmount: 50000,
        openedBy: userId,
      },
    });
    cashSessionId = cashSession.id;

    // El token ya se obtuvo en beforeAll
  });

  afterEach(async () => {
    // Limpiar datos de cada test
    await prisma.saleItem.deleteMany({ where: { saleId: { in: await prisma.sale.findMany({ select: { id: true } }).then((s) => s.map((s) => s.id)) } } });
    await prisma.sale.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.dianDocument.deleteMany();
    await prisma.cashMovement.deleteMany();
    await prisma.cashSession.deleteMany();
    await prisma.stockBalance.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.customer.deleteMany();
  });

  afterAll(async () => {
    // Limpieza final
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /sales', () => {
    it('debe crear una venta exitosamente con todos los componentes', async () => {
      const response = await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          cashSessionId,
          paymentMethod: 'CASH',
          items: [
            {
              productId,
              qty: 5,
            },
          ],
        })
        .expect(201);

      expect(response.body).toHaveProperty('sale');
      expect(response.body).toHaveProperty('invoice');
      expect(response.body).toHaveProperty('dianDocument');

      // Verificar que la venta se creó correctamente
      expect(response.body.sale.status).toBe('PAID');
      expect(response.body.sale.grandTotal).toBeGreaterThan(0);

      // Verificar que se creó la factura
      expect(response.body.invoice.status).toBe('ISSUED');
      expect(response.body.invoice.number).toBeDefined();

      // Verificar que se creó el documento DIAN
      expect(response.body.dianDocument.status).toBe('DRAFT');
      expect(response.body.dianDocument.type).toBe('FE');

      // Verificar que el stock se descontó
      const stock = await prisma.stockBalance.findUnique({
        where: { productId },
      });
      expect(stock?.qtyOnHand).toBe(95); // 100 - 5

      // Verificar que se creó el movimiento de caja
      const cashMovements = await prisma.cashMovement.findMany({
        where: { sessionId: cashSessionId },
      });
      expect(cashMovements.length).toBeGreaterThan(0);
      expect(cashMovements[0].type).toBe('IN');
      expect(cashMovements[0].amount).toBe(response.body.sale.grandTotal);
    });

    it('debe fallar si no hay stock suficiente', async () => {
      // Intentar vender más de lo disponible
      await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          cashSessionId,
          paymentMethod: 'CASH',
          items: [
            {
              productId,
              qty: 200, // Más de los 100 disponibles
            },
          ],
        })
        .expect(400);
    });

    it('debe fallar si no se proporciona cashSessionId', async () => {
      await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          paymentMethod: 'CASH',
          items: [
            {
              productId,
              qty: 5,
            },
          ],
        })
        .expect(400);
    });

    it('debe calcular correctamente los impuestos', async () => {
      const response = await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          cashSessionId,
          paymentMethod: 'CASH',
          items: [
            {
              productId,
              qty: 10, // 10 * 2000 = 20000, con 19% IVA = 3800, total = 23800
            },
          ],
        })
        .expect(201);

      expect(response.body.sale.subtotal).toBe(20000);
      expect(response.body.sale.taxTotal).toBe(3800);
      expect(response.body.sale.grandTotal).toBe(23800);
    });
  });

  describe('GET /sales', () => {
    it('debe listar las ventas', async () => {
      // Crear una venta primero
      await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          cashSessionId,
          paymentMethod: 'CASH',
          items: [{ productId, qty: 2 }],
        });

      const response = await request(app.getHttpServer())
        .get('/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});
