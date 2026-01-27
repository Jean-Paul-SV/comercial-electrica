import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as request from 'supertest';
import { App } from 'supertest/types';

describe('Inventory (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let productId: string;

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

    // Limpiar base de datos
    await prisma.inventoryMovementItem.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.stockBalance.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();

    // Crear usuario y obtener token
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      await request(app.getHttpServer()).post('/auth/bootstrap-admin').send({
        email: 'test@example.com',
        password: 'Test123!',
      });
    }

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!',
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.accessToken;
    }
  });

  beforeEach(async () => {
    // Crear categoría y producto para cada test
    const category = await prisma.category.create({
      data: { name: `Test Category ${Date.now()}` },
    });
    // Categoría creada para el producto

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
  });

  afterEach(async () => {
    await prisma.inventoryMovementItem.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.stockBalance.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /inventory/movements', () => {
    it('debe crear un movimiento de entrada (IN) y actualizar stock', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'IN',
          reason: 'Compra inicial',
          items: [
            {
              productId,
              qty: 100,
              unitCost: 1000,
            },
          ],
        })
        .expect(201);

      expect(response.body.type).toBe('IN');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].qty).toBe(100);

      // Verificar que el stock se actualizó
      const stock = await prisma.stockBalance.findUnique({
        where: { productId },
      });
      expect(stock?.qtyOnHand).toBe(100);
    });

    it('debe crear un movimiento de salida (OUT) y descontar stock', async () => {
      // Primero agregar stock
      await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'IN',
          reason: 'Stock inicial',
          items: [
            {
              productId,
              qty: 100,
              unitCost: 1000,
            },
          ],
        });

      // Luego hacer salida
      const response = await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'OUT',
          reason: 'Ajuste de inventario',
          items: [
            {
              productId,
              qty: 30,
              unitCost: null,
            },
          ],
        })
        .expect(201);

      expect(response.body.type).toBe('OUT');

      // Verificar que el stock se descontó
      const stock = await prisma.stockBalance.findUnique({
        where: { productId },
      });
      expect(stock?.qtyOnHand).toBe(70); // 100 - 30
    });

    it('debe fallar si intenta salir más stock del disponible', async () => {
      // Agregar solo 50 unidades
      await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'IN',
          reason: 'Stock inicial',
          items: [
            {
              productId,
              qty: 50,
              unitCost: 1000,
            },
          ],
        });

      // Intentar sacar 100 (más de lo disponible)
      await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'OUT',
          reason: 'Salida',
          items: [
            {
              productId,
              qty: 100,
              unitCost: null,
            },
          ],
        })
        .expect(400);
    });

    it('debe crear un ajuste (ADJUST) correctamente', async () => {
      // Agregar stock inicial
      await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'IN',
          reason: 'Stock inicial',
          items: [
            {
              productId,
              qty: 50,
              unitCost: 1000,
            },
          ],
        });

      // Hacer ajuste
      const response = await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'ADJUST',
          reason: 'Corrección de inventario',
          items: [
            {
              productId,
              qty: 25,
              unitCost: null,
            },
          ],
        })
        .expect(201);

      expect(response.body.type).toBe('ADJUST');

      // Verificar que el stock se ajustó (ADJUST suma)
      const stock = await prisma.stockBalance.findUnique({
        where: { productId },
      });
      expect(stock?.qtyOnHand).toBe(75); // 50 + 25
    });

    it('debe fallar si no hay items', async () => {
      await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'IN',
          reason: 'Test',
          items: [],
        })
        .expect(400);
    });
  });

  describe('GET /inventory/movements', () => {
    it('debe listar los movimientos de inventario', async () => {
      // Crear algunos movimientos
      await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'IN',
          reason: 'Compra',
          items: [
            {
              productId,
              qty: 50,
              unitCost: 1000,
            },
          ],
        });

      const response = await request(app.getHttpServer())
        .get('/inventory/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});
