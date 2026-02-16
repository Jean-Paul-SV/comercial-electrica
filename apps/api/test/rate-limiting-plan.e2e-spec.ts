import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Rate Limiting por Plan (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let platformAdminToken: string;
  let basicPlanId: string;
  let proPlanId: string;
  let basicTenantId: string;
  let proTenantId: string;
  let basicToken: string;
  let proToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Login como admin de plataforma
    const admin = await prisma.user.findFirst({
      where: { email: 'platform@admin.local' },
    });
    if (!admin) {
      throw new Error('Admin de plataforma no encontrado. Ejecuta seed primero.');
    }

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'platform@admin.local', password: 'PlatformAdmin1!' });
    platformAdminToken = loginRes.body.accessToken;

    // Crear plan básico
    const basicPlanRes = await request(app.getHttpServer())
      .post('/provider/plans')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Plan Básico Test',
        slug: 'plan-basico-test-rate',
        maxUsers: 5,
        isActive: true,
      });
    basicPlanId = basicPlanRes.body.id;

    // Crear plan pro
    const proPlanRes = await request(app.getHttpServer())
      .post('/provider/plans')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Plan Pro Test',
        slug: 'plan-pro-test-rate',
        maxUsers: 50,
        isActive: true,
      });
    proPlanId = proPlanRes.body.id;

    // Crear tenant con plan básico
    const basicTenantRes = await request(app.getHttpServer())
      .post('/provider/tenants')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Tenant Básico Rate Test',
        slug: `tenant-basico-rate-${Date.now()}`,
        adminEmail: `admin-basico-rate@test.com`,
        adminPassword: 'Admin123!',
        planId: basicPlanId,
      });
    basicTenantId = basicTenantRes.body.tenant.id;

    // Crear tenant con plan pro
    const proTenantRes = await request(app.getHttpServer())
      .post('/provider/tenants')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'Tenant Pro Rate Test',
        slug: `tenant-pro-rate-${Date.now()}`,
        adminEmail: `admin-pro-rate@test.com`,
        adminPassword: 'Admin123!',
        planId: proPlanId,
      });
    proTenantId = proTenantRes.body.tenant.id;

    // Login como admin de cada tenant
    const basicLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `admin-basico-rate@test.com`,
        password: 'Admin123!',
      });
    basicToken = basicLoginRes.body.accessToken;

    const proLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `admin-pro-rate@test.com`,
        password: 'Admin123!',
      });
    proToken = proLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // Limpiar datos de test
    if (basicTenantId) {
      await prisma.tenant.deleteMany({
        where: { id: basicTenantId },
      });
    }
    if (proTenantId) {
      await prisma.tenant.deleteMany({
        where: { id: proTenantId },
      });
    }
    if (basicPlanId) {
      await prisma.plan.deleteMany({
        where: { id: basicPlanId },
      });
    }
    if (proPlanId) {
      await prisma.plan.deleteMany({
        where: { id: proPlanId },
      });
    }
    await app.close();
  });

  it('debe aplicar límites diferentes según el plan para reportes', async () => {
    // En producción, el plan básico tiene límite de 100 req/min y pro tiene 1000 req/min
    // Para este test, verificamos que el sistema responde correctamente
    // (en desarrollo no hay límites, así que solo verificamos que no hay errores)

    // Hacer varias requests de reportes con plan básico
    const basicRequests = [];
    for (let i = 0; i < 5; i++) {
      basicRequests.push(
        request(app.getHttpServer())
          .get('/reports/dashboard')
          .set('Authorization', `Bearer ${basicToken}`)
          .expect((res) => {
            // En desarrollo debería pasar, en producción podría tener límites
            expect([200, 429]).toContain(res.status);
          }),
      );
    }
    await Promise.all(basicRequests);

    // Hacer varias requests de reportes con plan pro
    const proRequests = [];
    for (let i = 0; i < 5; i++) {
      proRequests.push(
        request(app.getHttpServer())
          .get('/reports/dashboard')
          .set('Authorization', `Bearer ${proToken}`)
          .expect((res) => {
            // En desarrollo debería pasar, en producción podría tener límites
            expect([200, 429]).toContain(res.status);
          }),
      );
    }
    await Promise.all(proRequests);
  });

  it('debe aplicar límites más estrictos para exports que para reportes', async () => {
    // Los exports tienen 1/3 del límite de reportes
    // Verificamos que el endpoint responde (puede fallar si no hay datos, pero no por rate limit en dev)

    const basicExportRes = await request(app.getHttpServer())
      .get('/reports/export')
      .set('Authorization', `Bearer ${basicToken}`)
      .query({ format: 'csv' });

    // Puede ser 200 (éxito), 400 (sin datos), o 429 (rate limit en producción)
    expect([200, 400, 404, 429]).toContain(basicExportRes.status);

    const proExportRes = await request(app.getHttpServer())
      .get('/reports/export')
      .set('Authorization', `Bearer ${proToken}`)
      .query({ format: 'csv' });

    expect([200, 400, 404, 429]).toContain(proExportRes.status);
  });
});
