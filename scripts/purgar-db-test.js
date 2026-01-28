/**
 * Script para purgar la base de datos de test usando Prisma directamente
 * Ejecutar con: node scripts/purgar-db-test.js
 * O desde apps/api: npm run db:purge
 */

const path = require('path');
const fs = require('fs');

// Cargar variables de entorno desde la raíz del proyecto
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Intentar cargar PrismaClient desde diferentes ubicaciones posibles
let PrismaClient;
try {
  // Primero intentar desde apps/api/node_modules
  PrismaClient = require(path.resolve(__dirname, '../apps/api/node_modules/@prisma/client')).PrismaClient;
} catch (e) {
  try {
    // Si no funciona, intentar desde node_modules raíz
    PrismaClient = require('@prisma/client').PrismaClient;
  } catch (e2) {
    console.error('[ERROR] No se pudo cargar PrismaClient. Asegúrate de ejecutar "npm install" y "npx prisma generate"');
    process.exit(1);
  }
}

const databaseUrl = process.env.DATABASE_URL || 'postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function purgeDatabase() {
  console.log('=== Purgando Base de Datos de Test ===\n');

  try {
    console.log('1. Eliminando datos en orden correcto...\n');

    // Orden: primero tablas con foreign keys, luego las referenciadas
    await prisma.auditLog.deleteMany();
    console.log('   ✓ auditLog eliminado');

    await prisma.quoteItem.deleteMany();
    console.log('   ✓ quoteItem eliminado');

    await prisma.quote.deleteMany();
    console.log('   ✓ quote eliminado');

    await prisma.saleItem.deleteMany();
    console.log('   ✓ saleItem eliminado');

    await prisma.sale.deleteMany();
    console.log('   ✓ sale eliminado');

    await prisma.invoice.deleteMany();
    console.log('   ✓ invoice eliminado');

    await prisma.dianEvent.deleteMany();
    console.log('   ✓ dianEvent eliminado');

    await prisma.dianDocument.deleteMany();
    console.log('   ✓ dianDocument eliminado');

    await prisma.cashMovement.deleteMany();
    console.log('   ✓ cashMovement eliminado');

    await prisma.cashSession.deleteMany();
    console.log('   ✓ cashSession eliminado');

    await prisma.inventoryMovementItem.deleteMany();
    console.log('   ✓ inventoryMovementItem eliminado');

    await prisma.inventoryMovement.deleteMany();
    console.log('   ✓ inventoryMovement eliminado');

    await prisma.stockBalance.deleteMany();
    console.log('   ✓ stockBalance eliminado');

    await prisma.backupRun.deleteMany();
    console.log('   ✓ backupRun eliminado');

    await prisma.product.deleteMany();
    console.log('   ✓ product eliminado');

    await prisma.category.deleteMany();
    console.log('   ✓ category eliminado');

    await prisma.customer.deleteMany();
    console.log('   ✓ customer eliminado');

    await prisma.user.deleteMany();
    console.log('   ✓ user eliminado');

    console.log('\n[OK] Base de datos purgada exitosamente');
  } catch (error) {
    console.error('\n[ERROR] Error al purgar la base de datos:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

purgeDatabase();
