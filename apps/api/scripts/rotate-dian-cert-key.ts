#!/usr/bin/env ts-node
/**
 * Script CLI para rotar la clave de cifrado de certificados DIAN.
 * C3.3: Permite cambiar DIAN_CERT_ENCRYPTION_KEY sin perder acceso a certificados.
 * 
 * Uso:
 *   npm run rotate-dian-key -- --old-key="clave-vieja" --new-key="clave-nueva" [--dry-run]
 * 
 * O con variables de entorno:
 *   OLD_DIAN_CERT_KEY="clave-vieja" NEW_DIAN_CERT_KEY="clave-nueva" npm run rotate-dian-key
 */

import { PrismaClient } from '@prisma/client';
import {
  encryptCertPayload,
  decryptCertPayload,
} from '../src/dian/cert-encryption.util';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const dryRun =
    args.includes('--dry-run') ||
    process.env.DRY_RUN === 'true' ||
    process.env.DRY_RUN === '1';

  // Obtener claves de argumentos o variables de entorno
  let oldKey =
    args.find((a) => a.startsWith('--old-key='))?.split('=')[1] ||
    process.env.OLD_DIAN_CERT_KEY;
  let newKey =
    args.find((a) => a.startsWith('--new-key='))?.split('=')[1] ||
    process.env.NEW_DIAN_CERT_KEY;

  // Si no están en args, pedir interactivamente (solo si no es dry-run)
  if (!oldKey || !newKey) {
    console.error('❌ Error: Se requieren ambas claves (vieja y nueva)');
    console.error('');
    console.error('Uso:');
    console.error('  npm run rotate-dian-key -- --old-key="..." --new-key="..." [--dry-run]');
    console.error('');
    console.error('O con variables de entorno:');
    console.error('  OLD_DIAN_CERT_KEY="..." NEW_DIAN_CERT_KEY="..." npm run rotate-dian-key');
    process.exit(1);
  }

  console.log('🔄 Rotación de clave de cifrado DIAN');
  console.log('=====================================');
  console.log(`Dry run: ${dryRun ? 'SÍ (no se actualizará BD)' : 'NO (se actualizará BD)'}`);
  console.log('');

  // Obtener todos los certificados cifrados
  const configs = await prisma.dianConfig.findMany({
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

  console.log(`📋 Encontrados ${configs.length} certificados para rotar`);
  console.log('');

  const errors: Array<{ tenantId: string; error: string }> = [];
  let success = 0;
  let failed = 0;
  let alreadyRotated = 0;

  for (const config of configs) {
    try {
      if (!config.certEncrypted || !config.certPasswordEncrypted) {
        continue;
      }

      // Intentar descifrar con clave vieja
      let certBuffer: Buffer;
      let passwordBuffer: Buffer;
      let usedOldKey = false;

      try {
        certBuffer = decryptCertPayload(config.certEncrypted, oldKey);
        passwordBuffer = decryptCertPayload(
          config.certPasswordEncrypted,
          oldKey,
        );
        usedOldKey = true;
      } catch (oldKeyErr) {
        // Si falla con la clave vieja, intentar con la nueva (ya rotado)
        try {
          certBuffer = decryptCertPayload(config.certEncrypted, newKey);
          passwordBuffer = decryptCertPayload(
            config.certPasswordEncrypted,
            newKey,
          );
          console.log(
            `  ✓ Tenant ${config.tenantId}: ya está cifrado con la nueva clave`,
          );
          alreadyRotated++;
          continue;
        } catch (newKeyErr) {
          throw new Error(
            `No se pudo descifrar con ninguna clave: ${(oldKeyErr as Error).message}`,
          );
        }
      }

      // Cifrar con clave nueva
      const newCertEncrypted = encryptCertPayload(certBuffer, newKey);
      const newPasswordEncrypted = encryptCertPayload(passwordBuffer, newKey);

      // Verificar que se puede descifrar con la nueva clave
      decryptCertPayload(newCertEncrypted, newKey);
      decryptCertPayload(newPasswordEncrypted, newKey);

      // Actualizar BD (si no es dry run)
      if (!dryRun) {
        await prisma.dianConfig.update({
          where: { id: config.id },
          data: {
            certEncrypted: newCertEncrypted,
            certPasswordEncrypted: newPasswordEncrypted,
            updatedAt: new Date(),
          },
        });
      }

      success++;
      console.log(
        `  ✓ Tenant ${config.tenantId}: rotado exitosamente${dryRun ? ' (dry-run)' : ''}`,
      );
    } catch (err) {
      failed++;
      const errorMsg = (err as Error).message;
      errors.push({
        tenantId: config.tenantId,
        error: errorMsg,
      });
      console.error(`  ❌ Tenant ${config.tenantId}: ${errorMsg}`);
    }
  }

  console.log('');
  console.log('📊 Resumen:');
  console.log(`  Total: ${configs.length}`);
  console.log(`  Rotados exitosamente: ${success}`);
  console.log(`  Ya rotados: ${alreadyRotated}`);
  console.log(`  Fallidos: ${failed}`);

  if (errors.length > 0) {
    console.log('');
    console.log('❌ Errores:');
    errors.forEach((e) => {
      console.log(`  - Tenant ${e.tenantId}: ${e.error}`);
    });
  }

  if (dryRun) {
    console.log('');
    console.log('⚠️  DRY RUN: No se actualizó la base de datos');
    console.log('   Ejecuta sin --dry-run para aplicar los cambios');
  } else if (success > 0) {
    console.log('');
    console.log('✅ Rotación completada');
    console.log('   IMPORTANTE: Actualiza DIAN_CERT_ENCRYPTION_KEY en producción con la nueva clave');
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
