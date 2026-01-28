/* eslint-disable no-console */
/**
 * Seed de datos para DESARROLLO/LOCAL.
 *
 * Genera datos masivos para probar:
 * - Catálogo (categorías/productos)
 * - StockBalance
 * - Clientes
 * - Caja (sesiones/movimientos)
 * - Ventas (PAID) + items + invoices + cash movements (para reportes)
 * - Cotizaciones + items
 *
 * Uso:
 *   node scripts/seed-dev.js --clean
 *   node scripts/seed-dev.js --clean --products 300 --customers 200 --sales 500 --quotes 300
 *
 * Seguridad:
 *   Por defecto solo permite DATABASE_URL en localhost. Usa --force para saltar.
 */

const path = require('path');
const fs = require('fs');

function parseArgs(argv) {
  const out = {
    clean: false,
    force: false,
    seed: 12345,
    categories: 12,
    products: 200,
    customers: 120,
    cashSessions: 5,
    sales: 250,
    quotes: 200,
    daysBack: 90,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--clean') out.clean = true;
    else if (a === '--force') out.force = true;
    else if (a === '--seed') out.seed = Number(argv[++i]);
    else if (a === '--categories') out.categories = Number(argv[++i]);
    else if (a === '--products') out.products = Number(argv[++i]);
    else if (a === '--customers') out.customers = Number(argv[++i]);
    else if (a === '--cashSessions') out.cashSessions = Number(argv[++i]);
    else if (a === '--sales') out.sales = Number(argv[++i]);
    else if (a === '--quotes') out.quotes = Number(argv[++i]);
    else if (a === '--daysBack') out.daysBack = Number(argv[++i]);
  }

  return out;
}

