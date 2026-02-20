import { Test, TestingModule } from '@nestjs/testing';
import { DianCertMonitorScheduler } from './dian-cert-monitor.scheduler';
import { DianCertMonitorService } from './dian-cert-monitor.service';
import { Logger } from '@nestjs/common';

describe('DianCertMonitorScheduler', () => {
  let scheduler: DianCertMonitorScheduler;
  let certMonitor: jest.Mocked<DianCertMonitorService>;

  const mockCertMonitor = {
    checkAndAlertCertificates: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DianCertMonitorScheduler,
        {
          provide: DianCertMonitorService,
          useValue: mockCertMonitor,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    scheduler = module.get<DianCertMonitorScheduler>(DianCertMonitorScheduler);
    certMonitor = module.get(DianCertMonitorService);

    jest.clearAllMocks();
  });

  describe('checkCertificates', () => {
    it('debe ejecutar verificación exitosamente', async () => {
      mockCertMonitor.checkAndAlertCertificates.mockResolvedValue({
        checked: 5,
        expiring: 2,
        expired: 1,
        alertsSent: 3,
      });

      await scheduler.checkCertificates();

      expect(mockCertMonitor.checkAndAlertCertificates).toHaveBeenCalledTimes(
        1,
      );
    });

    it('debe manejar errores en verificación', async () => {
      mockCertMonitor.checkAndAlertCertificates.mockRejectedValue(
        new Error('Error de BD'),
      );

      await expect(scheduler.checkCertificates()).resolves.not.toThrow();
    });
  });
});
