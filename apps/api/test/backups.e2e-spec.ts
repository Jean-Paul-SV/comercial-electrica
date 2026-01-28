import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupTestModule, setupTestApp } from './test-helpers';
import request from 'supertest';
import { App } from 'supertest/types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Verificar si pg_dump está disponible
async function isPgDumpAvailable(): Promise<boolean> {
  try {
    await execAsync('pg_dump --version');
    return true;
  } catch {
    return false;
  }
}

describe('Backups (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authToken: string;
  let pgDumpAvailable: boolean;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await setupTestModule(
      Test.createTestingModule({
        imports: [AppModule],
      }),
    ).compile();

    // Setup simplificado
    const setup = await setupTestApp(moduleFixture, 'backups-test@example.com');
    ({ app, prisma, authToken } = setup);

    // Verificar si pg_dump está disponible
    pgDumpAvailable = await isPgDumpAvailable();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /backups', () => {
    it('debe crear un backup exitosamente (requiere ADMIN)', async () => {
      const response = await request(app.getHttpServer())
        .post('/backups')
        .set('Authorization', `Bearer ${authToken}`);

      if (!pgDumpAvailable) {
        // Si pg_dump no está disponible, el backup fallará pero el registro se crea
        expect([201, 500]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body).toHaveProperty('id');
        }
        // Saltar el resto de las verificaciones si pg_dump no está disponible
        return;
      }

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('storagePath');
      expect(response.body).toHaveProperty('checksum');
      expect(response.body.status).toBe('COMPLETED');
    });

    it('debe rechazar sin autenticación', async () => {
      await request(app.getHttpServer()).post('/backups').expect(401);
    });
  });

  describe('GET /backups', () => {
    it('debe listar todos los backups', async () => {
      // Crear un backup primero (puede fallar si pg_dump no está disponible)
      await request(app.getHttpServer())
        .post('/backups')
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app.getHttpServer())
        .get('/backups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Puede haber backups con status FAILED si pg_dump no está disponible
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('startedAt');
    });
  });

  describe('GET /backups/:id', () => {
    it('debe obtener un backup por ID', async () => {
      // Crear un backup (puede fallar si pg_dump no está disponible)
      const createResponse = await request(app.getHttpServer())
        .post('/backups')
        .set('Authorization', `Bearer ${authToken}`);

      // Si el backup falló, el body puede no tener id
      if (!createResponse.body?.id) {
        // Buscar cualquier backup existente en la BD
        const backups = await prisma.backupRun.findMany({ take: 1 });
        if (backups.length === 0) {
          // No hay backups para probar, saltar este test
          return;
        }
        const backupId = backups[0].id;

        const response = await request(app.getHttpServer())
          .get(`/backups/${backupId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.id).toBe(backupId);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('startedAt');
        return;
      }

      const backupId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .get(`/backups/${backupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(backupId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('startedAt');
    });

    it('debe retornar 404 para backup inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/backups/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /backups/:id/verify', () => {
    it('debe verificar la integridad de un backup', async () => {
      if (!pgDumpAvailable) {
        // Si pg_dump no está disponible, buscar un backup existente o crear uno fallido
        const backups = await prisma.backupRun.findMany({ take: 1 });
        if (backups.length === 0) {
          // Crear un backup que fallará
          await request(app.getHttpServer())
            .post('/backups')
            .set('Authorization', `Bearer ${authToken}`);
          
          const newBackups = await prisma.backupRun.findMany({ take: 1 });
          if (newBackups.length === 0) {
            return; // No hay backups para probar
          }
          const backupId = newBackups[0].id;

          const response = await request(app.getHttpServer())
            .post(`/backups/${backupId}/verify`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('isValid');
          expect(typeof response.body.isValid).toBe('boolean');
          return;
        }
        const backupId = backups[0].id;

        const response = await request(app.getHttpServer())
          .post(`/backups/${backupId}/verify`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('isValid');
        expect(typeof response.body.isValid).toBe('boolean');
        return;
      }

      // Crear un backup exitoso
      const createResponse = await request(app.getHttpServer())
        .post('/backups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const backupId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .post(`/backups/${backupId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('isValid');
      expect(typeof response.body.isValid).toBe('boolean');
    });
  });

  describe('DELETE /backups/:id', () => {
    it('debe eliminar un backup', async () => {
      // Crear un backup (puede fallar si pg_dump no está disponible, pero el registro se crea)
      const createResponse = await request(app.getHttpServer())
        .post('/backups')
        .set('Authorization', `Bearer ${authToken}`);

      // Si no hay id en la respuesta, buscar en la BD
      let backupId: string;
      if (createResponse.body?.id) {
        backupId = createResponse.body.id;
      } else {
        // Buscar el último backup creado
        const backups = await prisma.backupRun.findMany({
          orderBy: { startedAt: 'desc' },
          take: 1,
        });
        if (backups.length === 0) {
          // No hay backups para probar
          return;
        }
        backupId = backups[0].id;
      }

      await request(app.getHttpServer())
        .delete(`/backups/${backupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verificar que fue eliminado
      await request(app.getHttpServer())
        .get(`/backups/${backupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
