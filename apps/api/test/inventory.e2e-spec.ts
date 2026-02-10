import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp, shutdownTestApp } from './test-helpers';
import request from 'supertest';
import { App } from 'supertest/types';

describe('Inventory (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let tenantId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    const setup = await setupTestApp(
      moduleFixture,
      'inventory-test@example.com',
    );
    ({ app, prisma, authToken, tenantId } = setup);
  });

  beforeEach(async () => {
    const categoryName = `Test Category ${Date.now()}`;
    const category = await prisma.category.upsert({
      where: { tenantId_name: { tenantId, name: categoryName } },
      update: {},
      create: { tenantId, name: categoryName },
    });

    const product = await prisma.product.create({
      data: {
        tenantId,
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
    // Limpiar solo tablas de inventario creadas en cada test.
    // No eliminamos productos/categorías aquí para evitar errores de FK
    // cuando otras suites (por ejemplo, quotes) han creado datos relacionados.
    await prisma.inventoryMovementItem.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.stockBalance.deleteMany();
  });

  afterAll(async () => {
    // Limpiar logs de auditoría (no auditar en tests)
    // Orden correcto: primero las tablas que tienen foreign keys, luego las referenciadas
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await shutdownTestApp({ app, prisma });
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
      // Agregar stock inicial y esperar a que se complete
      const initialMovement = await request(app.getHttpServer())
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
        })
        .expect(201);

      expect(initialMovement.body.type).toBe('IN');

      // Verificar que el stock inicial se creó correctamente
      const stockBeforeAdjust = await prisma.stockBalance.findUnique({
        where: { productId },
      });
      expect(stockBeforeAdjust?.qtyOnHand).toBe(50);

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
      // Esperar un poco para asegurar que la transacción se complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stock = await prisma.stockBalance.findUnique({
        where: { productId },
      });

      // Verificar que el producto aún existe (puede haber sido eliminado por otra suite)
      if (!stock) {
        throw new Error(
          `StockBalance no encontrado para productId=${productId}. El producto puede haber sido eliminado por otra suite de tests.`,
        );
      }

      expect(stock.qtyOnHand).toBe(75); // 50 + 25
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

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toBeDefined();
    });
  });
});
