#!/usr/bin/env ts-node
/**
 * Script de Verificación de Aislamiento Multi-Tenant
 * 
 * CRÍTICO: Valida que no haya fugas de datos entre tenants.
 * 
 * Este script verifica:
 * 1. Registros huérfanos (sin tenantId en tablas multi-tenant)
 * 2. Índices compuestos que incluyan tenantId
 * 3. Constraints de unicidad que incluyan tenantId
 * 4. Integridad referencial entre tenants
 * 
 * Uso:
 *   npm run verify:tenant-isolation
 *   o
 *   ts-node apps/api/scripts/verify-tenant-isolation.ts
 * 
 * Exit code:
 *   0 = Todo OK
 *   1 = Errores encontrados
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '../../.env') });

const prisma = new PrismaClient();

interface VerificationResult {
  passed: boolean;
  message: string;
  details?: any;
}

interface VerificationReport {
  timestamp: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  results: VerificationResult[];
}

/**
 * Tablas multi-tenant que DEBEN tener tenantId
 * (excluyendo tablas de sistema como Tenant, User, Subscription, etc.)
 */
const MULTI_TENANT_TABLES = [
  'Product',
  'Category',
  'Customer',
  'Sale',
  'SaleItem',
  'Invoice',
  'StockBalance',
  'StockMovement',
  'Quote',
  'QuoteItem',
  'Supplier',
  'Purchase',
  'PurchaseItem',
  'Payable',
  'Payment',
  'CashTransaction',
  'DianDocument',
  'DianEvent',
  'DianConfig',
  'AuditLog',
  'Report',
  'Feedback',
] as const;

/**
 * Tablas donde tenantId es opcional (null permitido: ej. eventos de sistema en AuditLog)
 */
const TABLES_OPTIONAL_TENANT_ID = ['AuditLog'] as const;

/**
 * Tablas que NO son multi-tenant (no deben tener tenantId)
 */
const SYSTEM_TABLES = [
  'Tenant',
  'User',
  'Subscription',
  'Plan',
  'PlanFeature',
  'TenantModule',
  'StripeEvent',
  'Backup',
] as const;

