import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DianService } from './dian.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { DianDocumentStatus, DianEnvironment } from '@prisma/client';

describe('DianService', () => {
  let service: DianService;
  let prisma: jest.Mocked<PrismaService>;

  const mockDianDocument = {
    id: 'dian-doc-1',
    invoiceId: 'invoice-1',
    type: DianDocumentType.FE,
    cufe: null,
    xmlPath: null,
    pdfPath: null,
    status: DianDocumentStatus.DRAFT,
    lastError: null,
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    invoice: {
      id: 'invoice-1',
      saleId: 'sale-1',
      customerId: 'customer-1',
      number: 'FAC-001',
      issuedAt: new Date(),
      status: InvoiceStatus.ISSUED,
      subtotal: 10000,
      taxTotal: 1900,
      discountTotal: 0,
      grandTotal: 11900,
      sale: {
        id: 'sale-1',
        customerId: 'customer-1',
        items: [
          {
            id: 'item-1',
            productId: 'product-1',
            qty: 5,
            unitPrice: 2000,
            product: {
              id: 'product-1',
              name: 'Producto Test',
            },
          },
        ],
        customer: {
          id: 'customer-1',
          name: 'Cliente Test',
          docType: 'CC',
          docNumber: '1234567890',
        },
      },
      customer: {
        id: 'customer-1',
        name: 'Cliente Test',
        docType: 'CC',
        docNumber: '1234567890',
      },
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      dianDocument: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      dianEvent: {
        create: jest.fn(),
      },
    };

    const mockConfig = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const configMap: Record<string, unknown> = {
          DIAN_ENV: DianEnvironment.HABILITACION,
          DIAN_SOFTWARE_ID: 'test-software-id',
          DIAN_SOFTWARE_PIN: 'test-pin',
          DIAN_RESOLUTION_NUMBER: '18764000000010',
          DIAN_PREFIX: 'FAC',
          DIAN_RANGE_FROM: 1,
          DIAN_RANGE_TO: 999999,
        };
        return configMap[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DianService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<DianService>(DianService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processDocument', () => {
    it('debe procesar documento exitosamente', async () => {
      prisma.dianDocument.findUnique = jest
        .fn()
        .mockResolvedValue(mockDianDocument);
      prisma.dianDocument.update = jest.fn().mockResolvedValue({
        ...mockDianDocument,
        status: DianDocumentStatus.SENT,
      });
      prisma.dianEvent.create = jest.fn().mockResolvedValue({});

      // Mock de los métodos internos
      jest
        .spyOn(service as any, 'generateXML')
        .mockResolvedValue('<xml>test</xml>');
      jest
        .spyOn(service as any, 'signDocument')
        .mockResolvedValue('<xml signed>test</xml>');
      jest.spyOn(service as any, 'sendToDian').mockResolvedValue({
        success: true,
        cufe: 'CUFE-TEST-123',
        qrCode: 'QR-TEST',
        message: 'Documento aceptado',
        timestamp: new Date().toISOString(),
      });
      jest
        .spyOn(service as any, 'handleDianResponse')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'generatePDF')
        .mockResolvedValue('pdf/test.pdf');

      await service.processDocument('dian-doc-1');

      expect(prisma.dianDocument.findUnique).toHaveBeenCalledWith({
        where: { id: 'dian-doc-1' },
        include: expect.any(Object),
      });
    });

    it('debe lanzar error si el documento no existe', async () => {
      prisma.dianDocument.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.processDocument('dian-doc-inexistente'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.processDocument('dian-doc-inexistente'),
      ).rejects.toThrow('no encontrado');
    });

    it('debe retornar sin procesar si el documento ya está aceptado', async () => {
      const docAceptado = {
        ...mockDianDocument,
        status: DianDocumentStatus.ACCEPTED,
      };

      prisma.dianDocument.findUnique = jest.fn().mockResolvedValue(docAceptado);

      await service.processDocument('dian-doc-1');

      // No debe actualizar el documento
      expect(prisma.dianDocument.update).not.toHaveBeenCalled();
    });

    it('debe manejar errores y actualizar estado a REJECTED', async () => {
      prisma.dianDocument.findUnique = jest
        .fn()
        .mockResolvedValue(mockDianDocument);
      prisma.dianDocument.update = jest.fn().mockResolvedValue({
        ...mockDianDocument,
        status: DianDocumentStatus.REJECTED,
        lastError: 'Error de prueba',
      });
      prisma.dianEvent.create = jest.fn().mockResolvedValue({});

      // Mock que lanza error - usar any para evitar problemas de tipos en tests

      jest
        .spyOn(service as any, 'generateXML')
        .mockRejectedValue(new Error('Error de prueba'));

      await expect(service.processDocument('dian-doc-1')).rejects.toThrow(
        'Error de prueba',
      );

      expect(prisma.dianDocument.update).toHaveBeenCalledWith({
        where: { id: 'dian-doc-1' },
        data: {
          status: DianDocumentStatus.REJECTED,
          lastError: 'Error de prueba',
        },
      });
    });
  });

  describe('queryDocumentStatus', () => {
    it('debe retornar el estado del documento', async () => {
      prisma.dianDocument.findUnique = jest
        .fn()
        .mockResolvedValue(mockDianDocument);

      const status = await service.queryDocumentStatus('dian-doc-1');

      expect(status).toBe(DianDocumentStatus.DRAFT);
      expect(prisma.dianDocument.findUnique).toHaveBeenCalledWith({
        where: { id: 'dian-doc-1' },
      });
    });

    it('debe lanzar error si el documento no existe', async () => {
      prisma.dianDocument.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.queryDocumentStatus('dian-doc-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDianConfig', () => {
    it('debe retornar configuración desde variables de entorno', () => {
      const config = service['getDianConfig']();

      expect(config.env).toBe(DianEnvironment.HABILITACION);
      expect(config.softwareId).toBe('test-software-id');
      expect(config.softwarePin).toBe('test-pin');
    });
  });
});
