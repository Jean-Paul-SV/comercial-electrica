import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  setupTestModule,
  cleanDatabase,
  shutdownTestApp,
} from './test-helpers';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';

describe('GET /stats (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tenantId: string;
  let tokenTenant: string;
  let tokenPlatformAdmin: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

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
    await cleanDatabase(prisma);

    const tenant = await prisma.tenant.create({
      data: {
        name: 'Stats Test Tenant',
        slug: `stats-tenant-${Date.now()}`,
        isActive: true,
      },
    });
    tenantId = tenant.id;

    await prisma.tenantModule.createMany({
      data: [{ tenantId, moduleCode: 'advanced_reports', enabled: true }],
    });

    const passwordHash = await argon2.hash('Test123!');

    const userTenant = await prisma.user.create({
      data: {
        email: `user-tenant-${Date.now()}@test.com`,
        passwordHash,
        role: 'ADMIN',
        tenantId,
        isActive: true,
      },
    });

    const userPlatformAdmin = await prisma.user.create({
      data: {
        email: `platform-admin-${Date.now()}@test.com`,
        passwordHash,
        role: 'ADMIN',
        tenantId: null,
        isActive: true,
      },
    });

    const loginTenant = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userTenant.email, password: 'Test123!' });
    tokenTenant = loginTenant.body?.accessToken;

    const loginPlatformAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userPlatformAdmin.email, password: 'Test123!' });
    tokenPlatformAdmin = loginPlatformAdmin.body?.accessToken;
  });

  afterAll(async () => {
    await shutdownTestApp({ app, prisma });
  });

  it('usuario con tenant obtiene stats de su tenant sin query', async () => {
    const response = await request(app.getHttpServer())
      .get('/stats')
      .set('Authorization', `Bearer ${tokenTenant}`)
      .expect(200);
    expect(response.body).toHaveProperty('users');
    expect(response.body).toHaveProperty('products');
    expect(response.body.users).toHaveProperty('total');
  });

  it('platform admin con ?tenantId= obtiene stats de ese tenant', async () => {
    const response = await request(app.getHttpServer())
      .get(`/stats?tenantId=${tenantId}`)
      .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
      .expect(200);
    expect(response.body).toHaveProperty('tenantId', tenantId);
    expect(response.body.users.total).toBe(1);
  });
});
