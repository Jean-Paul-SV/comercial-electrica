import { Test, TestingModule } from '@nestjs/testing';
import { PlanLimitsMonitorScheduler } from './plan-limits-monitor.scheduler';
import { PlanLimitsMonitorService } from '../services/plan-limits-monitor.service';
import { Logger } from '@nestjs/common';

describe('PlanLimitsMonitorScheduler', () => {
  let scheduler: PlanLimitsMonitorScheduler;
  let monitorService: jest.Mocked<PlanLimitsMonitorService>;

  const mockMonitorService = {
    checkAndAlertLimitViolations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanLimitsMonitorScheduler,
        {
          provide: PlanLimitsMonitorService,
          useValue: mockMonitorService,
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

    scheduler = module.get<PlanLimitsMonitorScheduler>(
      PlanLimitsMonitorScheduler,
    );
    monitorService = module.get(PlanLimitsMonitorService);

    jest.clearAllMocks();
  });

  describe('checkPlanLimits', () => {
    it('debe ejecutar verificación exitosamente', async () => {
      mockMonitorService.checkAndAlertLimitViolations.mockResolvedValue({
        checked: 10,
        violations: 2,
        alertsSent: 2,
        blocked: 0,
      });

      await scheduler.checkPlanLimits();

      expect(
        mockMonitorService.checkAndAlertLimitViolations,
      ).toHaveBeenCalledTimes(1);
    });

    it('debe manejar errores en verificación', async () => {
      mockMonitorService.checkAndAlertLimitViolations.mockRejectedValue(
        new Error('Error de BD'),
      );

      await expect(scheduler.checkPlanLimits()).resolves.not.toThrow();
    });
  });
});
