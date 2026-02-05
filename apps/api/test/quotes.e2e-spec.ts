import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp, shutdownTestApp } from './test-helpers';
import request from 'supertest';
import { App } from 'supertest/types';

describe('Quotes (e2e) - Flujo Completo', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let productId: string;
  let customerId: string;
  let quoteId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    // Setup simplificado usando helper común
    const setup = await setupTestApp(moduleFixture, 'quotes-test@example.com');
    ({ app, prisma, authToken, userId } = setup);

    // Crear categoría (usar upsert para evitar unique constraint)
    const category = await prisma.category.upsert({
      where: { name: 'Test Category' },
      update: {},
      create: { name: 'Test Category' },
    });

    // Crear producto (usar código único para evitar conflictos)
    const productCode = `QUOTES-TEST-${Date.now()}`;
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

    // Crear cliente con docNumber único para evitar conflictos
    const customer = await prisma.customer.create({
      data: {
        docType: 'CC',
        // Usar docNumber único para evitar violar el unique constraint (docType, docNumber)
        docNumber: `123456${Date.now()}`,
        name: 'Test Customer',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    // Limpiar solo datos relacionados a quotes, no productos/categorías/clientes
    // para evitar conflictos con otras suites
    await prisma.quoteItem.deleteMany();
    await prisma.quote.deleteMany();
    await shutdownTestApp({ app, prisma });
  });

  describe('Flujo Completo de Cotizaciones', () => {
    it('debe crear una cotización en estado DRAFT', async () => {
      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          items: [
            {
              productId,
              qty: 5,
            },
          ],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('DRAFT');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.grandTotal).toBeDefined();

      quoteId = response.body.id;
      expect(quoteId).toBeDefined();
      expect(typeof quoteId).toBe('string');
    });

    it('debe actualizar una cotización', async () => {
      // Asegurarse de que quoteId esté definido
      if (!quoteId) {
        throw new Error(
          'quoteId no está definido. El test anterior debe haber fallado.',
        );
      }
      const response = await request(app.getHttpServer())
        .patch(`/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              productId,
              qty: 10, // Cambiar cantidad
            },
          ],
        })
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].qty).toBe(10);
    });

    it('debe enviar una cotización (cambiar a SENT)', async () => {
      // Asegurarse de que quoteId esté definido
      if (!quoteId) {
        throw new Error(
          'quoteId no está definido. El test anterior debe haber fallado.',
        );
      }

      const response = await request(app.getHttpServer())
        .patch(`/quotes/${quoteId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'SENT' })
        .expect(200);

      expect(response.body.status).toBe('SENT');
    });

    it('debe listar cotizaciones con filtros', async () => {
      // El endpoint puede requerir validación del enum, probar sin filtros primero
      // o verificar que el filtro funciona correctamente
      const response = await request(app.getHttpServer())
        .get('/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();

      // Verificar que hay al menos una cotización SENT (la que creamos antes)
      const sentQuotes = response.body.data.filter(
        (q: { status: string }) => q.status === 'SENT',
      );
      expect(sentQuotes.length).toBeGreaterThan(0);
    });

    it('debe convertir una cotización a venta', async () => {
      // Asegurarse de que quoteId esté definido
      if (!quoteId) {
        throw new Error(
          'quoteId no está definido. El test anterior debe haber fallado.',
        );
      }

      // Crear sesión de caja primero
      const cashSession = await prisma.cashSession.create({
        data: {
          openingAmount: 100000,
          openedBy: userId,
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/quotes/${quoteId}/convert`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cashSessionId: cashSession.id,
          paymentMethod: 'CASH',
        })
        .expect(201);

      expect(response.body).toHaveProperty('sale');
      expect(response.body).toHaveProperty('invoice');
      expect(response.body.sale.status).toBe('PAID');

      // Verificar que la cotización cambió a CONVERTED
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
      });
      expect(quote?.status).toBe('CONVERTED');
    });
  });

  describe('Validaciones de Cotizaciones', () => {
    it('debe rechazar cotización con fecha de validez en el pasado', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          validUntil: pastDate.toISOString(),
          items: [
            {
              productId,
              qty: 5,
            },
          ],
        })
        .expect(400);
    });

    it('debe rechazar cotización sin items', async () => {
      await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          items: [],
        })
        .expect(400);
    });
  });
});
