import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './common/services/cache.service';
import { PermissionsService } from './auth/permissions.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getQueueToken('dian'),
          useValue: { getJobCounts: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: getQueueToken('backup'),
          useValue: { getJobCounts: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: getQueueToken('reports'),
          useValue: { getJobCounts: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: CacheService,
          useValue: {
            ping: jest.fn().mockResolvedValue('connected'),
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            deletePattern: jest.fn(),
            invalidateEntity: jest.fn(),
            buildKey: jest.fn(),
          },
        },
        {
          provide: PermissionsService,
          useValue: { getPermissionsForRole: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ count: 1 }]),
            user: { count: jest.fn().mockResolvedValue(0) },
            product: { count: jest.fn().mockResolvedValue(0) },
            customer: { count: jest.fn().mockResolvedValue(0) },
            sale: {
              count: jest.fn().mockResolvedValue(0),
              aggregate: jest.fn().mockResolvedValue({
                _sum: { grandTotal: 0 },
                _count: { id: 0 },
              }),
            },
            quote: { count: jest.fn().mockResolvedValue(0) },
            cashSession: { count: jest.fn().mockResolvedValue(0) },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return welcome message', () => {
      expect(appController.getHello()).toBe(
        'Sistema Comercial Eléctrica API v1.0',
      );
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const health = await appController.getHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('environment');
      expect(health).toHaveProperty('services');
    });
  });
});
