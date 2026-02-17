import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryMovementDto } from './dto/create-movement.dto';
import { InventoryMovementType } from '@prisma/client';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';
import { TenantContextService } from '../common/services/tenant-context.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: jest.Mocked<PrismaService>;

  const mockProduct = {
    id: 'product-1',
    internalCode: 'PROD-001',
    name: 'Producto Test',
  };

  beforeEach(async () => {
    const mockPrisma = {
      $transaction: jest.fn(),
      inventoryMovement: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ValidationLimitsService,
          useValue: {
            validateInventoryQty: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logCreate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            ensureTenant: jest.fn((tenantId) => tenantId || 'tenant-default'),
          },
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    prisma = module.get(PrismaService);

    // Mock por defecto: todos los productos existen
    prisma.product.findMany = jest.fn().mockResolvedValue([mockProduct]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMovement', () => {
    it('debe crear un movimiento de entrada (IN) exitosamente', async () => {
      const dto: CreateInventoryMovementDto = {
        type: InventoryMovementType.IN,
        reason: 'Compra inicial',
        items: [
          {
            productId: 'product-1',
            qty: 100,
            unitCost: 1000,
          },
        ],
      };

      const mockStockBalance = {
        productId: 'product-1',
        qtyOnHand: 0,
        qtyReserved: 0,
        updatedAt: new Date(),
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          inventoryMovement: {
            create: jest.fn().mockResolvedValue({
              id: 'movement-1',
              type: InventoryMovementType.IN,
              reason: 'Compra inicial',
              createdBy: null,
              createdAt: new Date(),
              items: [
                {
                  id: 'item-1',
                  movementId: 'movement-1',
                  productId: 'product-1',
                  qty: 100,
                  unitCost: 1000,
                  createdAt: new Date(),
                },
              ],
            }),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue(mockStockBalance),
            update: jest.fn().mockResolvedValue({
              ...mockStockBalance,
              qtyOnHand: 100, // 0 + 100
            }),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createMovement(dto);

      expect(result.type).toBe(InventoryMovementType.IN);
      expect(result.reason).toBe('Compra inicial');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].qty).toBe(100);
    });

    it('debe crear un movimiento de salida (OUT) y descontar stock', async () => {
      const dto: CreateInventoryMovementDto = {
        type: InventoryMovementType.OUT,
        reason: 'Ajuste de inventario',
        items: [
          {
            productId: 'product-1',
            qty: 20,
            unitCost: null,
          },
        ],
      };

      const mockStockBalance = {
        productId: 'product-1',
        qtyOnHand: 100,
        qtyReserved: 0,
        updatedAt: new Date(),
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          inventoryMovement: {
            create: jest.fn().mockResolvedValue({
              id: 'movement-2',
              type: InventoryMovementType.OUT,
              reason: 'Ajuste de inventario',
              createdBy: null,
              createdAt: new Date(),
              items: [
                {
                  id: 'item-2',
                  movementId: 'movement-2',
                  productId: 'product-1',
                  qty: 20,
                  unitCost: null,
                  createdAt: new Date(),
                },
              ],
            }),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue(mockStockBalance),
            update: jest.fn().mockResolvedValue({
              ...mockStockBalance,
              qtyOnHand: 80, // 100 - 20
            }),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createMovement(dto);

      expect(result.type).toBe(InventoryMovementType.OUT);
      expect(result.items[0].qty).toBe(20);
    });

    it('debe crear un ajuste (ADJUST) correctamente', async () => {
      const dto: CreateInventoryMovementDto = {
        type: InventoryMovementType.ADJUST,
        reason: 'Corrección de inventario',
        items: [
          {
            productId: 'product-1',
            qty: 50,
            unitCost: null,
          },
        ],
      };

      const mockStockBalance = {
        productId: 'product-1',
        qtyOnHand: 100,
        qtyReserved: 0,
        updatedAt: new Date(),
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          inventoryMovement: {
            create: jest.fn().mockResolvedValue({
              id: 'movement-3',
              type: InventoryMovementType.ADJUST,
              reason: 'Corrección de inventario',
              createdBy: null,
              createdAt: new Date(),
              items: [],
            }),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue(mockStockBalance),
            update: jest.fn().mockResolvedValue({
              ...mockStockBalance,
              qtyOnHand: 150, // 100 + 50 (ADJUST suma)
            }),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createMovement(dto);

      expect(result.type).toBe(InventoryMovementType.ADJUST);
    });

    it('debe lanzar error si no hay items', async () => {
      const dtoSinItems: CreateInventoryMovementDto = {
        type: InventoryMovementType.IN,
        reason: 'Test',
        items: [],
      };

      await expect(service.createMovement(dtoSinItems)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createMovement(dtoSinItems)).rejects.toThrow(
        'Debe incluir items.',
      );
    });

    it('debe lanzar error si uno o más productos no existen', async () => {
      const dto: CreateInventoryMovementDto = {
        type: InventoryMovementType.IN,
        reason: 'Compra',
        items: [
          {
            productId: 'product-1',
            qty: 50,
            unitCost: 1000,
          },
          {
            productId: 'product-inexistente',
            qty: 30,
            unitCost: 2000,
          },
        ],
      };

      // Solo encuentra product-1, falta product-inexistente
      prisma.product = {
        findMany: jest.fn().mockResolvedValue([mockProduct]),
      } as any;

      await expect(service.createMovement(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createMovement(dto)).rejects.toThrow('no existen');
    });

    it('debe lanzar error si stock es insuficiente para salida', async () => {
      const dto: CreateInventoryMovementDto = {
        type: InventoryMovementType.OUT,
        reason: 'Salida',
        items: [
          {
            productId: 'product-1',
            qty: 150, // Más de lo disponible
            unitCost: null,
          },
        ],
      };

      const mockStockBalance = {
        productId: 'product-1',
        qtyOnHand: 100, // Solo hay 100
        qtyReserved: 0,
        updatedAt: new Date(),
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          inventoryMovement: {
            create: jest.fn().mockResolvedValue({
              id: 'movement-1',
              type: InventoryMovementType.OUT,
              items: [],
            }),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue(mockStockBalance),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      await expect(service.createMovement(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createMovement(dto)).rejects.toThrow(
        'Stock insuficiente',
      );
    });

    it('debe manejar múltiples items en un movimiento', async () => {
      const dto: CreateInventoryMovementDto = {
        type: InventoryMovementType.IN,
        reason: 'Compra múltiple',
        items: [
          {
            productId: 'product-1',
            qty: 50,
            unitCost: 1000,
          },
          {
            productId: 'product-2',
            qty: 30,
            unitCost: 2000,
          },
        ],
      };

      // Mockear productos adicionales
      const mockProduct2 = {
        id: 'product-2',
        internalCode: 'PROD-002',
        name: 'Producto Test 2',
      };

      prisma.product.findMany = jest
        .fn()
        .mockResolvedValue([mockProduct, mockProduct2]);

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          inventoryMovement: {
            create: jest.fn().mockResolvedValue({
              id: 'movement-1',
              type: InventoryMovementType.IN,
              items: [
                { productId: 'product-1', qty: 50 },
                { productId: 'product-2', qty: 30 },
              ],
            }),
          },
          stockBalance: {
            upsert: jest
              .fn()
              .mockResolvedValueOnce({
                productId: 'product-1',
                qtyOnHand: 0,
                qtyReserved: 0,
                updatedAt: new Date(),
              })
              .mockResolvedValueOnce({
                productId: 'product-2',
                qtyOnHand: 0,
                qtyReserved: 0,
                updatedAt: new Date(),
              }),
            update: jest
              .fn()
              .mockResolvedValueOnce({
                productId: 'product-1',
                qtyOnHand: 50,
              })
              .mockResolvedValueOnce({
                productId: 'product-2',
                qtyOnHand: 30,
              }),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createMovement(dto);

      expect(result.items).toHaveLength(2);
    });

    it('debe crear balance si no existe', async () => {
      const dto: CreateInventoryMovementDto = {
        type: InventoryMovementType.IN,
        reason: 'Primera entrada',
        items: [
          {
            productId: 'product-nuevo',
            qty: 10,
            unitCost: 500,
          },
        ],
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          inventoryMovement: {
            create: jest.fn().mockResolvedValue({
              id: 'movement-1',
              type: InventoryMovementType.IN,
              items: [],
            }),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue({
              productId: 'product-nuevo',
              qtyOnHand: 0, // Creado con 0
              qtyReserved: 0,
              updatedAt: new Date(),
            }),
            update: jest.fn().mockResolvedValue({
              productId: 'product-nuevo',
              qtyOnHand: 10,
            }),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createMovement(dto);

      expect(result).toBeDefined();
    });
  });

  describe('listMovements', () => {
    it('debe listar movimientos ordenados por fecha descendente', async () => {
      const mockMovements = [
        {
          id: 'movement-1',
          type: InventoryMovementType.IN,
          reason: 'Compra',
          createdBy: null,
          createdAt: new Date('2026-01-22'),
          items: [],
        },
        {
          id: 'movement-2',
          type: InventoryMovementType.OUT,
          reason: 'Venta',
          createdBy: null,
          createdAt: new Date('2026-01-21'),
          items: [],
        },
      ];

      prisma.inventoryMovement.findMany = jest
        .fn()
        .mockResolvedValue(mockMovements);
      prisma.inventoryMovement.count = jest.fn().mockResolvedValue(2);

      const result = await service.listMovements();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toEqual(mockMovements);
      expect(result.meta.total).toBe(2);
      expect(prisma.inventoryMovement.findMany).toHaveBeenCalled();
      expect(prisma.inventoryMovement.count).toHaveBeenCalled();
    });
  });
});
