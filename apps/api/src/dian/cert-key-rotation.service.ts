import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  encryptCertPayload,
  decryptCertPayload,
} from './cert-encryption.util';

/**
 * C3.3: Servicio para rotar la clave de cifrado de certificados DIAN.
 * 
 * Permite cambiar DIAN_CERT_ENCRYPTION_KEY sin perder acceso a certificados existentes.
 * Proceso:
 * 1. Descifra certificados con clave vieja
 * 2. Cifra con clave nueva
 * 3. Actualiza BD
 * 4. Verifica que se pueden descifrar con la nueva clave
 */
@Injectable()
export class CertKeyRotationService {
  private readonly logger = new Logger(CertKeyRotationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Rotación completa de clave de cifrado.
   * 
   * @param oldKey Clave vieja (la actual en DIAN_CERT_ENCRYPTION_KEY)
   * @param newKey Clave nueva (la que quieres usar)
   * @param dryRun Si true, solo simula sin actualizar BD
   */
  async rotateEncryptionKey(
    oldKey: string,
    newKey: string,
    dryRun: boolean = false,
  ): Promise<{
    total: number;
    processed: number;
    success: number;
    failed: number;
    errors: Array<{ tenantId: string; error: string }>;
  }> {
    if (!oldKey || !newKey) {
      throw new Error(
        'Ambas claves (vieja y nueva) son requeridas para la rotación',
      );
    }

    if (oldKey === newKey) {
      throw new Error('La clave nueva debe ser diferente de la clave vieja');
    }

    // Obtener todos los certificados cifrados
    const configs = await this.prisma.dianConfig.findMany({
      where: {
        certEncrypted: { not: null },
        certPasswordEncrypted: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        certEncrypted: true,
        certPasswordEncrypted: true,
      },
    });

    const errors: Array<{ tenantId: string; error: string }> = [];
    let success = 0;
    let failed = 0;

    this.logger.log(
      `Iniciando rotación de clave de cifrado: ${configs.length} certificados encontrados (dryRun: ${dryRun})`,
    );

    for (const config of configs) {
      try {
        if (!config.certEncrypted || !config.certPasswordEncrypted) {
          continue;
        }

        // Paso 1: Descifrar con clave vieja
        let certBuffer: Buffer;
        let passwordBuffer: Buffer;

        try {
          certBuffer = decryptCertPayload(config.certEncrypted, oldKey);
          passwordBuffer = decryptCertPayload(
            config.certPasswordEncrypted,
            oldKey,
          );
        } catch (decryptErr) {
          // Si falla con la clave vieja, intentar con la nueva (ya rotado)
          try {
            certBuffer = decryptCertPayload(config.certEncrypted, newKey);
            passwordBuffer = decryptCertPayload(
              config.certPasswordEncrypted,
              newKey,
            );
            this.logger.debug(
              `Certificado de tenant ${config.tenantId} ya está cifrado con la nueva clave`,
            );
            success++;
            continue;
          } catch (newKeyErr) {
            errors.push({
              tenantId: config.tenantId,
              error: `No se pudo descifrar con ninguna clave: ${(decryptErr as Error).message}`,
            });
            failed++;
            continue;
          }
        }

        // Paso 2: Cifrar con clave nueva
        const newCertEncrypted = encryptCertPayload(certBuffer, newKey);
        const newPasswordEncrypted = encryptCertPayload(passwordBuffer, newKey);

        // Paso 3: Verificar que se puede descifrar con la nueva clave
        try {
          decryptCertPayload(newCertEncrypted, newKey);
          decryptCertPayload(newPasswordEncrypted, newKey);
        } catch (verifyErr) {
          errors.push({
            tenantId: config.tenantId,
            error: `Error verificando nuevo cifrado: ${(verifyErr as Error).message}`,
          });
          failed++;
          continue;
        }

        // Paso 4: Actualizar BD (si no es dry run)
        if (!dryRun) {
          await this.prisma.dianConfig.update({
            where: { id: config.id },
            data: {
              certEncrypted: newCertEncrypted,
              certPasswordEncrypted: newPasswordEncrypted,
              updatedAt: new Date(),
            },
          });
        }

        success++;
        this.logger.log(
          `Certificado de tenant ${config.tenantId} rotado exitosamente`,
        );
      } catch (err) {
        errors.push({
          tenantId: config.tenantId,
          error: (err as Error).message,
        });
        failed++;
        this.logger.error(
          `Error rotando certificado de tenant ${config.tenantId}: ${(err as Error).message}`,
        );
      }
    }

    return {
      total: configs.length,
      processed: configs.length,
      success,
      failed,
      errors,
    };
  }

  /**
   * Verifica que todos los certificados se pueden descifrar con la clave actual.
   * Útil para validar antes de rotar.
   */
  async verifyCurrentKey(key: string): Promise<{
    total: number;
    valid: number;
    invalid: number;
    errors: Array<{ tenantId: string; error: string }>;
  }> {
    const configs = await this.prisma.dianConfig.findMany({
      where: {
        certEncrypted: { not: null },
        certPasswordEncrypted: { not: null },
      },
      select: {
        tenantId: true,
        certEncrypted: true,
        certPasswordEncrypted: true,
      },
    });

    const errors: Array<{ tenantId: string; error: string }> = [];
    let valid = 0;
    let invalid = 0;

    for (const config of configs) {
      try {
        if (!config.certEncrypted || !config.certPasswordEncrypted) {
          continue;
        }

        decryptCertPayload(config.certEncrypted, key);
        decryptCertPayload(config.certPasswordEncrypted, key);
        valid++;
      } catch (err) {
        invalid++;
        errors.push({
          tenantId: config.tenantId,
          error: (err as Error).message,
        });
      }
    }

    return {
      total: configs.length,
      valid,
      invalid,
      errors,
    };
  }
}
