import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as request from 'supertest';
import { App } from 'supertest/types';

describe('Cash (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

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
    await prisma.cashMovement.deleteMany();
    await prisma.cashSession.deleteMany();
    await prisma.user.deleteMany();

    // Crear usuario y obtener token
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      await request(app.getHttpServer())
        .post('/auth/bootstrap-admin')
        .send({
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

    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });
    if (user) {
      userId = user.id;
    }
  });

  afterEach(async () => {
    await prisma.cashMovement.deleteMany();
    await prisma.cashSession.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /cash/sessions', () => {
    it('debe abrir una sesión de caja exitosamente', async () => {
      const response = await request(app.getHttpServer())
        .post('/cash/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          openingAmount: 50000,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.openingAmount).toBe(50000);
      expect(response.body.closedAt).toBeNull();
    });

    it('debe abrir sesión con diferentes montos', async () => {
      const response = await request(app.getHttpServer())
        .post('/cash/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          openingAmount: 100000,
        })
        .expect(201);

      expect(response.body.openingAmount).toBe(100000);
    });
  });

  describe('POST /cash/sessions/:id/close', () => {
    it('debe cerrar una sesión de caja exitosamente', async () => {
      // Abrir sesión
      const openResponse = await request(app.getHttpServer())
        .post('/cash/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          openingAmount: 50000,
        });

      const sessionId = openResponse.body.id;

      // Cerrar sesión
      const closeResponse = await request(app.getHttpServer())
        .post(`/cash/sessions/${sessionId}/close`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          closingAmount: 65000,
        })
        .expect(200);

      expect(closeResponse.body.closedAt).toBeDefined();
      expect(closeResponse.body.closingAmount).toBe(65000);
    });

    it('debe fallar si la sesión no existe', async () => {
      await request(app.getHttpServer())
        .post('/cash/sessions/non-existent-id/close')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          closingAmount: 50000,
        })
        .expect(404);
    });
  });

  describe('GET /cash/sessions', () => {
    it('debe listar las sesiones de caja', async () => {
      // Crear algunas sesiones
      await request(app.getHttpServer())
        .post('/cash/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          openingAmount: 50000,
        });

      const response = await request(app.getHttpServer())
        .get('/cash/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /cash/sessions/:id/movements', () => {
    it('debe listar los movimientos de una sesión', async () => {
      // Abrir sesión
      const openResponse = await request(app.getHttpServer())
        .post('/cash/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          openingAmount: 50000,
        });

      const sessionId = openResponse.body.id;

      // Los movimientos se crean automáticamente cuando hay ventas
      // Por ahora, verificamos que el endpoint funciona
      const response = await request(app.getHttpServer())
        .get(`/cash/sessions/${sessionId}/movements`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
