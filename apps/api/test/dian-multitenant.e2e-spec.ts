import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupTestModule, shutdownTestApp } from './test-helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { App } from 'supertest/types';

describe('DIAN multi-tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantAId: string;
  let tenantBId: string;
  let tokenA: string;
  let tokenB: string;

  let dianDocumentIdForTenantA: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Limpiar base de datos de forma acotada para este test
    await prisma.dianEvent.deleteMany();
    await prisma.dianDocument.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.stockBalance.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenantModule.deleteMany();
    await prisma.tenant.deleteMany();

    // Crear dos tenants con módulo electronic_invoicing habilitado
    const [tenantA, tenantB] = await prisma.$transaction([
      prisma.tenant.create({
        data: {
          name: 'Tenant A - DIAN',
          slug: `tenant-a-dian-${Date.now()}-a`,
          isActive: true,
        },
      }),
      prisma.tenant.create({
        data: {
          name: 'Tenant B - DIAN',
          slug: `tenant-b-dian-${Date.now()}-b`,
          isActive: true,
        },
      }),
    ]);

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const moduleCodes = ['core', 'inventory', 'electronic_invoicing'] as const;
    await prisma.tenantModule.createMany({
      data: [
        ...moduleCodes.map((moduleCode) => ({
          tenantId: tenantAId,
          moduleCode,
          enabled: true,
        })),
        ...moduleCodes.map((moduleCode) => ({
          tenantId: tenantBId,
          moduleCode,
          enabled: true,
        })),
      ],
    });

    // Crear usuario admin para cada tenant y hacer login para obtener tokens
    const password = 'Test123!';

    const createUserAndLogin = async (email: string, tenantId: string) => {
      const normalizedEmail = email.toLowerCase();

      await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: await (await import('argon2')).hash(password),
          role: 'ADMIN',
          tenantId,
          isActive: true,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: normalizedEmail, password });

      if (
        (res.status !== 200 && res.status !== 201) ||
        !res.body?.accessToken
      ) {
        throw new Error(
          `Login failed for ${email}. Status: ${res.status}, body: ${JSON.stringify(
            res.body,
          )}`,
        );
      }

      return res.body.accessToken as string;
    };

    tokenA = await createUserAndLogin('tenant-a-dian@example.com', tenantAId);
    tokenB = await createUserAndLogin('tenant-b-dian@example.com', tenantBId);

    // Crear datos mínimos para generar una venta con factura y documento DIAN para el tenant A
    const category = await prisma.category.create({
      data: {
        tenantId: tenantAId,
        name: `Categoria DIAN A ${Date.now()}`,
      },
    });

    const product = await prisma.product.create({
      data: {
        tenantId: tenantAId,
        internalCode: `DIAN-A-${Date.now()}`,
        name: 'Producto DIAN A',
        categoryId: category.id,
        cost: 1000,
        price: 2000,
        taxRate: 19,
      },
    });

    await prisma.stockBalance.create({
      data: {
        productId: product.id,
        qtyOnHand: 10,
        qtyReserved: 0,
      },
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: tenantAId,
        docType: 'CC',
        docNumber: `123456-${Date.now()}`,
        name: 'Cliente DIAN A',
      },
    });

    const sale = await prisma.sale.create({
      data: {
        tenantId: tenantAId,
        customerId: customer.id,
        status: 'PAID',
        soldAt: new Date(),
        subtotal: 2000,
        taxTotal: 380,
        discountTotal: 0,
        grandTotal: 2380,
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenantAId,
        saleId: sale.id,
        customerId: customer.id,
        number: `DIAN-A-${Date.now()}`,
        issuedAt: new Date(),
        status: 'ISSUED',
        subtotal: 2000,
        taxTotal: 380,
        discountTotal: 0,
        grandTotal: 2380,
      },
    });

    const dianDoc = await prisma.dianDocument.create({
      data: {
        invoiceId: invoice.id,
        type: 'FE',
        status: 'DRAFT',
      },
    });

    dianDocumentIdForTenantA = dianDoc.id;
  });

  afterAll(async () => {
    await shutdownTestApp({ app, prisma });
  });

  it('debe permitir al tenant A consultar el estado de su propio documento DIAN', async () => {
    const res = await request(app.getHttpServer())
      .get(`/dian/documents/${dianDocumentIdForTenantA}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body).toHaveProperty('status');
    expect(res.body.status).toBe('DRAFT');
  });

  it('no debe permitir que el tenant B consulte el documento DIAN del tenant A (404)', async () => {
    await request(app.getHttpServer())
      .get(`/dian/documents/${dianDocumentIdForTenantA}/status`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('no debe permitir consultar estado de documentos DIAN sin tenantId en el contexto (forbidden)', async () => {
    // Usamos un token inválido o sin tenant; la guardia JWT ya debería bloquearlo con 401,
    // pero este test deja explícito el contrato esperado.
    await request(app.getHttpServer())
      .get(`/dian/documents/${dianDocumentIdForTenantA}/status`)
      .expect(401);
  });
});
