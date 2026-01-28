import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ValidationLimitsService } from '../common/services/validation-limits.service';
import { AuditService } from '../common/services/audit.service';
import { CacheService } from '../common/services/cache.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { ConvertQuoteDto } from './dto/convert-quote.dto';
import { QuoteStatus, SaleStatus, PaymentMethod } from '@prisma/client';

describe('QuotesService', () => {
  let service: QuotesService;
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

  const mockQuote = {
    id: 'quote-1',
    customerId: 'customer-1',
    status: QuoteStatus.DRAFT,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
    subtotal: 10000,
    taxTotal: 1900,
    discountTotal: 0,
    grandTotal: 11900,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'item-1',
        quoteId: 'quote-1',
        productId: 'product-1',
        qty: 5,
        unitPrice: 2000,
        taxRate: 19,
        lineTotal: 11900,
      },
    ],
  };

  beforeEach(async () => {
    const mockPrisma = {
      $transaction: jest.fn(),
      quote: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cashSession: {
        findUnique: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
    };

    const mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
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
            validateQuoteValidUntil: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logCreate: jest.fn().mockResolvedValue(undefined),
            logUpdate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CacheService,
          useValue: {
            deletePattern: jest.fn().mockResolvedValue(undefined),
            buildKey: jest.fn((...args) => `cache:${args.join(':')}`),
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
    prisma = module.get(PrismaService);
    dianQueue = module.get(getQueueToken('dian'));

    // Mocks por defecto
    prisma.cashSession.findUnique = jest
      .fn()
      .mockResolvedValue(mockCashSession);
    prisma.customer.findUnique = jest.fn().mockResolvedValue(mockCustomer);
    prisma.product.findMany = jest.fn().mockResolvedValue([mockProduct]);
    dianQueue.add = jest.fn().mockResolvedValue({ id: 'job-1' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createQuote', () => {
    const createQuoteDto: CreateQuoteDto = {
      customerId: 'customer-1',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      items: [
        {
          productId: 'product-1',
          qty: 5,
        },
      ],
    };

    it('debe crear una cotización exitosamente', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([mockProduct]),
          },
          quote: {
            create: jest.fn().mockResolvedValue(mockQuote),
          },
          quoteItem: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createQuote(createQuoteDto);

      expect(result).toBeDefined();
      expect(prisma.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
      });
    });

    it('debe lanzar error si no hay items', async () => {
      const dtoSinItems: CreateQuoteDto = {
        ...createQuoteDto,
        items: [],
      };

      await expect(service.createQuote(dtoSinItems)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createQuote(dtoSinItems)).rejects.toThrow(
        'Debe incluir items.',
      );
    });

    it('debe lanzar error si el cliente no existe', async () => {
      prisma.customer.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.createQuote(createQuoteDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.createQuote(createQuoteDto)).rejects.toThrow(
        'Cliente',
      );
      await expect(service.createQuote(createQuoteDto)).rejects.toThrow(
        'no encontrado',
      );
    });

    it('debe permitir crear cotización sin cliente', async () => {
      const dtoSinCliente: CreateQuoteDto = {
        ...createQuoteDto,
        customerId: undefined,
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([mockProduct]),
          },
          quote: {
            create: jest
              .fn()
              .mockResolvedValue({ ...mockQuote, customerId: null }),
          },
          quoteItem: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.createQuote(dtoSinCliente);

      expect(result).toBeDefined();
      expect(prisma.customer.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateQuote', () => {
    const updateQuoteDto: UpdateQuoteDto = {
      customerId: 'customer-1',
      items: [
        {
          productId: 'product-1',
          qty: 10,
        },
      ],
    };

    it('debe actualizar una cotización exitosamente', async () => {
      const quoteWithIncludes = {
        ...mockQuote,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };
      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteWithIncludes);

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          product: {
            findMany: jest.fn().mockResolvedValue([mockProduct]),
          },
          quote: {
            update: jest
              .fn()
              .mockResolvedValue({ ...quoteWithIncludes, ...updateQuoteDto }),
          },
          quoteItem: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.updateQuote('quote-1', updateQuoteDto);

      expect(result).toBeDefined();
    });

    it('debe lanzar error si la cotización no existe', async () => {
      prisma.quote.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateQuote('quote-inexistente', updateQuoteDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar error si intenta actualizar cotización convertida', async () => {
      const quoteConvertida = {
        ...mockQuote,
        status: QuoteStatus.CONVERTED,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };

      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteConvertida);

      await expect(
        service.updateQuote('quote-1', updateQuoteDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateQuote('quote-1', updateQuoteDto),
      ).rejects.toThrow('CONVERTED');
    });

    it('debe lanzar error si el cliente actualizado no existe', async () => {
      const quoteWithIncludes = {
        ...mockQuote,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };
      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteWithIncludes);
      prisma.customer.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateQuote('quote-1', updateQuoteDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateQuote('quote-1', updateQuoteDto),
      ).rejects.toThrow('Cliente');
    });
  });

  describe('convertQuoteToSale', () => {
    const convertDto: ConvertQuoteDto = {
      cashSessionId: 'session-1',
      paymentMethod: PaymentMethod.CASH,
    };

    it('debe convertir cotización a venta exitosamente', async () => {
      const quoteWithIncludes = {
        ...mockQuote,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };
      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteWithIncludes);

      const mockSale = {
        id: 'sale-1',
        customerId: 'customer-1',
        status: SaleStatus.PAID,
        items: [],
        customer: mockCustomer,
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          stockBalance: {
            upsert: jest.fn().mockResolvedValue({
              productId: 'product-1',
              qtyOnHand: 100,
              qtyReserved: 0,
            }),
            update: jest.fn().mockResolvedValue({
              productId: 'product-1',
              qtyOnHand: 95,
            }),
          },
          sale: {
            create: jest.fn().mockResolvedValue(mockSale),
            findUnique: jest.fn().mockResolvedValue({
              ...mockSale,
              items: quoteWithIncludes.items.map((item) => ({
                ...item,
                saleId: 'sale-1',
                product: mockProduct,
              })),
              customer: mockCustomer,
            }),
          },
          saleItem: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          cashMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
          invoice: {
            create: jest.fn().mockResolvedValue({
              id: 'invoice-1',
            }),
          },
          dianDocument: {
            create: jest.fn().mockResolvedValue({
              id: 'dian-1',
            }),
          },
          quote: {
            update: jest.fn().mockResolvedValue({
              ...quoteWithIncludes,
              status: QuoteStatus.CONVERTED,
            }),
            findUnique: jest.fn().mockResolvedValue({
              ...quoteWithIncludes,
              status: QuoteStatus.CONVERTED,
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.convertQuoteToSale('quote-1', convertDto);

      expect(result).toBeDefined();
      expect(prisma.cashSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('debe lanzar error si la cotización no existe', async () => {
      prisma.quote.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.convertQuoteToSale('quote-inexistente', convertDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar error si la cotización ya está convertida', async () => {
      const quoteConvertida = {
        ...mockQuote,
        status: QuoteStatus.CONVERTED,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };

      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteConvertida);

      await expect(
        service.convertQuoteToSale('quote-1', convertDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.convertQuoteToSale('quote-1', convertDto),
      ).rejects.toThrow('convertida');
    });

    it('debe lanzar error si la sesión de caja no existe', async () => {
      const quoteWithIncludes = {
        ...mockQuote,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };
      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteWithIncludes);
      prisma.cashSession.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.convertQuoteToSale('quote-1', convertDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.convertQuoteToSale('quote-1', convertDto),
      ).rejects.toThrow('Sesión de caja');
    });

    it('debe lanzar error si la sesión de caja está cerrada', async () => {
      const sessionCerrada = {
        ...mockCashSession,
        closedAt: new Date(),
      };

      const quoteWithIncludes = {
        ...mockQuote,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };
      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteWithIncludes);
      prisma.cashSession.findUnique = jest
        .fn()
        .mockResolvedValue(sessionCerrada);

      await expect(
        service.convertQuoteToSale('quote-1', convertDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.convertQuoteToSale('quote-1', convertDto),
      ).rejects.toThrow('cerrada');
    });

    it('debe lanzar error si cashSessionId no se proporciona', async () => {
      const quoteWithIncludes = {
        ...mockQuote,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };
      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteWithIncludes);

      const dtoSinCaja: ConvertQuoteDto = {
        paymentMethod: PaymentMethod.CASH,
      };

      await expect(
        service.convertQuoteToSale('quote-1', dtoSinCaja),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.convertQuoteToSale('quote-1', dtoSinCaja),
      ).rejects.toThrow('cashSessionId requerido');
    });
  });

  describe('updateQuoteStatus', () => {
    it('debe actualizar estado exitosamente', async () => {
      const quoteWithIncludes = {
        ...mockQuote,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };
      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteWithIncludes);

      const updatedQuote = {
        ...quoteWithIncludes,
        status: QuoteStatus.SENT,
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          quote: {
            update: jest.fn().mockResolvedValue(updatedQuote),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      prisma.$transaction = mockTransaction;

      const result = await service.updateQuoteStatus(
        'quote-1',
        QuoteStatus.SENT,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(QuoteStatus.SENT);
    });

    it('debe lanzar error si intenta cambiar estado de cotización convertida', async () => {
      const quoteConvertida = {
        ...mockQuote,
        status: QuoteStatus.CONVERTED,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };

      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteConvertida);

      await expect(
        service.updateQuoteStatus('quote-1', QuoteStatus.SENT),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateQuoteStatus('quote-1', QuoteStatus.SENT),
      ).rejects.toThrow('convertida');
    });

    it('debe lanzar error si intenta reactivar cotización cancelada', async () => {
      const quoteCancelada = {
        ...mockQuote,
        status: QuoteStatus.CANCELLED,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };

      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteCancelada);

      await expect(
        service.updateQuoteStatus('quote-1', QuoteStatus.DRAFT),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateQuoteStatus('quote-1', QuoteStatus.DRAFT),
      ).rejects.toThrow('cancelada');
    });

    it('debe lanzar error si la transición de estado no es válida', async () => {
      const quoteExpirada = {
        ...mockQuote,
        status: QuoteStatus.EXPIRED,
        items: mockQuote.items.map((item) => ({
          ...item,
          product: mockProduct,
        })),
        customer: mockCustomer,
      };

      prisma.quote.findUnique = jest.fn().mockResolvedValue(quoteExpirada);

      // EXPIRED solo puede cambiar a CANCELLED
      await expect(
        service.updateQuoteStatus('quote-1', QuoteStatus.DRAFT),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateQuoteStatus('quote-1', QuoteStatus.DRAFT),
      ).rejects.toThrow('Transiciones permitidas');
    });
  });
});