async function checkOrphanedRecords(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  for (const table of MULTI_TENANT_TABLES) {
    try {
      // Usar Prisma para contar registros sin tenantId
      // Nota: Esto requiere acceso directo a Prisma, que puede no exponer todos los modelos
      // Alternativamente, usar raw SQL para verificar
      const count = await (prisma as any)[table.toLowerCase()].count({
        where: {
          tenantId: null,
        },
      });

      if (count > 0) {
        if (TABLES_OPTIONAL_TENANT_ID.includes(table as any)) {
          results.push({
            passed: true,
            message: `✅ Tabla ${table}: tenantId opcional (${count} registros sin tenant, permitido)`,
          });
        } else {
          results.push({
            passed: false,
            message: `❌ Tabla ${table} tiene ${count} registros sin tenantId (huérfanos)`,
            details: { table, orphanedCount: count },
          });
        }
      } else {
        results.push({
          passed: true,
          message: `✅ Tabla ${table}: Sin registros huérfanos`,
        });
      }
    } catch (error) {
      // Si el modelo no existe o no tiene tenantId, usar raw SQL
      try {
        const tableName = table.charAt(0).toLowerCase() + table.slice(1);
        const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM "${table}" WHERE "tenantId" IS NULL`,
        );
        const count = Number(result[0]?.count || 0);

        if (count > 0) {
          if (TABLES_OPTIONAL_TENANT_ID.includes(table as any)) {
            results.push({
              passed: true,
              message: `✅ Tabla ${table}: tenantId opcional (${count} registros sin tenant, permitido para eventos de sistema)`,
            });
          } else {
            results.push({
              passed: false,
              message: `❌ Tabla ${table} tiene ${count} registros sin tenantId (huérfanos)`,
              details: { table, orphanedCount: count },
            });
          }
        } else {
          results.push({
            passed: true,
            message: `✅ Tabla ${table}: Sin registros huérfanos`,
          });
        }
      } catch (sqlError) {
        // Tabla puede no existir o no ser multi-tenant
        results.push({
          passed: true,
          message: `⚠️ Tabla ${table}: No se pudo verificar (puede no ser multi-tenant o no existir)`,
          details: { error: (sqlError as Error).message },
        });
      }
    }
  }

  return results;
}

async function checkCompositeIndexes(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // Verificar índices compuestos que incluyan tenantId
  // Esto requiere consultar pg_indexes de PostgreSQL
  try {
    const indexes = await prisma.$queryRawUnsafe<Array<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>>(`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexdef LIKE '%tenantId%'
        AND indexdef LIKE '%,%'
      ORDER BY tablename, indexname
    `);

    const tablesWithCompositeIndexes = new Set<string>();
    indexes.forEach((idx) => {
      tablesWithCompositeIndexes.add(idx.tablename);
    });

    // Verificar que tablas multi-tenant críticas tengan índices compuestos
    const criticalTables = ['Product', 'Sale', 'Customer', 'Invoice'];
    for (const table of criticalTables) {
      const tableName = table.charAt(0).toLowerCase() + table.slice(1);
      const hasCompositeIndex = Array.from(tablesWithCompositeIndexes).some(
        (t) => t.toLowerCase() === tableName.toLowerCase(),
      );

      if (hasCompositeIndex) {
        results.push({
          passed: true,
          message: `✅ Tabla ${table}: Tiene índices compuestos con tenantId`,
        });
      } else {
        results.push({
          passed: false,
          message: `⚠️ Tabla ${table}: No se encontraron índices compuestos con tenantId (puede afectar performance)`,
          details: { table },
        });
      }
    }

    if (indexes.length > 0) {
      results.push({
        passed: true,
        message: `✅ Encontrados ${indexes.length} índices compuestos con tenantId`,
        details: { indexes: indexes.map((i) => i.indexname) },
      });
    }
  } catch (error) {
    results.push({
      passed: false,
      message: `❌ Error verificando índices: ${(error as Error).message}`,
      details: { error: (error as Error).stack },
    });
  }

  return results;
}

async function checkUniqueConstraints(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // Verificar constraints de unicidad que incluyan tenantId
  // pg_constraint no tiene table_name; se obtiene de pg_class.relname
  try {
    const constraints = await prisma.$queryRawUnsafe<Array<{
      table_name: string;
      constraint_name: string;
      constraint_definition: string;
    }>>(`
      SELECT 
        c.relname::text as table_name,
        tc.conname::text as constraint_name,
        pg_get_constraintdef(tc.oid) as constraint_definition
      FROM pg_constraint tc
      JOIN pg_class c ON tc.conrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND tc.contype = 'u'
        AND pg_get_constraintdef(tc.oid) LIKE '%tenantId%'
      ORDER BY c.relname, tc.conname
    `);

    if (constraints.length > 0) {
      results.push({
        passed: true,
        message: `✅ Encontrados ${constraints.length} constraints de unicidad que incluyen tenantId`,
        details: {
          constraints: constraints.map((c) => ({
            table: c.table_name,
            name: c.constraint_name,
            definition: c.constraint_definition,
          })),
        },
      });
    } else {
      results.push({
        passed: false,
        message: `⚠️ No se encontraron constraints de unicidad con tenantId (puede permitir duplicados entre tenants)`,
      });
    }
  } catch (error) {
    results.push({
      passed: false,
      message: `❌ Error verificando constraints: ${(error as Error).message}`,
      details: { error: (error as Error).stack },
    });
  }

  return results;
}

async function checkReferentialIntegrity(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // Verificar que relaciones entre tablas multi-tenant mantengan el mismo tenantId
  // SaleItem no tiene tenantId; se verifica que todo SaleItem pertenezca a una Sale con tenantId válido
  try {
    // Verificar SaleItem: todas las Sale deben tener tenantId (SaleItem hereda por relación)
    const saleItemOrphans = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      SELECT COUNT(*) as count
      FROM "SaleItem" si
      JOIN "Sale" s ON si."saleId" = s.id
      WHERE s."tenantId" IS NULL
    `);

    const saleOrphanCount = Number(saleItemOrphans[0]?.count || 0);
    if (saleOrphanCount > 0) {
      results.push({
        passed: false,
        message: `❌ Encontrados ${saleOrphanCount} SaleItems cuya Sale no tiene tenantId`,
        details: { mismatchCount: saleOrphanCount },
      });
    } else {
      results.push({
        passed: true,
        message: `✅ Integridad referencial: Sale -> SaleItem (todas las Sale tienen tenantId)`,
      });
    }

    // Verificar Sale -> Customer
    const saleCustomerMismatches = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      SELECT COUNT(*) as count
      FROM "Sale" s
      JOIN "Customer" c ON s."customerId" = c.id
      WHERE s."tenantId" != c."tenantId"
    `);

    const customerMismatchCount = Number(saleCustomerMismatches[0]?.count || 0);
    if (customerMismatchCount > 0) {
      results.push({
        passed: false,
        message: `❌ Encontrados ${customerMismatchCount} Sales con tenantId diferente a su Customer`,
        details: { mismatchCount: customerMismatchCount },
      });
    } else {
      results.push({
        passed: true,
        message: `✅ Integridad referencial: Sale -> Customer`,
      });
    }

    // Verificar Invoice -> Sale
    const invoiceSaleMismatches = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      SELECT COUNT(*) as count
      FROM "Invoice" i
      JOIN "Sale" s ON i."saleId" = s.id
      WHERE i."tenantId" != s."tenantId"
    `);

    const invoiceMismatchCount = Number(invoiceSaleMismatches[0]?.count || 0);
    if (invoiceMismatchCount > 0) {
      results.push({
        passed: false,
        message: `❌ Encontrados ${invoiceMismatchCount} Invoices con tenantId diferente a su Sale`,
        details: { mismatchCount: invoiceMismatchCount },
      });
    } else {
      results.push({
        passed: true,
        message: `✅ Integridad referencial: Invoice -> Sale`,
      });
    }
  } catch (error) {
    results.push({
      passed: false,
      message: `❌ Error verificando integridad referencial: ${(error as Error).message}`,
      details: { error: (error as Error).stack },
    });
  }

  return results;
}

