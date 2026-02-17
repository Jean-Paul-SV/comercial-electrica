import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';
import { TenantContextService } from '../common/services/tenant-context.service';
import { DianService } from '../dian/dian.service';
import { CreateSaleUseCase } from './use-cases/create-sale.use-case';
import { CreateSaleDto } from './dto/create-sale.dto';
import {
  SaleStatus,
  InvoiceStatus,
  DianDocumentStatus,
  DianDocumentType,
  PaymentMethod,
} from '@prisma/client';

describe('SalesService', () => {
  let service: SalesService;
  let prisma: jest.Mocked<PrismaService>;
  let dianQueue: jest.Mocked<Queue>;

  const mockProduct = {
    id: 'product-1',
    internalCode: 'PROD-001',
    name: 'Producto Test',
    categoryId: null,
    cost: 1000,
    price: 2000,
    taxRate: 19,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    stock: {
      productId: 'product-1',
      qtyOnHand: 100,
      qtyReserved: 0,
      updatedAt: new Date(),
    },
  };

  const mockCustomer = {
    id: 'customer-1',
    docType: 'CC' as const,
    docNumber: '1234567890',
    name: 'Cliente Test',
    email: 'cliente@test.com',
    phone: '3001234567',
    address: null,
    cityCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCashSession = {
    id: 'session-1',
    openedAt: new Date(),
    closedAt: null,
    openingAmount: 50000,
    closingAmount: 0,
    openedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      $transaction: jest.fn(),
      sale: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      cashSession: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue(mockCustomer),
        findFirst: jest.fn().mockResolvedValue(mockCustomer),
      },
    };

    const mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: getQueueToken('dian'),
          useValue: mockQueue,
        },
        {
          provide: ValidationLimitsService,
          useValue: {
            validateItemsCount: jest.fn().mockResolvedValue(undefined),
            validateItemQty: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logCreate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            deletePattern: jest.fn().mockResolvedValue(undefined),
            buildKey: jest.fn((...args) => `cache:${args.join(':')}`),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            ensureTenant: jest.fn((tenantId) => tenantId || 'tenant-default'),
          },
        },
        {
          provide: DianService,
          useValue: {
            getConfigStatusForTenant: jest.fn().mockResolvedValue({ readyForSend: true, status: 'ready' }),
          },
        },
        CreateSaleUseCase,
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
    prisma = module.get(PrismaService);
    dianQueue = module.get(getQueueToken('dian'));

    // Mock por defecto para sesión de caja abierta (use case usa findFirst)
    prisma.cashSession.findFirst = jest.fn().mockResolvedValue(mockCashSession);
    prisma.cashSession.findUnique = jest.fn().mockResolvedValue(mockCashSession);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSale', () => {
    const createSaleDto: CreateSaleDto = {
      customerId: 'customer-1',
      cashSessionId: 'session-1',
      paymentMethod: PaymentMethod.CASH,
      items: [
        {
          productId: 'product-1',
          qty: 5,
        },
      ],
    };

    it('debe crear una venta exitosamente', async () => {
      // Mockear validaciones previas a la transacción
      prisma.customer.findUnique = jest.fn().mockResolvedValue(mockCustomer);

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([mockProduct]),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue(mockProduct.stock),
            update: jest
              .fn()
              .mockResolvedValue({ ...mockProduct.stock, qtyOnHand: 95 }),
          },
          sale: {
            create: jest.fn().mockResolvedValue({
              id: 'sale-1',
              customerId: 'customer-1',
              status: SaleStatus.PAID,
              subtotal: 10000,
              taxTotal: 1900,
              discountTotal: 0,
              grandTotal: 11900,
              soldAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              items: [
                {
                  id: 'item-1',
                  saleId: 'sale-1',
                  productId: 'product-1',
                  qty: 5,
                  unitPrice: 2000,
                  taxRate: 19,
                  lineTotal: 11900,
                },
              ],
            }),
          },
          cashMovement: {
            create: jest.fn().mockResolvedValue({
              id: 'movement-1',
              sessionId: 'session-1',
              type: 'IN',
              method: PaymentMethod.CASH,
              amount: 11900,
              relatedSaleId: 'sale-1',
              createdAt: new Date(),
            }),
          },
          invoice: {
            create: jest.fn().mockResolvedValue({
              id: 'invoice-1',
              saleId: 'sale-1',
              customerId: 'customer-1',
              number: 'INV-20260122-ABC123',
              issuedAt: new Date(),
              status: InvoiceStatus.ISSUED,
              subtotal: 10000,
              taxTotal: 1900,
              discountTotal: 0,
              grandTotal: 11900,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          dianDocument: {
            create: jest.fn().mockResolvedValue({
              id: 'dian-1',
              invoiceId: 'invoice-1',
              type: DianDocumentType.FE,
              status: DianDocumentStatus.DRAFT,
              cufe: null,
              xmlPath: null,
              pdfPath: null,
              lastError: null,
              sentAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({
              id: 'audit-1',
              actorId: 'user-1',
              entity: 'sale',
              entityId: 'sale-1',
              action: 'create',
              diff: { invoiceId: 'invoice-1', dianDocumentId: 'dian-1' },
              createdAt: new Date(),
            }),
          },
          inventoryMovement: {
            create: jest.fn().mockResolvedValue({ id: 'inv-mov-1' }),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createSale(createSaleDto, 'user-1');

      expect(result).toHaveProperty('sale');
      expect(result).toHaveProperty('invoice');
      expect(result).toHaveProperty('dianDocument');
      expect(result.sale.status).toBe(SaleStatus.PAID);
      expect(result.invoice.status).toBe(InvoiceStatus.ISSUED);
      expect(result.dianDocument.status).toBe(DianDocumentStatus.DRAFT);
      expect(dianQueue.add).toHaveBeenCalledWith(
        'send',
        { dianDocumentId: 'dian-1' },
        {
          jobId: 'dian-dian-1',
          attempts: 10,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    });

    it('debe lanzar error si no hay items', async () => {
      const dtoSinItems: CreateSaleDto = {
        ...createSaleDto,
        items: [],
      };

      await expect(service.createSale(dtoSinItems)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createSale(dtoSinItems)).rejects.toThrow(
        'Debe incluir items.',
      );
    });

    it('debe lanzar error si producto no existe', async () => {
      // Mockear validaciones previas
      prisma.customer.findUnique = jest.fn().mockResolvedValue(mockCustomer);

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([]), // Producto no encontrado
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const err = await service.createSale(createSaleDto).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse();
      expect(response).toMatchObject({
        message: 'Uno o más productos no existen o están inactivos.',
      });
    });

    it('debe lanzar error si stock es insuficiente', async () => {
      // Mockear validaciones previas
      prisma.customer.findUnique = jest.fn().mockResolvedValue(mockCustomer);

      const productoSinStock = {
        ...mockProduct,
        stock: {
          ...mockProduct.stock,
          qtyOnHand: 2, // Stock insuficiente para qty: 5
        },
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([productoSinStock]),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue(productoSinStock.stock),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      await expect(service.createSale(createSaleDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createSale(createSaleDto)).rejects.toThrow(
        'Stock insuficiente',
      );
    });

    it('debe lanzar error si no hay cashSessionId', async () => {
      const dtoSinCaja: CreateSaleDto = {
        ...createSaleDto,
        cashSessionId: undefined,
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([mockProduct]),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue(mockProduct.stock),
            update: jest.fn().mockResolvedValue(mockProduct.stock),
          },
          sale: {
            create: jest.fn().mockResolvedValue({
              id: 'sale-1',
              customerId: 'customer-1',
              status: SaleStatus.PAID,
              subtotal: 10000,
              taxTotal: 1900,
              discountTotal: 0,
              grandTotal: 11900,
              soldAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              items: [],
            }),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      await expect(service.createSale(dtoSinCaja)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createSale(dtoSinCaja)).rejects.toThrow(
        'cashSessionId requerido',
      );
    });

    it('debe lanzar error si la sesión de caja no existe', async () => {
      prisma.cashSession.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.createSale(createSaleDto)).rejects.toThrow(
        'Sesión de caja',
      );
      await expect(service.createSale(createSaleDto)).rejects.toThrow(
        'no encontrada',
      );
    });

    it('debe lanzar error si la sesión de caja está cerrada', async () => {
      const sessionCerrada = {
        ...mockCashSession,
        closedAt: new Date(),
      };

      prisma.cashSession.findFirst = jest.fn().mockResolvedValue(sessionCerrada);

      await expect(service.createSale(createSaleDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createSale(createSaleDto)).rejects.toThrow(
        'está cerrada',
      );
    });

    it('debe lanzar error si el cliente no existe', async () => {
      const dtoConClienteInexistente: CreateSaleDto = {
        ...createSaleDto,
        customerId: 'cliente-inexistente',
      };

      prisma.customer.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.createSale(dtoConClienteInexistente),
      ).rejects.toThrow('Cliente');
      await expect(
        service.createSale(dtoConClienteInexistente),
      ).rejects.toThrow('no encontrado');
    });

    it('debe calcular correctamente los totales con impuestos', async () => {
      // Mockear validaciones previas
      prisma.customer.findUnique = jest.fn().mockResolvedValue(mockCustomer);

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([mockProduct]),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue(mockProduct.stock),
            update: jest.fn().mockResolvedValue(mockProduct.stock),
          },
          sale: {
            create: jest.fn().mockResolvedValue({
              id: 'sale-1',
              customerId: 'customer-1',
              status: SaleStatus.PAID,
              subtotal: 10000, // 5 * 2000
              taxTotal: 1900, // 10000 * 0.19
              discountTotal: 0,
              grandTotal: 11900, // 10000 + 1900
              soldAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              items: [],
            }),
          },
          cashMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
          invoice: {
            create: jest.fn().mockResolvedValue({
              id: 'invoice-1',
              grandTotal: 11900,
            }),
          },
          dianDocument: {
            create: jest.fn().mockResolvedValue({
              id: 'dian-1',
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: {
            create: jest.fn().mockResolvedValue({ id: 'inv-mov-1' }),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createSale(createSaleDto);

      // Verificar que se calculó correctamente
      const createCall = mockTransaction.mock.results[0].value;
      // Verificar que se llamó create
      await createCall;

      expect(result.sale.grandTotal).toBe(11900);
      expect(result.sale.subtotal).toBe(10000);
      expect(result.sale.taxTotal).toBe(1900);
    });

    it('debe usar precio personalizado si se proporciona unitPrice', async () => {
      // Mockear validaciones previas
      prisma.customer.findUnique = jest.fn().mockResolvedValue(mockCustomer);

      const dtoConPrecioPersonalizado: CreateSaleDto = {
        ...createSaleDto,
        items: [
          {
            productId: 'product-1',
            qty: 5,
            unitPrice: 2500, // Precio diferente al del producto
          },
        ],
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([mockProduct]),
          },
          stockBalance: {
            upsert: jest.fn().mockResolvedValue(mockProduct.stock),
            update: jest.fn().mockResolvedValue(mockProduct.stock),
          },
          sale: {
            create: jest.fn().mockResolvedValue({
              id: 'sale-1',
              subtotal: 12500, // 5 * 2500
              taxTotal: 2375, // 12500 * 0.19
              grandTotal: 14875,
              items: [],
            }),
          },
          cashMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
          invoice: {
            create: jest.fn().mockResolvedValue({}),
          },
          dianDocument: {
            create: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
          inventoryMovement: {
            create: jest.fn().mockResolvedValue({ id: 'inv-mov-1' }),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createSale(dtoConPrecioPersonalizado);

      expect(result.sale.grandTotal).toBe(14875);
      expect(result.sale.subtotal).toBe(12500);
    });
  });

  describe('listSales', () => {
    it('debe listar las ventas ordenadas por fecha descendente', async () => {
      const mockSales = [
        {
          id: 'sale-1',
          customerId: 'customer-1',
          status: SaleStatus.PAID,
          soldAt: new Date('2026-01-22'),
          subtotal: 10000,
          taxTotal: 1900,
          grandTotal: 11900,
          items: [],
          customer: mockCustomer,
          invoices: [],
        },
        {
          id: 'sale-2',
          customerId: 'customer-1',
          status: SaleStatus.PAID,
          soldAt: new Date('2026-01-21'),
          subtotal: 5000,
          taxTotal: 950,
          grandTotal: 5950,
          items: [],
          customer: mockCustomer,
          invoices: [],
        },
      ];

      prisma.sale.findMany = jest.fn().mockResolvedValue(mockSales);
      prisma.sale.count = jest.fn().mockResolvedValue(2);

      const result = await service.listSales();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toEqual(mockSales);
      expect(result.meta.total).toBe(2);
      expect(prisma.sale.findMany).toHaveBeenCalled();
      expect(prisma.sale.count).toHaveBeenCalled();
    });
  });
});
