import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Plan Limits (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let tenantId: string;
  let planId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Crear admin de plataforma para tests
    const admin = await prisma.user.findFirst({
      where: { email: 'platform@admin.local' },
    });
    if (!admin) {
      throw new Error('Admin de plataforma no encontrado. Ejecuta seed primero.');
    }

    // Login como admin de plataforma
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'platform@admin.local', password: 'PlatformAdmin1!' });
    adminToken = loginRes.body.accessToken;

    // Crear plan con límite de 2 usuarios
    const planRes = await request(app.getHttpServer())
      .post('/provider/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Plan Test Limitado',
        slug: 'plan-test-limitado',
        maxUsers: 2,
        isActive: true,
      });
    planId = planRes.body.id;

    // Crear tenant con ese plan
    const tenantRes = await request(app.getHttpServer())
      .post('/provider/tenants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Tenant Test',
        slug: 'tenant-test-limits',
        adminEmail: 'admin@tenant-test.com',
        adminPassword: 'Admin123!',
        planId,
      });
    tenantId = tenantRes.body.tenant.id;

    // Login como admin del tenant
    const tenantLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@tenant-test.com', password: 'Admin123!' });
    adminToken = tenantLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // Limpiar datos de test
    if (tenantId) {
      await prisma.tenant.deleteMany({ where: { slug: 'tenant-test-limits' } });
    }
    if (planId) {
      await prisma.plan.deleteMany({ where: { slug: 'plan-test-limitado' } });
    }
    await app.close();
  });

  it('debe permitir crear usuarios hasta el límite', async () => {
    // Crear primer usuario (debe funcionar)
    const res1 = await request(app.getHttpServer())
      .post('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'user1@test.com',
        password: 'Password123!',
        role: 'USER',
      });
    expect(res1.status).toBe(201);

    // Crear segundo usuario (debe funcionar, límite es 2)
    const res2 = await request(app.getHttpServer())
      .post('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'user2@test.com',
        password: 'Password123!',
        role: 'USER',
      });
    expect(res2.status).toBe(201);

    // Intentar crear tercer usuario (debe fallar)
    const res3 = await request(app.getHttpServer())
      .post('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'user3@test.com',
        password: 'Password123!',
        role: 'USER',
      });
    expect(res3.status).toBe(400);
    expect(res3.body.message).toContain('límite de usuarios');
  });

  it('debe devolver límites del tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/limits')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('maxUsers', 2);
    expect(res.body).toHaveProperty('currentUsers');
    expect(res.body).toHaveProperty('canAddUsers', false); // Ya tenemos 2 usuarios
  });
});
