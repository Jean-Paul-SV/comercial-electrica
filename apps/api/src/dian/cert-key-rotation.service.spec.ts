import { Test, TestingModule } from '@nestjs/testing';
import { CertKeyRotationService } from './cert-key-rotation.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  encryptCertPayload,
  decryptCertPayload,
} from './cert-encryption.util';

describe('CertKeyRotationService', () => {
  let service: CertKeyRotationService;
  let prisma: jest.Mocked<PrismaService>;

  const testKey1 =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testKey2 =
    'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  const testCertData = Buffer.from('test certificate data');
  const testPasswordData = Buffer.from('test password');

  const mockPrismaService = {
    dianConfig: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertKeyRotationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
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

    service = module.get<CertKeyRotationService>(CertKeyRotationService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('rotateEncryptionKey', () => {
    it('debe lanzar error si las claves son iguales', async () => {
      await expect(
        service.rotateEncryptionKey(testKey1, testKey1, true),
      ).rejects.toThrow('La clave nueva debe ser diferente');
    });

    it('debe lanzar error si falta alguna clave', async () => {
      await expect(
        service.rotateEncryptionKey('', testKey2, true),
      ).rejects.toThrow('Ambas claves');
    });

    it('debe rotar certificados en dry-run sin actualizar BD', async () => {
      const encryptedCert = encryptCertPayload(testCertData, testKey1);
      const encryptedPassword = encryptCertPayload(testPasswordData, testKey1);

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          id: 'config-1',
          tenantId: 'tenant-1',
          certEncrypted: encryptedCert,
          certPasswordEncrypted: encryptedPassword,
        },
      ]);

      const result = await service.rotateEncryptionKey(
        testKey1,
        testKey2,
        true, // dry-run
      );

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockPrismaService.dianConfig.update).not.toHaveBeenCalled();
    });

    it('debe rotar certificados y actualizar BD si no es dry-run', async () => {
      const encryptedCert = encryptCertPayload(testCertData, testKey1);
      const encryptedPassword = encryptCertPayload(testPasswordData, testKey1);

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          id: 'config-1',
          tenantId: 'tenant-1',
          certEncrypted: encryptedCert,
          certPasswordEncrypted: encryptedPassword,
        },
      ]);

      mockPrismaService.dianConfig.update.mockResolvedValue({});

      const result = await service.rotateEncryptionKey(
        testKey1,
        testKey2,
        false, // no dry-run
      );

      expect(result.success).toBe(1);
      expect(mockPrismaService.dianConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'config-1' },
          data: expect.objectContaining({
            certEncrypted: expect.any(String),
            certPasswordEncrypted: expect.any(String),
          }),
        }),
      );
    });

    it('debe manejar certificados ya rotados (cifrados con nueva clave)', async () => {
      const encryptedCert = encryptCertPayload(testCertData, testKey2);
      const encryptedPassword = encryptCertPayload(testPasswordData, testKey2);

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          id: 'config-1',
          tenantId: 'tenant-1',
          certEncrypted: encryptedCert,
          certPasswordEncrypted: encryptedPassword,
        },
      ]);

      const result = await service.rotateEncryptionKey(
        testKey1,
        testKey2,
        true,
      );

      // Debe detectar que ya está cifrado con la nueva clave
      expect(result.success).toBe(1);
    });

    it('debe registrar error si certificado no se puede descifrar', async () => {
      const wrongEncrypted = 'invalid-encrypted-data';

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          id: 'config-1',
          tenantId: 'tenant-1',
          certEncrypted: wrongEncrypted,
          certPasswordEncrypted: wrongEncrypted,
        },
      ]);

      const result = await service.rotateEncryptionKey(
        testKey1,
        testKey2,
        true,
      );

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('verifyCurrentKey', () => {
    it('debe verificar que certificados se pueden descifrar con clave', async () => {
      const encryptedCert = encryptCertPayload(testCertData, testKey1);
      const encryptedPassword = encryptCertPayload(testPasswordData, testKey1);

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          tenantId: 'tenant-1',
          certEncrypted: encryptedCert,
          certPasswordEncrypted: encryptedPassword,
        },
        {
          tenantId: 'tenant-2',
          certEncrypted: encryptedCert,
          certPasswordEncrypted: encryptedPassword,
        },
      ]);

      const result = await service.verifyCurrentKey(testKey1);

      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(0);
    });

    it('debe detectar certificados inválidos', async () => {
      const wrongEncrypted = 'invalid-encrypted-data';

      mockPrismaService.dianConfig.findMany.mockResolvedValue([
        {
          tenantId: 'tenant-1',
          certEncrypted: wrongEncrypted,
          certPasswordEncrypted: wrongEncrypted,
        },
      ]);

      const result = await service.verifyCurrentKey(testKey1);

      expect(result.valid).toBe(0);
      expect(result.invalid).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
