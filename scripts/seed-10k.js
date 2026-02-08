/* eslint-disable no-console */
/**
 * Seed de prueba con N registros de cada entidad (por defecto 10.000).
 *
 * Genera (con --clean):
 * - Usuarios: admin + vendedor
 * - N categorías, productos, clientes, proveedores, sesiones de caja,
 *   pedidos de compra, facturas de proveedor, movimientos de inventario,
 *   ventas, cotizaciones
 *
 * Uso:
 *   node scripts/seed-10k.js --clean             (10.000 de cada uno)
 *   node scripts/seed-10k.js --clean --count 100 (100 de cada uno)
 *   node scripts/seed-10k.js --force            (permite DB no local)
 */

const path = require('path');
const fs = require('fs');

const DEFAULT_N = 10000;

function parseArgs(argv) {
  const out = { clean: false, force: false, count: DEFAULT_N };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--clean') out.clean = true;
    else if (a === '--force') out.force = true;
    else if ((a === '--count' || a === '-n') && argv[i + 1] != null) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) out.count = Math.min(n, 50000);
      i += 1;
    }
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

function pick(arr, i) {
  return arr[i % arr.length];
}

function money(n) {
  return Number(n).toFixed(2);
}

async function main() {
  loadEnv();
  const opts = parseArgs(process.argv);
  const N = opts.count;
  const BATCH = Math.min(500, Math.max(50, N));

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

  console.log(`=== Seed (${N} de cada entidad) ===`);
  console.log(`DATABASE_URL=${databaseUrl}`);

  const start = Date.now();

  // Tenant por defecto (debe existir; ejecutar antes: npm run prisma:seed)
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) {
    console.error('[ABORT] No hay tenant por defecto. Ejecuta antes: npm run prisma:seed');
    await prisma.$disconnect();
    process.exit(1);
  }
  const tenantId = tenant.id;
  console.log('Tenant por defecto:', tenantId);

  if (opts.clean) {
    console.log('\n[0] Limpiando tablas...');
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

  // --- Usuarios ---
  console.log('\n[1] Usuarios...');
  const adminEmail = 'admin@example.com';
  const adminPass = 'Admin123!';
  const userEmail = 'vendedor@example.com';
  const userPass = 'User123!';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const adminHash = await argon2.hash(adminPass);
    admin = await prisma.user.create({
      data: { email: adminEmail, passwordHash: adminHash, role: 'ADMIN', tenantId },
    });
    console.log(`  ADMIN: ${adminEmail} / ${adminPass}`);
  }
  let user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    const userHash = await argon2.hash(userPass);
    user = await prisma.user.create({
      data: { email: userEmail, passwordHash: userHash, role: 'USER', tenantId },
    });
    console.log(`  USER: ${userEmail} / ${userPass}`);
  }
  const adminId = admin.id;

  // --- Categorías (10k en lotes) ---
  console.log(`\n[2] Categorías (${N})...`);
  for (let b = 0; b < N; b += BATCH) {
    const size = Math.min(BATCH, N - b);
    const data = Array.from({ length: size }, (_, i) => ({
      tenantId,
      name: `Categoría ${String(b + i + 1).padStart(6, '0')}`,
    }));
    await prisma.category.createMany({ data, skipDuplicates: true });
    if ((b + size) % 2000 === 0 || b + size === N) console.log(`  ${b + size}/${N}`);
  }
  const categories = await prisma.category.findMany({ select: { id: true }, orderBy: { name: 'asc' } });
  console.log(`  Total categorías: ${categories.length}`);

  // --- Productos (10k en lotes) ---
  console.log(`\n[3] Productos (${N})...`);
  for (let b = 0; b < N; b += BATCH) {
    const size = Math.min(BATCH, N - b);
    const data = Array.from({ length: size }, (_, i) => {
      const idx = b + i + 1;
      const code = `SKU-${String(idx).padStart(6, '0')}`;
      const cat = pick(categories, idx - 1);
      const cost = 500 + (idx % 150000);
      const price = cost + 1000 + (idx % 50000);
      return {
        tenantId,
        internalCode: code,
        name: `Producto ${String(idx).padStart(6, '0')}`,
        categoryId: cat?.id ?? null,
        cost: money(cost),
        price: money(price),
        taxRate: money([0, 0, 19][idx % 3]),
        isActive: true,
      };
    });
    await prisma.product.createMany({ data, skipDuplicates: true });
    if ((b + size) % 2000 === 0 || b + size === N) console.log(`  ${b + size}/${N}`);
  }
  const products = await prisma.product.findMany({
    select: { id: true, cost: true, price: true, taxRate: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`  Total productos: ${products.length}`);

  // --- StockBalance para todos los productos ---
  console.log(`\n[4] StockBalance (${products.length})...`);
  for (let b = 0; b < products.length; b += BATCH) {
    const chunk = products.slice(b, b + BATCH);
    await prisma.stockBalance.createMany({
      data: chunk.map((p) => ({
        productId: p.id,
        qtyOnHand: 50 + (b % 200),
        qtyReserved: 0,
      })),
      skipDuplicates: true,
    });
    if (b + chunk.length >= products.length) console.log(`  ${products.length} balances`);
  }

  // --- Clientes (10k) ---
  console.log(`\n[5] Clientes (${N})...`);
  const docTypes = ['CC', 'NIT', 'CE'];
  for (let b = 0; b < N; b += BATCH) {
    const size = Math.min(BATCH, N - b);
    const data = Array.from({ length: size }, (_, i) => {
      const idx = b + i + 1;
      const docType = docTypes[idx % 3];
      const docNumber =
        docType === 'NIT'
          ? `9${String(10000000 + idx).padStart(8, '0')}`
          : String(1000000000 + idx);
      return {
        tenantId,
        docType,
        docNumber,
        name: `Cliente ${String(idx).padStart(6, '0')}`,
        email: `cliente${idx}@test.com`,
        phone: `300${String(1000000 + idx).slice(-7)}`,
        address: `Calle ${(idx % 80) + 1} #${(idx % 40) + 1}`,
        cityCode: '11001',
      };
    });
    await prisma.customer.createMany({ data, skipDuplicates: true });
    if ((b + size) % 2000 === 0 || b + size === N) console.log(`  ${b + size}/${N}`);
  }
  const customers = await prisma.customer.findMany({ select: { id: true }, orderBy: { name: 'asc' } });
  console.log(`  Total clientes: ${customers.length}`);

  // --- Proveedores (10k) ---
  console.log(`\n[6] Proveedores (${N})...`);
  for (let b = 0; b < N; b += BATCH) {
    const size = Math.min(BATCH, N - b);
    const data = Array.from({ length: size }, (_, i) => {
      const idx = b + i + 1;
      return {
        tenantId,
        nit: `9${String(80000000 + idx).padStart(8, '0')}`,
        name: `Proveedor ${String(idx).padStart(6, '0')}`,
        email: `proveedor${idx}@test.com`,
        phone: `601${String(1000000 + idx).slice(-7)}`,
        address: `Carrera ${(idx % 90) + 10} #${(idx % 50) + 1}`,
        cityCode: '11001',
        contactPerson: `Contacto ${idx}`,
        isActive: true,
      };
    });
    await prisma.supplier.createMany({ data, skipDuplicates: true });
    if ((b + size) % 2000 === 0 || b + size === N) console.log(`  ${b + size}/${N}`);
  }
  const suppliers = await prisma.supplier.findMany({ select: { id: true }, orderBy: { name: 'asc' } });
  console.log(`  Total proveedores: ${suppliers.length}`);

  // --- Sesiones de caja (10k, última abierta) ---
  console.log(`\n[7] Sesiones de caja (${N})...`);
  for (let b = 0; b < N; b += BATCH) {
    const size = Math.min(BATCH, N - b);
    const isLastBatch = b + size >= N;
    const data = Array.from({ length: size }, (_, i) => {
      const idx = b + i + 1;
      const isLast = isLastBatch && i === size - 1;
      const openedAt = new Date(Date.now() - (N - idx) * 3600000);
      const base = {
        tenantId,
        openedAt,
        openingAmount: money(50000 + (idx % 500000)),
        openedBy: adminId,
      };
      if (isLast) {
        return { ...base, closedAt: null, closingAmount: money(0) };
      }
      return {
        ...base,
        closedAt: new Date(openedAt.getTime() + 8 * 3600000),
        closingAmount: money(100000 + (idx % 500000)),
      };
    });
    await prisma.cashSession.createMany({ data });
    if ((b + size) % 2000 === 0 || b + size === N) console.log(`  ${b + size}/${N}`);
  }
  const sessions = await prisma.cashSession.findMany({
    select: { id: true, closedAt: true },
    orderBy: { openedAt: 'desc' },
  });
  const openSession = sessions.find((s) => !s.closedAt) || sessions[0];
  console.log(`  Total sesiones: ${sessions.length} (≥1 abierta)`);

  // --- Pedidos de compra (10k con 1-2 ítems) ---
  console.log(`\n[8] Pedidos de compra (${N})...`);
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  for (let i = 0; i < N; i++) {
    const supplier = pick(suppliers, i);
    const orderNumber = `PO-${year}${month}-${String(i + 1).padStart(6, '0')}`;
    const itemCount = 1 + (i % 2);
    const chosen = [];
    for (let k = 0; k < itemCount; k++) chosen.push(pick(products, i + k * 1000));
    let subtotal = 0;
    let taxTotal = 0;
    const poItems = chosen.map((p) => {
      const qty = 5 + (i % 20);
      const unitCost = Number(p.cost);
      const lineSub = unitCost * qty;
      const tax = (lineSub * Number(p.taxRate || 0)) / 100;
      subtotal += lineSub;
      taxTotal += tax;
      return {
        productId: p.id,
        qty,
        unitCost: money(unitCost),
        taxRate: p.taxRate,
        lineTotal: money(lineSub + tax),
        receivedQty: 0,
      };
    });
    const grandTotal = subtotal + taxTotal;
    await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: supplier.id,
        orderNumber,
        status: 'DRAFT',
        orderDate: new Date(Date.now() - (N - i) * 86400000),
        expectedDate: new Date(Date.now() + 7 * 86400000),
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
        createdBy: adminId,
        items: { create: poItems },
      },
    });
    if ((i + 1) % 2000 === 0 || i + 1 === N) console.log(`  ${i + 1}/${N}`);
  }
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    select: { id: true, supplierId: true, grandTotal: true },
    orderBy: { orderDate: 'desc' },
  });
  console.log(`  Total pedidos: ${purchaseOrders.length}`);

  // --- Facturas de proveedor (10k) ---
  console.log(`\n[9] Facturas de proveedor (${N})...`);
  for (let i = 0; i < N; i++) {
    const supplier = pick(suppliers, i);
    const invDate = new Date(Date.now() - (N - i) * 86400000);
    const dueDate = new Date(invDate.getTime() + 30 * 86400000);
    const grandTotal = 100000 + (i % 5000000);
    const subtotal = Math.round(grandTotal / 1.19);
    const taxTotal = grandTotal - subtotal;
    await prisma.supplierInvoice.create({
      data: {
        tenantId,
        supplierId: supplier.id,
        purchaseOrderId: null,
        invoiceNumber: `FV-${year}-${String(i + 1).padStart(6, '0')}`,
        invoiceDate: invDate,
        dueDate,
        status: ['PENDING', 'PAID', 'PARTIALLY_PAID'][i % 3],
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
        paidAmount: money(i % 3 === 1 ? grandTotal : i % 3 === 2 ? grandTotal / 2 : 0),
      },
    });
    if ((i + 1) % 2000 === 0 || i + 1 === N) console.log(`  ${i + 1}/${N}`);
  }
  console.log(`  Total facturas proveedor: ${N}`);

  // --- Movimientos de inventario (10k con 1 ítem) ---
  console.log(`\n[10] Movimientos de inventario (${N})...`);
  const movTypes = ['IN', 'OUT', 'ADJUST'];
  for (let i = 0; i < N; i++) {
    const type = movTypes[i % 3];
    const product = pick(products, i);
    const qty = type === 'OUT' ? 1 + (i % 10) : 10 + (i % 50);
    await prisma.inventoryMovement.create({
      data: {
        tenantId,
        type,
        reason: type === 'IN' ? 'Compra' : type === 'OUT' ? 'Venta' : 'Ajuste',
        supplierId: type === 'IN' ? pick(suppliers, i).id : null,
        createdBy: adminId,
        items: {
          create: [
            {
              productId: product.id,
              qty,
              unitCost: product.cost,
            },
          ],
        },
      },
    });
    if ((i + 1) % 2000 === 0 || i + 1 === N) console.log(`  ${i + 1}/${N}`);
  }
  console.log(`  Total movimientos: ${N}`);

  // --- Ventas (10k con 1-3 ítems, factura, movimiento caja) ---
  console.log(`\n[11] Ventas (${N})...`);
  const paymentMethods = ['CASH', 'CARD', 'TRANSFER'];
  for (let i = 0; i < N; i++) {
    const customer = pick(customers, i);
    const session = pick(sessions, i);
    const itemCount = 1 + (i % 3);
    const chosen = [];
    for (let k = 0; k < itemCount; k++) chosen.push(pick(products, i + k * 500));
    let subtotal = 0;
    let taxTotal = 0;
    const saleItems = chosen.map((p) => {
      const qty = 1 + (i % 5);
      const unitPrice = Number(p.price);
      const lineSub = unitPrice * qty;
      const tax = (lineSub * Number(p.taxRate || 0)) / 100;
      subtotal += lineSub;
      taxTotal += tax;
      return {
        productId: p.id,
        qty,
        unitPrice: money(unitPrice),
        taxRate: p.taxRate,
        lineTotal: money(lineSub + tax),
      };
    });
    const grandTotal = subtotal + taxTotal;
    const soldAt = new Date(Date.now() - (N - i) * 86400000);
    const sale = await prisma.sale.create({
      data: {
        tenantId,
        customerId: customer.id,
        status: 'PAID',
        soldAt,
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
        items: { create: saleItems },
      },
      select: { id: true },
    });
    const invNum = `INV-${year}-${String(i + 1).padStart(6, '0')}`;
    await prisma.invoice.create({
      data: {
        tenantId,
        saleId: sale.id,
        customerId: customer.id,
        number: invNum,
        status: 'ISSUED',
        issuedAt: soldAt,
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
      },
    });
    await prisma.cashMovement.create({
      data: {
        sessionId: session.id,
        type: 'IN',
        method: paymentMethods[i % 3],
        amount: money(grandTotal),
        reference: invNum,
        relatedSaleId: sale.id,
      },
    });
    if ((i + 1) % 2000 === 0 || i + 1 === N) console.log(`  ${i + 1}/${N}`);
  }
  console.log(`  Total ventas: ${N}`);

  // --- Cotizaciones (10k con 1-3 ítems) ---
  console.log(`\n[12] Cotizaciones (${N})...`);
  const quoteStatuses = ['DRAFT', 'SENT', 'EXPIRED', 'CONVERTED', 'CANCELLED'];
  for (let i = 0; i < N; i++) {
    const customer = pick(customers, i);
    const itemCount = 1 + (i % 3);
    const chosen = [];
    for (let k = 0; k < itemCount; k++) chosen.push(pick(products, i + k * 500));
    let subtotal = 0;
    let taxTotal = 0;
    const quoteItems = chosen.map((p) => {
      const qty = 1 + (i % 8);
      const unitPrice = Number(p.price);
      const lineSub = unitPrice * qty;
      const tax = (lineSub * Number(p.taxRate || 0)) / 100;
      subtotal += lineSub;
      taxTotal += tax;
      return {
        productId: p.id,
        qty,
        unitPrice: money(unitPrice),
        taxRate: p.taxRate,
        lineTotal: money(lineSub + tax),
      };
    });
    const grandTotal = subtotal + taxTotal;
    const createdAt = new Date(Date.now() - (N - i) * 86400000);
    const validUntil = new Date(createdAt.getTime() + (10 + (i % 30)) * 86400000);
    const status = quoteStatuses[i % 5];
    await prisma.quote.create({
      data: {
        tenantId,
        customerId: customer.id,
        status,
        validUntil,
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
        createdAt,
        items: { create: quoteItems },
      },
    });
    if ((i + 1) % 2000 === 0 || i + 1 === N) console.log(`  ${i + 1}/${N}`);
  }
  console.log(`  Total cotizaciones: ${N}`);

  const elapsedMs = Date.now() - start;
  console.log('\n=== Seed 10k completado ===');
  console.log(`Tiempo total: ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log('\nResumen:');
  console.log(`  Categorías:     ${categories.length}`);
  console.log(`  Productos:      ${products.length}`);
  console.log(`  Clientes:       ${customers.length}`);
  console.log(`  Proveedores:    ${suppliers.length}`);
  console.log(`  Sesiones caja:  ${sessions.length}`);
  console.log(`  Pedidos compra: ${N}`);
  console.log(`  Facturas prov:  ${N}`);
  console.log(`  Mov. inventario: ${N}`);
  console.log(`  Ventas:         ${N}`);
  console.log(`  Cotizaciones:   ${N}`);
  console.log('\nCredenciales:');
  console.log(`  ADMIN: ${adminEmail} / ${adminPass}`);
  console.log(`  USER:  ${userEmail} / ${userPass}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[ERROR]', e);
  process.exit(1);
});
