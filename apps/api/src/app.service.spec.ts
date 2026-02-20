import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './common/services/cache.service';

const mockPrisma = {
  $queryRaw: jest.fn(),
};

const mockCache = {
  ping: jest.fn().mockResolvedValue('connected'),
};

const mockQueue = {
  getJobCounts: jest.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
  }),
};

describe('AppService', () => {
  let service: AppService;
  const envBackup: Record<string, string | undefined> = {};

  beforeAll(() => {
    envBackup.NODE_ENV = process.env.NODE_ENV;
    envBackup.ARCHIVE_ENABLED = process.env.ARCHIVE_ENABLED;
  });

  afterAll(() => {
    process.env.NODE_ENV = envBackup.NODE_ENV;
    process.env.ARCHIVE_ENABLED = envBackup.ARCHIVE_ENABLED;
  });

  beforeEach(async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce(undefined) // SELECT 1
      .mockResolvedValueOnce([{ state: 'active', count: 1n }, { state: 'idle', count: 2n }]); // pg_stat_activity

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: getQueueToken('dian'), useValue: mockQueue },
        { provide: getQueueToken('backup'), useValue: mockQueue },
        { provide: getQueueToken('reports'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('devuelve el mensaje de bienvenida', () => {
      expect(service.getHello()).toBe('Orion API v1.0');
    });
  });

  describe('getHealth', () => {
    it('devuelve status, timestamp, uptime, services y warnings', async () => {
      const health = await service.getHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('warnings');
      expect(Array.isArray(health.warnings)).toBe(true);
    });

    it('en producción sin ARCHIVE_ENABLED=true incluye aviso de archivado en warnings', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ARCHIVE_ENABLED;

      const health = await service.getHealth();
      const archiveWarning = health.warnings?.find(
        (w: string) => w.includes('Archivado automático') && w.includes('ARCHIVE_ENABLED'),
      );
      expect(archiveWarning).toBeDefined();
      expect(archiveWarning).toContain('ARCHIVE_ENABLED');
    });

    it('en producción con ARCHIVE_ENABLED=true no incluye aviso de archivado', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ARCHIVE_ENABLED = 'true';

      const health = await service.getHealth();
      const archiveWarning = health.warnings?.find(
        (w: string) => w.includes('Archivado automático') && w.includes('ARCHIVE_ENABLED'),
      );
      expect(archiveWarning).toBeUndefined();
    });

    it('en development no incluye aviso de archivado aunque ARCHIVE_ENABLED no esté en true', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ARCHIVE_ENABLED;

      const health = await service.getHealth();
      const archiveWarning = health.warnings?.find(
        (w: string) => w.includes('Archivado automático') && w.includes('ARCHIVE_ENABLED'),
      );
      expect(archiveWarning).toBeUndefined();
    });
  });
});
