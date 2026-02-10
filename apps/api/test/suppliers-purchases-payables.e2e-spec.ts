import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp, shutdownTestApp } from './test-helpers';

describe('Suppliers + Purchases + Payables (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let tenantId: string;

  let supplierId: string;
  let productId: string;
  let purchaseOrderId: string;
  let purchaseOrderItemId: string;
  let supplierInvoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    const setup = await setupTestApp(
      moduleFixture,
      'suppliers-purchases-payables-test@example.com',
    );
    ({ app, prisma, authToken, tenantId } = setup);
  });

  afterAll(async () => {
    await shutdownTestApp({ app, prisma });
  });

  it('flujo completo: proveedor -> pedido -> recepción -> factura -> pagos', async () => {
    // 1) Crear proveedor
    const supplierRes = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        nit: `900123456-${Date.now()}`,
        name: 'Proveedor Test S.A.S.',
        email: 'proveedor@test.com',
        phone: '3001234567',
        contactPerson: 'Juan Proveedor',
      })
      .expect(201);

    supplierId = supplierRes.body.id;
    expect(supplierId).toBeDefined();

    // 2) Crear producto base (category + product)
    const category = await prisma.category.create({
      data: { tenantId, name: `CAT-${Date.now()}` },
    });
    const product = await prisma.product.create({
      data: {
        tenantId,
        internalCode: `P-${Date.now()}`,
        name: 'Producto Compra',
        categoryId: category.id,
        cost: 1000,
        price: 2000,
        taxRate: 19,
      },
    });
    productId = product.id;

    // 3) Crear pedido de compra
    const poRes = await request(app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        supplierId,
        expectedDate: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        notes: 'Pedido de prueba',
        items: [{ productId, qty: 10, unitCost: 1500 }],
      });

    if (poRes.status !== 201) {
      throw new Error(
        `POST /purchases esperado 201, recibido ${poRes.status}. Body=${JSON.stringify(
          poRes.body,
        )}`,
      );
    }

    purchaseOrderId = poRes.body.id;
    expect(poRes.body).toHaveProperty('orderNumber');
    expect(poRes.body.supplierId).toBe(supplierId);
    expect(poRes.body.items?.length).toBe(1);

    purchaseOrderItemId = poRes.body.items[0].id;
    expect(purchaseOrderItemId).toBeDefined();

    // 4) Recibir el pedido (debe crear movimiento IN y subir stock)
    const receiveRes = await request(app.getHttpServer())
      .post(`/purchases/${purchaseOrderId}/receive`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ itemId: purchaseOrderItemId, receivedQty: 10 }],
      })
      .expect(200);

    expect(['COMPLETED', 'PARTIALLY_RECEIVED', 'RECEIVED']).toContain(
      receiveRes.body.status,
    );

    const stock = await prisma.stockBalance.findUnique({
      where: { productId },
    });
    expect(stock?.qtyOnHand).toBe(10);

    const movement = await prisma.inventoryMovement.findFirst({
      where: { supplierId, type: 'IN' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(movement).toBeTruthy();
    expect(movement?.items?.length).toBeGreaterThan(0);

    // 5) Crear factura del proveedor con dueDate (fecha de pago)
    const invoiceDate = new Date();
    const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    const invRes = await request(app.getHttpServer())
      .post('/supplier-invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        supplierId,
        purchaseOrderId,
        invoiceNumber: `FAC-${Date.now()}`,
        invoiceDate: invoiceDate.toISOString(),
        dueDate: dueDate.toISOString(),
        subtotal: 15000, // 10 * 1500
        taxRate: 19,
        notes: 'Factura de prueba',
      })
      .expect(201);

    supplierInvoiceId = invRes.body.id;
    expect(supplierInvoiceId).toBeDefined();
    expect(invRes.body.status).toBe('PENDING');

    // 6) Pago parcial -> PARTIALLY_PAID
    const pay1 = await request(app.getHttpServer())
      .post(`/supplier-invoices/${supplierInvoiceId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 5000,
        paymentMethod: 'TRANSFER',
        reference: `TRF-${Date.now()}`,
      })
      .expect(201);

    expect(pay1.body.status).toBe('PARTIALLY_PAID');
    expect(Number(pay1.body.paidAmount)).toBe(5000);

    // 7) Pago final -> PAID
    const pay2 = await request(app.getHttpServer())
      .post(`/supplier-invoices/${supplierInvoiceId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 12850, // total 17850
        paymentMethod: 'CASH',
      })
      .expect(201);

    expect(pay2.body.status).toBe('PAID');
    expect(Number(pay2.body.paidAmount)).toBe(17850);

    // 8) Pending endpoint no debería incluir facturas PAID
    const pending = await request(app.getHttpServer())
      .get('/supplier-invoices/pending')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(pending.body)).toBe(true);
    const found = pending.body.find((x: any) => x.id === supplierInvoiceId);
    expect(found).toBeUndefined();
  });
});
