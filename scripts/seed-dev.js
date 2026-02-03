/* eslint-disable no-console */
/**
 * Seed mínimo para DESARROLLO: solo usuarios con roles visibles (ADMIN y USER).
 *
 * Genera:
 * - 1 usuario ADMIN (admin@example.com)
 * - 1 usuario USER (vendedor@example.com)
 *
 * Uso:
 *   node scripts/seed-dev.js --clean   (limpia tablas y crea solo usuarios)
 *   node scripts/seed-dev.js          (solo crea usuarios si no existen)
 *
 * Seguridad:
 *   Por defecto solo permite DATABASE_URL en localhost. Usa --force para saltar.
 */

const path = require('path');
const fs = require('fs');

function parseArgs(argv) {
  const out = { clean: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--clean') out.clean = true;
    else if (a === '--force') out.force = true;
  }
  return out;
}

function mustLocal(databaseUrl, force) {
  if (force) return;
  const u = String(databaseUrl || '');
  const ok =
    u.includes('localhost') ||
    u.includes('127.0.0.1') ||
    u.includes('0.0.0.0') ||
    u.includes('host.docker.internal');
  if (!ok) {
    console.error(
      `[ABORT] DATABASE_URL no parece local. Usa --force si estás seguro.\nDATABASE_URL=${u}`,
    );
    process.exit(1);
  }
}

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

function requireFromPossiblePaths(moduleName, candidates) {
  for (const p of candidates) {
    try {
      return require(p);
    } catch {
      // continue
    }
  }
  return require(moduleName);
}

async function main() {
  loadEnv();
  const opts = parseArgs(process.argv);

  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public';
  mustLocal(databaseUrl, opts.force);

  const prismaPkg = requireFromPossiblePaths('@prisma/client', [
    path.resolve(__dirname, '../apps/api/node_modules/@prisma/client'),
    path.resolve(__dirname, '../node_modules/@prisma/client'),
  ]);
  const argon2 = requireFromPossiblePaths('argon2', [
    path.resolve(__dirname, '../apps/api/node_modules/argon2'),
    path.resolve(__dirname, '../node_modules/argon2'),
  ]);

  const PrismaClient = prismaPkg.PrismaClient;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  console.log('=== Seed DEV (solo roles visibles) ===');
  console.log(`DATABASE_URL=${databaseUrl}`);

  const start = Date.now();

  if (opts.clean) {
    console.log('\n[1/2] Limpiando tablas (orden seguro por FKs)...');
    await prisma.auditLog.deleteMany();
    await prisma.supplierPayment.deleteMany();
    await prisma.supplierInvoice.deleteMany();
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.quoteItem.deleteMany();
    await prisma.quote.deleteMany();
    await prisma.saleReturnItem.deleteMany();
    await prisma.saleReturn.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.cashMovement.deleteMany();
    await prisma.dianEvent.deleteMany();
    await prisma.dianDocument.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.inventoryMovementItem.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.stockBalance.deleteMany();
    await prisma.backupRun.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
    console.log('[OK] Limpieza completa.');
  }

  console.log('\n[2/2] Creando usuarios (roles visibles: ADMIN y USER)...');
  const adminEmail = 'admin@example.com';
  const adminPass = 'Admin123!';
  const userEmail = 'vendedor@example.com';
  const userPass = 'User123!';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const adminHash = await argon2.hash(adminPass);
    await prisma.user.create({
      data: { email: adminEmail, passwordHash: adminHash, role: 'ADMIN' },
    });
    console.log(`[OK] ADMIN: ${adminEmail} / ${adminPass}`);
  } else {
    console.log(`[SKIP] ADMIN ya existe: ${adminEmail}`);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!existingUser) {
    const userHash = await argon2.hash(userPass);
    await prisma.user.create({
      data: { email: userEmail, passwordHash: userHash, role: 'USER' },
    });
    console.log(`[OK] USER: ${userEmail} / ${userPass}`);
  } else {
    console.log(`[SKIP] USER ya existe: ${userEmail}`);
  }

  const elapsedMs = Date.now() - start;
  console.log('\n=== Seed completado ===');
  console.log(`Tiempo: ${elapsedMs}ms`);
  console.log('\nCredenciales (roles visibles en el menú):');
  console.log(`  ADMIN: ${adminEmail} / ${adminPass}`);
  console.log(`  USER:  ${userEmail} / ${userPass}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[ERROR]', e);
  process.exit(1);
});