function makeRng(seed) {
  // LCG simple y determinístico
  let state = (seed >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function int(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function money(n) {
  // Prisma Decimal acepta string
  return Number(n).toFixed(2);
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
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(p);
    } catch {
      // continue
    }
  }
  // eslint-disable-next-line global-require
  return require(moduleName);
}

async function main() {
  loadEnv();
  const opts = parseArgs(process.argv);
  const rng = makeRng(opts.seed);

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

  console.log('=== Seed DEV (datos masivos) ===');
  console.log(`DATABASE_URL=${databaseUrl}`);
  console.log(`Opciones: ${JSON.stringify(opts)}`);

  const start = Date.now();

  if (opts.clean) {
    console.log('\n[1/6] Limpiando tablas (orden seguro)...');
    // Orden compatible con FKs
    await prisma.auditLog.deleteMany();
    await prisma.quoteItem.deleteMany();
    await prisma.quote.deleteMany();
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

  console.log('\n[2/6] Creando usuarios (con contraseñas conocidas)...');
  const adminEmail = 'admin@example.com';
  const adminPass = 'Admin123!';
  const userPass = 'User123!';
  const adminHash = await argon2.hash(adminPass);

  await prisma.user.create({
    data: { email: adminEmail, passwordHash: adminHash, role: 'ADMIN' },
  });

  const extraUsers = [
    'vendedor1@example.com',
    'vendedor2@example.com',
    'cajero1@example.com',
  ];
  const extraUserCreates = [];
  for (const email of extraUsers) {
    const hash = await argon2.hash(userPass);
    extraUserCreates.push(
      prisma.user.create({ data: { email, passwordHash: hash, role: 'USER' } }),
    );
  }
  await Promise.all(extraUserCreates);

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) throw new Error('No se pudo crear admin.');

  console.log(`[OK] Admin: ${adminEmail} / ${adminPass}`);
  console.log(`[OK] Users (password=${userPass}): ${extraUsers.join(', ')}`);

  console.log('\n[3/6] Creando categorías...');
  const baseCats = [
    'Cables',
    'Interruptores',
    'Iluminación',
    'Tomas',
    'Canaletas',
    'Breakers',
    'Conectores',
    'Herramientas',
    'Tubería PVC',
    'Accesorios',
  ];
  const catNames = [];
  for (const n of baseCats) catNames.push(n);
  for (let i = catNames.length; i < opts.categories; i++) {
    catNames.push(`Categoría ${String(i + 1).padStart(2, '0')}`);
  }

  await prisma.category.createMany({
    data: catNames.map((name) => ({ name })),
    skipDuplicates: true,
  });
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  console.log(`[OK] Categorías: ${categories.length}`);

  console.log('\n[4/6] Creando productos + stock...');
  const productRows = [];
  for (let i = 1; i <= opts.products; i++) {
    const code = `SKU-${String(i).padStart(6, '0')}`;
    const cat = pick(rng, categories);
    const baseCost = int(rng, 500, 150000);
    const margin = 1 + rng() * 0.6; // 1.0 - 1.6
    const price = Math.max(baseCost + 100, Math.round(baseCost * margin));
    const taxRate = pick(rng, [0, 0, 0, 5, 19]); // más 0 y 19

    productRows.push({
      internalCode: code,
      name: `Producto ${String(i).padStart(6, '0')}`,
      categoryId: cat?.id ?? null,
      cost: money(baseCost),
      price: money(price),
      taxRate: money(taxRate),
      isActive: true,
    });
  }

  await prisma.product.createMany({ data: productRows, skipDuplicates: true });
  const products = await prisma.product.findMany({
    select: { id: true, cost: true, price: true, taxRate: true },
    orderBy: { createdAt: 'asc' },
  });

  await prisma.stockBalance.createMany({
    data: products.map((p) => ({
      productId: p.id,
      qtyOnHand: int(rng, 0, 250),
      qtyReserved: 0,
    })),
    skipDuplicates: true,
  });
  console.log(`[OK] Productos: ${products.length} | StockBalance: ${products.length}`);

  console.log('\n[5/6] Creando clientes...');
  const docTypes = ['CC', 'NIT', 'CE'];
  const customers = [];
  for (let i = 1; i <= opts.customers; i++) {
    const docType = pick(rng, docTypes);
    const docNumber =
      docType === 'NIT'
        ? `9${String(10000000 + i).padStart(8, '0')}`
        : String(1000000000 + i);
    customers.push({
      docType,
      docNumber,
      name: `Cliente ${String(i).padStart(4, '0')}`,
      email: `cliente${i}@example.com`,
      phone: `300${String(1000000 + i).slice(-7)}`,
      address: `Calle ${int(rng, 1, 80)} #${int(rng, 1, 40)}-${int(rng, 1, 40)}`,
      cityCode: '11001',
    });
  }
  await prisma.customer.createMany({ data: customers, skipDuplicates: true });
  const customerRows = await prisma.customer.findMany({ select: { id: true } });
  console.log(`[OK] Clientes: ${customerRows.length}`);

  console.log('\n[6/6] Creando caja + ventas + cotizaciones (para reportes)...');
  // Sesiones de caja
  const sessions = [];
  for (let i = 0; i < opts.cashSessions; i++) {
    const openedAt = new Date(Date.now() - int(rng, 0, opts.daysBack) * 86400000);
    const willClose = rng() < 0.7;
    const openingAmount = int(rng, 0, 500000);
    const closingAmount = willClose ? openingAmount + int(rng, 0, 800000) : 0;
    const closedAt = willClose
      ? new Date(openedAt.getTime() + int(rng, 1, 10) * 3600000)
      : null;

    sessions.push(
      await prisma.cashSession.create({
        data: {
          openedAt,
          closedAt,
          openingAmount: money(openingAmount),
          closingAmount: money(closingAmount),
          openedBy: admin.id,
        },
        select: { id: true },
      }),
    );
  }

  const productLite = await prisma.product.findMany({
    select: { id: true, price: true, taxRate: true },
  });
  const paymentMethods = ['CASH', 'CARD', 'TRANSFER'];

  let createdSales = 0;
  for (let i = 1; i <= opts.sales; i++) {
    const customerId = pick(rng, customerRows).id;
    const soldAt = new Date(Date.now() - int(rng, 0, opts.daysBack) * 86400000);
    const sessionId = pick(rng, sessions).id;

    const itemsCount = int(rng, 1, 5);
    const chosen = [];
    for (let k = 0; k < itemsCount; k++) chosen.push(pick(rng, productLite));

    let subtotal = 0;
    let taxTotal = 0;
    const saleItems = [];
    for (const p of chosen) {
      const qty = int(rng, 1, 8);
      const unitPrice = Number(p.price);
      const lineSub = unitPrice * qty;
      const taxRate = Number(p.taxRate);
      const lineTax = lineSub * (taxRate / 100);
      subtotal += lineSub;
      taxTotal += lineTax;
      saleItems.push({ productId: p.id, qty, unitPrice: money(unitPrice), taxRate: money(taxRate), lineTotal: money(lineSub + lineTax) });
    }
    const grandTotal = subtotal + taxTotal;

    const sale = await prisma.sale.create({
      data: {
        customerId,
        status: 'PAID',
        soldAt,
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
        items: {
          create: saleItems,
        },
      },
      select: { id: true },
    });

    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(i).padStart(6, '0')}`;
    await prisma.invoice.create({
      data: {
        saleId: sale.id,
        customerId,
        number: invoiceNumber,
        status: 'ISSUED',
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
      },
      select: { id: true },
    });

    await prisma.cashMovement.create({
      data: {
        sessionId,
        type: 'IN',
        method: pick(rng, paymentMethods),
        amount: money(grandTotal),
        reference: `PAGO-${invoiceNumber}`,
        relatedSaleId: sale.id,
      },
    });

    createdSales++;
  }

  let createdQuotes = 0;
  for (let i = 1; i <= opts.quotes; i++) {
    const customerId = pick(rng, customerRows).id;
    const createdAt = new Date(Date.now() - int(rng, 0, opts.daysBack) * 86400000);
    const validUntil = new Date(createdAt.getTime() + int(rng, 10, 40) * 86400000);
    const status = pick(rng, ['DRAFT', 'SENT', 'DRAFT', 'DRAFT']);

    const itemsCount = int(rng, 1, 6);
    const chosen = [];
    for (let k = 0; k < itemsCount; k++) chosen.push(pick(rng, productLite));

    let subtotal = 0;
    let taxTotal = 0;
    const quoteItems = [];
    for (const p of chosen) {
      const qty = int(rng, 1, 12);
      const unitPrice = Number(p.price);
      const lineSub = unitPrice * qty;
      const taxRate = Number(p.taxRate);
      const lineTax = lineSub * (taxRate / 100);
      subtotal += lineSub;
      taxTotal += lineTax;
      quoteItems.push({ productId: p.id, qty, unitPrice: money(unitPrice), taxRate: money(taxRate), lineTotal: money(lineSub + lineTax) });
    }
    const grandTotal = subtotal + taxTotal;

    await prisma.quote.create({
      data: {
        customerId,
        status,
        validUntil,
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
        createdAt,
        items: { create: quoteItems },
      },
      select: { id: true },
    });
    createdQuotes++;
  }

  const elapsedMs = Date.now() - start;
  console.log('\n=== Seed completado ===');
  console.log(`Ventas creadas: ${createdSales}`);
  console.log(`Cotizaciones creadas: ${createdQuotes}`);
  console.log(`Tiempo: ${elapsedMs}ms`);
  console.log('\nCredenciales:');
  console.log(`- ADMIN: ${adminEmail} / ${adminPass}`);
  console.log(`- USER: vendedor1@example.com / ${userPass}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[ERROR]', e);
  process.exit(1);
});

