import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp } from './test-helpers';
import request from 'supertest';
import { App } from 'supertest/types';

describe('Cash (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    // Setup simplificado: una línea reemplaza 100+ líneas
    const setup = await setupTestApp(moduleFixture, 'cash-test@example.com');
    ({ app, prisma, authToken } = setup);
  });

  afterEach(async () => {
    await prisma.cashMovement.deleteMany();
    await prisma.cashSession.deleteMany();
  });

  afterAll(async () => {
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
      // Decimal se serializa como string, convertir a número
      expect(Number(response.body.openingAmount)).toBe(50000);
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

      // Decimal se serializa como string, convertir a número
      expect(Number(response.body.openingAmount)).toBe(100000);
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
      // Decimal se serializa como string, convertir a número
      expect(Number(closeResponse.body.closingAmount)).toBe(65000);
    });

    it('debe fallar si la sesión no existe', async () => {
      // Usar un UUID válido que no existe en la base de datos
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/cash/sessions/${nonExistentId}/close`)
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

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toBeDefined();
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

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
    });
  });
});
