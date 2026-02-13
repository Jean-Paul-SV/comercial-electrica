/**
 * Script para purgar la base de datos de test usando Prisma directamente.
 * Ejecutar con: node scripts/purgar-db-test.js
 * O desde apps/api: npm run db:purge
 *
 * PERFILES QUE SE CONSERVAN (no se borran usuarios ni asignaciones de rol):
 * - Administrador (admin): todos los permisos en el tenant.
 * - Usuario (user): permisos básicos de operación (ventas, caja, inventario, etc.).
 * - Admin de plataforma: mismo rol admin sin tenant (Panel proveedor).
 *
 * Se elimina todo lo operativo (ventas, productos, inventario, clientes, DIAN, caja, etc.)
 * y se mantienen: User, UserRole, Role, Permission, Plan, Tenant, Subscription.
 *
 * Para borrar también usuarios y dejar solo estructura + seed: usar PURGE_FULL=1
 */

const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

let PrismaClient;
try {
  PrismaClient = require(path.resolve(__dirname, '../apps/api/node_modules/@prisma/client')).PrismaClient;
} catch (e) {
  try {
    PrismaClient = require('@prisma/client').PrismaClient;
  } catch (e2) {
    console.error('[ERROR] No se pudo cargar PrismaClient. Ejecuta "npm install" y "npx prisma generate"');
    process.exit(1);
  }
}

const databaseUrl = process.env.DATABASE_URL || 'postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public';
const purgeFull = process.env.PURGE_FULL === '1' || process.env.PURGE_FULL === 'true';

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

async function purgeDatabase() {
  console.log('=== Purgando Base de Datos ===\n');
  if (!purgeFull) {
    console.log('Modo: conservar usuarios y perfiles asignados (User, UserRole, Role, Permission, Plan, Tenant).\n');
  } else {
    console.log('Modo: purga total (también se borran usuarios). Luego ejecuta "npm run prisma:seed".\n');
  }

  try {
    console.log('Eliminando datos operativos...\n');

    await prisma.auditLog.deleteMany();
    console.log('   ✓ AuditLog');

    await prisma.quoteItem.deleteMany();
    await prisma.quote.deleteMany();
    console.log('   ✓ Cotizaciones');

    await prisma.saleReturnItem.deleteMany();
    await prisma.saleReturn.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.sale.deleteMany();
    console.log('   ✓ Ventas y devoluciones');

    await prisma.invoice.deleteMany();
    await prisma.dianEvent.deleteMany();
    await prisma.dianDocument.deleteMany();
    await prisma.dianConfig.deleteMany();
    console.log('   ✓ Facturación / DIAN');

    await prisma.cashMovement.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.cashSession.deleteMany();
    console.log('   ✓ Caja y gastos');

    await prisma.inventoryMovementItem.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.stockBalance.deleteMany();
    console.log('   ✓ Inventario / movimientos');

    await prisma.productDictionaryEntry.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    console.log('   ✓ Productos y categorías');

    await prisma.customer.deleteMany();
    console.log('   ✓ Clientes');

    await prisma.supplierPayment.deleteMany();
    await prisma.supplierInvoice.deleteMany();
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.supplier.deleteMany();
    console.log('   ✓ Proveedores y compras');

    await prisma.backupRun.deleteMany();
    await prisma.stripeEvent.deleteMany();
    console.log('   ✓ Backup / Stripe');

    if (purgeFull) {
      await prisma.userRole.deleteMany();
      await prisma.user.deleteMany();
      console.log('   ✓ Usuarios y asignaciones de rol (purga total)');
    }

    console.log('\n[OK] Purga completada.');
    if (!purgeFull) {
      console.log('Usuarios y perfiles asignados (Administrador / Usuario) se mantienen.');
    } else {
      console.log('Ejecuta: npm run prisma:seed (desde la raíz) para recrear Plan, Tenant, Roles y admin de plataforma.');
    }
  } catch (error) {
    console.error('\n[ERROR]', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

purgeDatabase();
