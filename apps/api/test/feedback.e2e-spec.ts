import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp, shutdownTestApp } from './test-helpers';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { RoleName } from '@prisma/client';

describe('Feedback (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tenantToken: string;
  let platformToken: string;
  let tenantId: string;
  let createdFeedbackId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    const setup = await setupTestApp(
      moduleFixture,
      'feedback-tenant@test.e2e.local',
    );
    ({ app, prisma, authToken: tenantToken, tenantId } = setup);

    const adminRole = await prisma.role.findFirst({
      where: { slug: 'admin', tenantId: null },
    });
    if (!adminRole) {
      throw new Error(
        'Rol admin (tenantId null) no encontrado. Ejecuta el seed.',
      );
    }
    const platformEmail = 'feedback-platform@test.e2e.local';
    const platformUser = await prisma.user.create({
      data: {
        email: platformEmail,
        passwordHash: await argon2.hash('Test123!'),
        role: RoleName.ADMIN,
        tenantId: null,
        isActive: true,
      },
    });
    await prisma.userRole.create({
      data: {
        userId: platformUser.id,
        roleId: adminRole.id,
        tenantId: null,
      },
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: platformEmail, password: 'Test123!' });
    if (
      (loginRes.status !== 200 && loginRes.status !== 201) ||
      !loginRes.body?.accessToken
    ) {
      throw new Error(
        `Platform login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
      );
    }
    platformToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await shutdownTestApp({ app, prisma });
  });

  describe('Tenant: POST /feedback', () => {
    it('crea una sugerencia y devuelve 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/feedback')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ message: 'Sugerencia E2E: exportar clientes a Excel' })
        .expect(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('exportar clientes');
      createdFeedbackId = res.body.id;
    });

    it('rechaza mensaje vacío con 400', async () => {
      await request(app.getHttpServer())
        .post('/feedback')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ message: '' })
        .expect(400);
    });
  });

  describe('Tenant: GET /feedback/my', () => {
    it('devuelve la lista de sugerencias del usuario', async () => {
      const res = await request(app.getHttpServer())
        .get('/feedback/my')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const found = res.body.find((f: { id: string }) => f.id === createdFeedbackId);
      expect(found).toBeDefined();
      expect(found.message).toContain('exportar clientes');
    });
  });

  describe('Provider: GET /provider/feedback', () => {
    it('lista sugerencias de todos los tenants', async () => {
      const res = await request(app.getHttpServer())
        .get('/provider/feedback')
        .set('Authorization', `Bearer ${platformToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const found = res.body.find(
        (f: { id: string }) => f.id === createdFeedbackId,
      );
      expect(found).toBeDefined();
    });
  });

  describe('Provider: PATCH /provider/feedback/:id', () => {
    it('actualiza el estado de una sugerencia', async () => {
      await request(app.getHttpServer())
        .patch(`/provider/feedback/${createdFeedbackId}`)
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ status: 'READ' })
        .expect(200);

      const updated = await prisma.tenantFeedback.findUnique({
        where: { id: createdFeedbackId },
      });
      expect(updated?.status).toBe('READ');
    });
  });
});