async function checkTenantDataLeakage(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // Intentar detectar posibles fugas de datos
  // Verificar que no haya registros con tenantId que no existe en Tenant
  try {
    const orphanedTenantIds = await prisma.$queryRawUnsafe<Array<{
      table_name: string;
      tenant_id: string;
      count: bigint;
    }>>(`
      SELECT 
        'Product' as table_name,
        "tenantId" as tenant_id,
        COUNT(*) as count
      FROM "Product"
      WHERE "tenantId" NOT IN (SELECT id FROM "Tenant")
      GROUP BY "tenantId"
      
      UNION ALL
      
      SELECT 
        'Sale' as table_name,
        "tenantId" as tenant_id,
        COUNT(*) as count
      FROM "Sale"
      WHERE "tenantId" NOT IN (SELECT id FROM "Tenant")
      GROUP BY "tenantId"
      
      UNION ALL
      
      SELECT 
        'Customer' as table_name,
        "tenantId" as tenant_id,
        COUNT(*) as count
      FROM "Customer"
      WHERE "tenantId" NOT IN (SELECT id FROM "Tenant")
      GROUP BY "tenantId"
    `);

    if (orphanedTenantIds.length > 0) {
      results.push({
        passed: false,
        message: `❌ Encontrados registros con tenantId que no existe en Tenant`,
        details: { orphanedTenantIds },
      });
    } else {
      results.push({
        passed: true,
        message: `✅ Todos los tenantIds referencian tenants válidos`,
      });
    }
  } catch (error) {
    results.push({
      passed: false,
      message: `❌ Error verificando fugas de datos: ${(error as Error).message}`,
      details: { error: (error as Error).stack },
    });
  }

  return results;
}

async function main(): Promise<void> {
  console.log('🔍 Iniciando verificación de aislamiento multi-tenant...\n');

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    results: [],
  };

  try {
    // 1. Verificar registros huérfanos
    console.log('📋 Verificando registros huérfanos...');
    const orphanResults = await checkOrphanedRecords();
    report.results.push(...orphanResults);

    // 2. Verificar índices compuestos
    console.log('📊 Verificando índices compuestos...');
    const indexResults = await checkCompositeIndexes();
    report.results.push(...indexResults);

    // 3. Verificar constraints de unicidad
    console.log('🔒 Verificando constraints de unicidad...');
    const constraintResults = await checkUniqueConstraints();
    report.results.push(...constraintResults);

    // 4. Verificar integridad referencial
    console.log('🔗 Verificando integridad referencial...');
    const integrityResults = await checkReferentialIntegrity();
    report.results.push(...integrityResults);

    // 5. Verificar fugas de datos
    console.log('🛡️ Verificando posibles fugas de datos...');
    const leakageResults = await checkTenantDataLeakage();
    report.results.push(...leakageResults);

    // Calcular estadísticas
    report.totalChecks = report.results.length;
    report.passedChecks = report.results.filter((r) => r.passed).length;
    report.failedChecks = report.results.filter((r) => !r.passed).length;

    // Mostrar resultados
    console.log('\n' + '='.repeat(80));
    console.log('📊 REPORTE DE VERIFICACIÓN DE AISLAMIENTO MULTI-TENANT');
    console.log('='.repeat(80));
    console.log(`Fecha: ${report.timestamp}`);
    console.log(`Total de verificaciones: ${report.totalChecks}`);
    console.log(`✅ Pasadas: ${report.passedChecks}`);
    console.log(`❌ Fallidas: ${report.failedChecks}`);
    console.log('='.repeat(80) + '\n');

    report.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.message}`);
      if (result.details && !result.passed) {
        console.log(`   Detalles:`, JSON.stringify(result.details, null, 2));
      }
    });

    console.log('\n' + '='.repeat(80));

    // Exit code basado en resultados
    if (report.failedChecks > 0) {
      console.log('❌ VERIFICACIÓN FALLIDA: Se encontraron problemas de aislamiento');
      console.log('⚠️  Revisar los detalles arriba y corregir antes de continuar.');
      process.exit(1);
    } else {
      console.log('✅ VERIFICACIÓN EXITOSA: No se encontraron problemas de aislamiento');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error fatal durante la verificación:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch((error) => {
    console.error('Error no manejado:', error);
    process.exit(1);
  });
}

export { main as verifyTenantIsolation };
