import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  setupTestModule,
  setupTestAppForPlatformAdmin,
  shutdownTestApp,
} from './test-helpers';
import request from 'supertest';
import { App } from 'supertest/types';

describe('Provider (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let planId: string;
  let createdTenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    const setup = await setupTestAppForPlatformAdmin(
      moduleFixture,
      'provider-e2e@platform.local',
    );
    ({ app, prisma, authToken } = setup);

    const plan = await prisma.plan.create({
      data: {
        name: 'Plan E2E',
        slug: `plan-e2e-${Date.now()}`,
        description: 'Plan para tests',
        isActive: true,
      },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    await shutdownTestApp({ app, prisma });
  });

  describe('GET /provider/plans', () => {
    it('debe listar planes', async () => {
      const res = await request(app.getHttpServer())
        .get('/provider/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((p: { id: string }) => p.id === planId)).toBe(true);
    });

    it('debe listar solo planes activos con activeOnly=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/provider/plans?activeOnly=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((p: { isActive: boolean }) => p.isActive)).toBe(true);
    });
  });

  describe('GET /provider/tenants', () => {
    it('debe listar tenants (incluye el creado para backup)', async () => {
      const res = await request(app.getHttpServer())
        .get('/provider/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /provider/tenants', () => {
    it('debe crear tenant con admin y suscripción', async () => {
      const slug = `e2e-tenant-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/provider/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Empresa E2E',
          slug,
          planId,
          adminEmail: `admin-${Date.now()}@e2e.com`,
          adminName: 'Admin E2E',
          adminPassword: 'Password123!',
        })
        .expect(201);
      expect(res.body).toHaveProperty('tenant');
      expect(res.body.tenant).toHaveProperty('id');
      expect(res.body.tenant.slug).toBe(slug);
      createdTenantId = res.body.tenant.id;

      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: res.body.tenant.id },
      });
      expect(subscription).toBeDefined();
      expect(subscription?.status).toBe('ACTIVE');
    });

    it('debe rechazar slug duplicado', async () => {
      const slug = `e2e-dup-${Date.now()}`;
      await request(app.getHttpServer())
        .post('/provider/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Primera',
          slug,
          planId,
          adminEmail: `first-${Date.now()}@e2e.com`,
          adminPassword: 'Password123!',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/provider/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Segunda',
          slug,
          planId,
          adminEmail: `second-${Date.now()}@e2e.com`,
          adminPassword: 'Password123!',
        })
        .expect(409);
    });
  });

  describe('GET /provider/tenants/:id', () => {
    it('debe devolver detalle del tenant', async () => {
      if (!createdTenantId) return;
      const res = await request(app.getHttpServer())
        .get(`/provider/tenants/${createdTenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(res.body.id).toBe(createdTenantId);
      expect(res.body).toHaveProperty('_count');
      expect(res.body._count).toHaveProperty('users');
      expect(res.body).toHaveProperty('subscription');
    });

    it('debe retornar 404 para tenant inexistente', async () => {
      const fakeId = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .get(`/provider/tenants/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /provider/tenants/:id/status', () => {
    it('debe suspender y reactivar tenant', async () => {
      if (!createdTenantId) return;
      await request(app.getHttpServer())
        .patch(`/provider/tenants/${createdTenantId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false })
        .expect(200);

      const tenant = await prisma.tenant.findUnique({
        where: { id: createdTenantId },
      });
      expect(tenant?.isActive).toBe(false);

      await request(app.getHttpServer())
        .patch(`/provider/tenants/${createdTenantId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: true })
        .expect(200);
    });
  });

  describe('PATCH /provider/tenants/:id', () => {
    it('debe cambiar plan del tenant', async () => {
      if (!createdTenantId) return;
      const otherPlan = await prisma.plan.create({
        data: {
          name: 'Plan B E2E',
          slug: `plan-b-e2e-${Date.now()}`,
          isActive: true,
        },
      });

      await request(app.getHttpServer())
        .patch(`/provider/tenants/${createdTenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: otherPlan.id })
        .expect(200);

      const sub = await prisma.subscription.findUnique({
        where: { tenantId: createdTenantId },
      });
      expect(sub?.planId).toBe(otherPlan.id);
    });
  });

  describe('PATCH /provider/tenants/:id/subscription/renew', () => {
    it('debe prorrogar suscripción', async () => {
      if (!createdTenantId) return;
      const subBefore = await prisma.subscription.findUnique({
        where: { tenantId: createdTenantId },
      });
      const endBefore = subBefore?.currentPeriodEnd?.getTime();

      const res = await request(app.getHttpServer())
        .patch(`/provider/tenants/${createdTenantId}/subscription/renew`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ extendDays: 30 })
        .expect(200);

      expect(res.body).toHaveProperty('currentPeriodEnd');
      const subAfter = await prisma.subscription.findUnique({
        where: { tenantId: createdTenantId },
      });
      expect(subAfter?.currentPeriodEnd).toBeDefined();
      if (endBefore && subAfter?.currentPeriodEnd) {
        expect(subAfter.currentPeriodEnd.getTime()).toBeGreaterThanOrEqual(
          endBefore,
        );
      }
    });

    it('debe retornar 404 para tenant sin suscripción', async () => {
      const tenantSinSub = await prisma.tenant.create({
        data: {
          name: 'Sin Sub',
          slug: `sin-sub-${Date.now()}`,
          isActive: true,
        },
      });
      await prisma.subscription.deleteMany({
        where: { tenantId: tenantSinSub.id },
      });
      await request(app.getHttpServer())
        .patch(`/provider/tenants/${tenantSinSub.id}/subscription/renew`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ extendDays: 30 })
        .expect(404);
    });
  });
});
