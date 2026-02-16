import { Test, TestingModule } from '@nestjs/testing';
import { ValidationLimitsService } from './validation-limits.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('ValidationLimitsService', () => {
  let service: ValidationLimitsService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationLimitsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ValidationLimitsService>(ValidationLimitsService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
    
    // Valores por defecto
    mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
      const defaults: Record<string, any> = {
        MAX_INVENTORY_QTY: 1000000,
        MIN_INVENTORY_QTY: 0,
        MAX_CASH_AMOUNT: 100000000,
        MIN_CASH_AMOUNT: 0,
        MAX_OPENING_AMOUNT: 50000000,
        MAX_ITEMS_PER_SALE: 100,
        MAX_ITEMS_PER_QUOTE: 100,
        MAX_ITEMS_PER_PURCHASE: 100,
        MAX_QTY_PER_ITEM: 10000,
      };
      return defaults[key] ?? defaultValue;
    });
  });

  describe('validateInventoryQty', () => {
    it('debe permitir cantidad válida', () => {
      expect(() => service.validateInventoryQty(100, 'IN')).not.toThrow();
      expect(() => service.validateInventoryQty(0, 'OUT')).not.toThrow();
      expect(() => service.validateInventoryQty(500000, 'ADJUST')).not.toThrow();
    });

    it('debe lanzar error si cantidad es menor al mínimo', () => {
      expect(() => service.validateInventoryQty(-1, 'IN')).toThrow(
        BadRequestException,
      );
      expect(() => service.validateInventoryQty(-1, 'IN')).toThrow('mínima permitida');
    });

    it('debe lanzar error si cantidad excede el máximo', () => {
      expect(() => service.validateInventoryQty(2000000, 'IN')).toThrow(
        BadRequestException,
      );
      expect(() => service.validateInventoryQty(2000000, 'IN')).toThrow('máxima permitida');
    });
  });

  describe('validateCashAmount', () => {
    it('debe permitir monto válido para apertura', () => {
      expect(() => service.validateCashAmount(100000, 'opening')).not.toThrow();
      expect(() => service.validateCashAmount(0, 'opening')).not.toThrow();
    });

    it('debe permitir monto válido para movimiento', () => {
      expect(() => service.validateCashAmount(50000, 'movement')).not.toThrow();
      expect(() => service.validateCashAmount(0, 'movement')).not.toThrow();
    });

    it('debe lanzar error si monto es negativo', () => {
      expect(() => service.validateCashAmount(-1, 'opening')).toThrow(
        BadRequestException,
      );
    });

    it('debe lanzar error si monto de apertura excede el máximo', () => {
      mockConfigService.get.mockReturnValueOnce(50000000); // MAX_OPENING_AMOUNT
      expect(() => service.validateCashAmount(60000000, 'opening')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateSaleItems', () => {
    it('debe permitir número válido de items', () => {
      const items = Array(50).fill({ productId: 'prod-1', qty: 1 });
      expect(() => service.validateSaleItems(items)).not.toThrow();
    });

    it('debe lanzar error si hay demasiados items', () => {
      const items = Array(101).fill({ productId: 'prod-1', qty: 1 });
      expect(() => service.validateSaleItems(items)).toThrow(BadRequestException);
      expect(() => service.validateSaleItems(items)).toThrow('máximo');
    });

    it('debe validar cantidad por item', () => {
      const items = [{ productId: 'prod-1', qty: 15000 }];
      expect(() => service.validateSaleItems(items)).toThrow(BadRequestException);
      expect(() => service.validateSaleItems(items)).toThrow('cantidad');
    });
  });

  describe('validateQuoteItems', () => {
    it('debe permitir número válido de items', () => {
      const items = Array(50).fill({ productId: 'prod-1', qty: 1 });
      expect(() => service.validateQuoteItems(items)).not.toThrow();
    });

    it('debe lanzar error si hay demasiados items', () => {
      const items = Array(101).fill({ productId: 'prod-1', qty: 1 });
      expect(() => service.validateQuoteItems(items)).toThrow(BadRequestException);
    });
  });
});
