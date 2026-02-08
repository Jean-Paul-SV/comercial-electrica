/* eslint-disable no-console */
/**
 * Seed de datos REALES para Comercial Eléctrica (≥500 registros).
 *
 * Genera datos coherentes con el esquema actual (multi-tenant):
 * - Plan + Tenant por defecto (si no existen)
 * - Usuarios admin y vendedor (con tenantId)
 * - Categorías y productos de ferretería eléctrica (nombres reales)
 * - Clientes y proveedores (Colombia, NIT/CC, ciudades reales)
 * - Sesiones de caja, gastos, pedidos de compra, facturas proveedor
 * - Movimientos de inventario, ventas, cotizaciones, facturas
 *
 * Uso:
 *   node scripts/seed-500-real.js              (añade datos; no borra)
 *   node scripts/seed-500-real.js --clean      (limpia datos de negocio y regenera)
 *   node scripts/seed-500-real.js --force      (permite BD no local)
 */

const path = require('path');
const fs = require('fs');

const MODULE_CODES = [
  'core', 'inventory', 'suppliers', 'electronic_invoicing',
  'advanced_reports', 'audit', 'backups',
];

function parseArgs(argv) {
  const out = { clean: false, force: false, fixTenantOnly: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--clean') out.clean = true;
    else if (a === '--force') out.force = true;
    else if (a === '--fix-tenant-only') out.fixTenantOnly = true;
  }
  return out;
}

function mustLocal(databaseUrl, force) {
  if (force) return;
  const u = String(databaseUrl || '');
  const ok = u.includes('localhost') || u.includes('127.0.0.1') || u.includes('0.0.0.0') || u.includes('host.docker.internal');
  if (!ok) {
    console.error('[ABORT] DATABASE_URL no parece local. Usa --force si estás seguro.\nDATABASE_URL=' + u);
    process.exit(1);
  }
}

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
}

function requireFromPossiblePaths(moduleName, candidates) {
  for (const p of candidates) {
    try { return require(p); } catch { /* continue */ }
  }
  return require(moduleName);
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function money(n) {
  return Number(n).toFixed(2);
}

// --- Datos reales (ferretería eléctrica, Colombia) ---

const CATEGORIAS_REALES = [
  'Cables y Conductores', 'Breakers y Protección', 'Iluminación LED', 'Herrajes y Fijaciones',
  'Tubos y Canaletas', 'Conectores y Terminales', 'Transformadores', 'Interruptores y Tomas',
  'Conduit y Accesorios', 'Herramientas Eléctricas', 'Canalización', 'Puestas a Tierra',
  'Cajas y Gabinetes', 'Sensores y Automatización', 'Bombillos y Luminarias',
];

const PRODUCTOS_REALES = [
  { code: 'CABLE-THW-12', name: 'Cable THW 12 AWG 100m', cost: 85000, price: 125000, tax: 19 },
  { code: 'CABLE-THW-14', name: 'Cable THW 14 AWG 100m', cost: 62000, price: 92000, tax: 19 },
  { code: 'BREAKER-2P-20', name: 'Breaker termomagnético 2P 20A', cost: 18500, price: 28000, tax: 19 },
  { code: 'BREAKER-2P-32', name: 'Breaker termomagnético 2P 32A', cost: 22000, price: 33000, tax: 19 },
  { code: 'LED-18W-E27', name: 'Bombillo LED 18W E27 luz día', cost: 8500, price: 14500, tax: 19 },
  { code: 'LED-9W-E27', name: 'Bombillo LED 9W E27', cost: 4500, price: 7500, tax: 19 },
  { code: 'TUBO-PVC-1', name: 'Tubo PVC 1" x 3m', cost: 4200, price: 6800, tax: 19 },
  { code: 'CANALETA-2X1', name: 'Canaleta 2x1" 2m', cost: 3800, price: 6200, tax: 19 },
  { code: 'TOMA-DOBLE', name: 'Toma doble 20A', cost: 6500, price: 10500, tax: 19 },
  { code: 'APAGADOR-SIMPLE', name: 'Apagador simple', cost: 4200, price: 7200, tax: 19 },
  { code: 'CAJA-OCTAGONAL', name: 'Caja octagonal metálica', cost: 5800, price: 9500, tax: 19 },
  { code: 'CONECTOR-PASANTE', name: 'Conector pasante 1/2"', cost: 1200, price: 2200, tax: 19 },
  { code: 'CINTA-AISLANTE', name: 'Cinta aislante 19mm x 20m', cost: 3500, price: 5800, tax: 19 },
  { code: 'TRANSF-500VA', name: 'Transformador 500VA', cost: 95000, price: 145000, tax: 19 },
  { code: 'INTERRUPTOR-3V', name: 'Interruptor 3 vías', cost: 7800, price: 12500, tax: 19 },
  { code: 'LUMINARIA-LED-60', name: 'Luminaria LED 60cm panel', cost: 35000, price: 52000, tax: 19 },
  { code: 'CABLE-CALIBRE-10', name: 'Cable calibre 10 50m', cost: 125000, price: 185000, tax: 19 },
  { code: 'BREAKER-1P-15', name: 'Breaker 1P 15A', cost: 12000, price: 19500, tax: 19 },
  { code: 'BOMBILLO-AHORR-23', name: 'Bombillo ahorrador 23W', cost: 6500, price: 9800, tax: 19 },
  { code: 'CANALETA-4X2', name: 'Canaleta 4x2" 2m', cost: 7200, price: 11500, tax: 19 },
];

const NOMBRES_CLIENTES = [
  'Construcciones El Roble S.A.S.', 'Electricidad del Valle', 'Hogar y Construcción Ltda.',
  'Instalaciones García', 'Obra Negra S.A.S.', 'Proyectos Eléctricos Andinos',
  'Carlos Andrés Rodríguez', 'María Fernanda López', 'Juan Pablo Martínez',
  'Ana María Gómez', 'Luis Eduardo Pérez', 'Construcciones Norte',
  'Distribuidora Eléctrica Central', 'Cooperativa de Electricistas',
  'Edificaciones del Sur', 'Contratista Eléctrico Gómez', 'Almacén El Cable',
  'Ferretotal S.A.S.', 'Inversiones Eléctricas', 'Constructora La Esperanza',
];

const NOMBRES_PROVEEDORES = [
  'Distribuidora Eléctrica Andina S.A.S.', 'Cables Colombia', 'Iluminación y Más Ltda.',
  'Proveedor Nacional de Conductores', 'Breakers y Protección S.A.S.',
  'Suministros Eléctricos del Valle', 'Importadora Eléctrica', 'Ferretería Industrial',
];

const CIUDADES_COL = [
  { code: '11001', name: 'Bogotá D.C.' }, { code: '05001', name: 'Medellín' },
  { code: '76001', name: 'Cali' }, { code: '08001', name: 'Barranquilla' },
  { code: '54001', name: 'Cúcuta' }, { code: '66001', name: 'Pereira' },
  { code: '17001', name: 'Manizales' }, { code: '73001', name: 'Ibagué' },
];

const GASTOS_CATEGORIAS = [
  'Arriendo local', 'Servicios públicos', 'Transporte', 'Suministros oficina',
  'Mantenimiento', 'Seguridad', 'Publicidad', 'Otros',
];

async function main() {
  loadEnv();
  const opts = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public';
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

  console.log('=== Seed 500 datos reales (Comercial Eléctrica) ===');
  const start = Date.now();

  // --- Plan + Tenant ---
  let plan = await prisma.plan.findFirst({ where: { slug: 'all' } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: { name: 'Todo incluido', slug: 'all', description: 'Todos los módulos', isActive: true },
    });
    for (const code of MODULE_CODES) {
      await prisma.planFeature.create({ data: { planId: plan.id, moduleCode: code } });
    }
    console.log('[OK] Plan "Todo incluido" creado');
  }

  let tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Negocio principal', slug: 'default', planId: plan.id, isActive: true },
    });
    for (const code of MODULE_CODES) {
      await prisma.tenantModule.create({
        data: { tenantId: tenant.id, moduleCode: code, enabled: true },
      });
    }
    console.log('[OK] Tenant por defecto creado');
  } else {
    if (!tenant.planId) {
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { planId: plan.id },
      });
      console.log('[OK] Tenant por defecto actualizado con planId');
    }
    const existingModules = await prisma.tenantModule.findMany({
      where: { tenantId: tenant.id },
      select: { moduleCode: true },
    });
    const existingSet = new Set(existingModules.map((m) => m.moduleCode));
    for (const code of MODULE_CODES) {
      if (!existingSet.has(code)) {
        await prisma.tenantModule.create({
          data: { tenantId: tenant.id, moduleCode: code, enabled: true },
        });
      }
    }
    console.log('[OK] Módulos del tenant asegurados (advanced_reports, etc.)');
  }
  const tenantId = tenant.id;

  if (opts.fixTenantOnly) {
    console.log('=== Solo corrección de tenant/plan/módulos (sin tocar datos de negocio) ===');
    await prisma.$disconnect();
    return;
  }

  if (opts.clean) {
    console.log('\n[0] Limpiando datos de negocio...');
    await prisma.auditLog.deleteMany();
    await prisma.supplierPayment.deleteMany();
    await prisma.supplierInvoice.deleteMany({ where: { tenantId } });
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany({ where: { tenantId } });
    await prisma.supplier.deleteMany({ where: { tenantId } });
    await prisma.quoteItem.deleteMany();
    await prisma.quote.deleteMany({ where: { tenantId } });
    await prisma.saleReturnItem.deleteMany();
    await prisma.saleReturn.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.cashMovement.deleteMany();
    await prisma.expense.deleteMany({ where: { tenantId } });
    await prisma.dianEvent.deleteMany();
    await prisma.dianDocument.deleteMany();
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.sale.deleteMany({ where: { tenantId } });
    await prisma.cashSession.deleteMany({ where: { tenantId } });
    await prisma.inventoryMovementItem.deleteMany();
    await prisma.inventoryMovement.deleteMany({ where: { tenantId } });
    await prisma.stockBalance.deleteMany();
    await prisma.backupRun.deleteMany({ where: { tenantId } });
    await prisma.productDictionaryEntry.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.category.deleteMany({ where: { tenantId } });
    await prisma.customer.deleteMany({ where: { tenantId } });
    console.log('[OK] Limpieza completa');
  }

  // --- Usuarios ---
  const adminEmail = 'admin@example.com';
  const adminPass = 'Admin123!';
  const userEmail = 'vendedor@example.com';
  const userPass = 'User123!';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await argon2.hash(adminPass),
        role: 'ADMIN',
        tenantId,
        isActive: true,
      },
    });
    console.log('[OK] ADMIN:', adminEmail, '/', adminPass);
  } else if (!admin.tenantId) {
    await prisma.user.update({ where: { id: admin.id }, data: { tenantId } });
  }
  let vendedor = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!vendedor) {
    vendedor = await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash: await argon2.hash(userPass),
        role: 'USER',
        tenantId,
        isActive: true,
      },
    });
    console.log('[OK] USER:', userEmail, '/', userPass);
  } else if (!vendedor.tenantId) {
    await prisma.user.update({ where: { id: vendedor.id }, data: { tenantId } });
  }
  const adminId = admin.id;

  // --- Categorías (reales) ---
  console.log('\n[1] Categorías (' + CATEGORIAS_REALES.length + ')...');
  const categories = [];
  for (let i = 0; i < CATEGORIAS_REALES.length; i++) {
    const c = await prisma.category.upsert({
      where: { tenantId_name: { tenantId, name: CATEGORIAS_REALES[i] } },
      create: { tenantId, name: CATEGORIAS_REALES[i] },
      update: {},
    });
    categories.push(c);
  }
  console.log('  Total categorías:', categories.length);

  // --- Productos (reales, variando categoría) ---
  console.log('\n[2] Productos (' + PRODUCTOS_REALES.length * 3 + ')...');
  const products = [];
  for (let i = 0; i < PRODUCTOS_REALES.length * 3; i++) {
    const base = pick(PRODUCTOS_REALES, i);
    const code = base.code + '-' + (i + 1);
    const cat = pick(categories, i);
    const p = await prisma.product.create({
      data: {
        tenantId,
        internalCode: code,
        name: base.name + (i >= PRODUCTOS_REALES.length ? ' (var ' + (i % 5 + 1) + ')' : ''),
        categoryId: cat.id,
        cost: money(base.cost * (0.9 + (i % 20) / 100)),
        price: money(base.price * (0.95 + (i % 15) / 100)),
        taxRate: money(base.tax),
        isActive: true,
      },
    });
    products.push(p);
  }
  console.log('  Total productos:', products.length);

  // --- StockBalance ---
  console.log('\n[3] StockBalance...');
  for (const p of products) {
    await prisma.stockBalance.upsert({
      where: { productId: p.id },
      create: { productId: p.id, qtyOnHand: 20 + (products.indexOf(p) % 200), qtyReserved: 0 },
      update: { qtyOnHand: 20 + (products.indexOf(p) % 200) },
    });
  }
  console.log('  Total:', products.length);

  // --- Clientes (reales, mix CC/NIT) ---
  const numClientes = 80;
  console.log('\n[4] Clientes (' + numClientes + ')...');
  const customers = [];
  for (let i = 0; i < numClientes; i++) {
    const esNit = i % 3 === 0;
    const docType = esNit ? 'NIT' : (i % 2 === 0 ? 'CC' : 'CE');
    const docNumber = esNit ? '9' + String(80000000 + i).padStart(8, '0') : String(1000000000 + i);
    const nombre = pick(NOMBRES_CLIENTES, i) + (i > NOMBRES_CLIENTES.length - 1 ? ' ' + (i + 1) : '');
    const ciudad = pick(CIUDADES_COL, i);
    const c = await prisma.customer.create({
      data: {
        tenantId,
        docType,
        docNumber,
        name: nombre,
        email: 'cliente' + (i + 1) + '@ejemplo.com',
        phone: '300' + String(1000000 + i).slice(-7),
        address: 'Calle ' + (i % 80 + 1) + ' #' + (i % 40 + 1),
        cityCode: ciudad.code,
      },
    });
    customers.push(c);
  }
  console.log('  Total clientes:', customers.length);

  // --- Proveedores ---
  const numProveedores = 50;
  console.log('\n[5] Proveedores (' + numProveedores + ')...');
  const suppliers = [];
  for (let i = 0; i < numProveedores; i++) {
    const nombre = pick(NOMBRES_PROVEEDORES, i) + (i >= NOMBRES_PROVEEDORES ? ' ' + (i + 1) : '');
    const s = await prisma.supplier.create({
      data: {
        tenantId,
        nit: '9' + String(90000000 + i).padStart(8, '0'),
        name: nombre,
        email: 'proveedor' + (i + 1) + '@ejemplo.com',
        phone: '601' + String(1000000 + i).slice(-7),
        address: 'Carrera ' + (i % 50 + 10) + ' #' + (i % 30 + 1),
        cityCode: pick(CIUDADES_COL, i).code,
        contactPerson: 'Contacto ' + (i + 1),
        isActive: true,
      },
    });
    suppliers.push(s);
  }
  console.log('  Total proveedores:', suppliers.length);

  // --- Sesiones de caja (30, última abierta) ---
  const numSesiones = 30;
  console.log('\n[6] Sesiones de caja (' + numSesiones + ')...');
  const sessions = [];
  for (let i = 0; i < numSesiones; i++) {
    const openedAt = new Date(Date.now() - (numSesiones - i) * 24 * 3600000);
    const isLast = i === numSesiones - 1;
    const s = await prisma.cashSession.create({
      data: {
        tenantId,
        openedAt,
        openedBy: adminId,
        openingAmount: money(50000 + (i % 10) * 100000),
        closingAmount: isLast ? money(0) : money(80000 + (i % 10) * 120000),
        closedAt: isLast ? null : new Date(openedAt.getTime() + 8 * 3600000),
      },
    });
    sessions.push(s);
  }
  const openSession = sessions.find((s) => !s.closedAt) || sessions[0];
  console.log('  Total sesiones:', sessions.length);

  // --- Gastos (40) ---
  const numGastos = 40;
  console.log('\n[7] Gastos (' + numGastos + ')...');
  for (let i = 0; i < numGastos; i++) {
    const session = i % 3 === 0 ? null : pick(sessions, i);
    await prisma.expense.create({
      data: {
        tenantId,
        amount: money(50000 + (i % 50) * 10000),
        description: pick(GASTOS_CATEGORIAS, i) + ' - ' + (i + 1),
        category: pick(GASTOS_CATEGORIAS, i),
        paymentMethod: pick(['CASH', 'TRANSFER', 'CARD'], i),
        cashSessionId: session?.id ?? null,
        createdBy: adminId,
      },
    });
  }
  console.log('  Total gastos:', numGastos);

  // --- Pedidos de compra (30 con 1-2 ítems) ---
  const numPO = 30;
  console.log('\n[8] Pedidos de compra (' + numPO + ')...');
  const purchaseOrders = [];
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  for (let i = 0; i < numPO; i++) {
    const supplier = pick(suppliers, i);
    const itemCount = 1 + (i % 2);
    const chosen = [];
    for (let k = 0; k < itemCount; k++) chosen.push(pick(products, i + k * 10));
    let subtotal = 0, taxTotal = 0;
    const poItems = chosen.map((p) => {
      const qty = 5 + (i % 15);
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
        receivedQty: i % 2 === 0 ? qty : 0,
      };
    });
    const grandTotal = subtotal + taxTotal;
    const statuses = ['DRAFT', 'SENT', 'RECEIVED', 'COMPLETED', 'CANCELLED'];
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: supplier.id,
        orderNumber: 'OC-' + year + month + '-' + String(i + 1).padStart(4, '0'),
        status: pick(statuses, i),
        orderDate: new Date(Date.now() - (numPO - i) * 86400000),
        expectedDate: new Date(Date.now() + 7 * 86400000),
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
        createdBy: adminId,
        items: { create: poItems },
      },
    });
    purchaseOrders.push(po);
  }
  console.log('  Total pedidos:', purchaseOrders.length);

  // --- Facturas de proveedor (35) ---
  const numFacturasProv = 35;
  console.log('\n[9] Facturas de proveedor (' + numFacturasProv + ')...');
  for (let i = 0; i < numFacturasProv; i++) {
    const supplier = pick(suppliers, i);
    const invDate = new Date(Date.now() - (numFacturasProv - i) * 86400000);
    const dueDate = new Date(invDate.getTime() + 30 * 86400000);
    const grandTotal = 500000 + (i % 20) * 250000;
    const subtotal = Math.round(grandTotal / 1.19);
    const taxTotal = grandTotal - subtotal;
    await prisma.supplierInvoice.create({
      data: {
        tenantId,
        supplierId: supplier.id,
        purchaseOrderId: i % 2 === 0 && purchaseOrders[i % purchaseOrders.length] ? purchaseOrders[i % purchaseOrders.length].id : null,
        invoiceNumber: 'FV-' + year + '-' + String(i + 1).padStart(5, '0'),
        invoiceDate: invDate,
        dueDate,
        status: pick(['PENDING', 'PARTIALLY_PAID', 'PAID'], i),
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
        paidAmount: money(i % 3 === 1 ? grandTotal : i % 3 === 2 ? grandTotal / 2 : 0),
      },
    });
  }
  console.log('  Total facturas proveedor:', numFacturasProv);

  // --- Movimientos de inventario (50) ---
  const numMov = 50;
  console.log('\n[10] Movimientos de inventario (' + numMov + ')...');
  const movTypes = ['IN', 'OUT', 'ADJUST'];
  for (let i = 0; i < numMov; i++) {
    const type = pick(movTypes, i);
    const product = pick(products, i);
    const qty = type === 'OUT' ? 1 + (i % 10) : 10 + (i % 40);
    await prisma.inventoryMovement.create({
      data: {
        tenantId,
        type,
        reason: type === 'IN' ? 'Compra' : type === 'OUT' ? 'Venta' : 'Ajuste inventario',
        supplierId: type === 'IN' ? pick(suppliers, i).id : null,
        createdBy: adminId,
        items: {
          create: [{ productId: product.id, qty, unitCost: product.cost }],
        },
      },
    });
  }
  console.log('  Total movimientos:', numMov);

  // --- Ventas (60 con 1-3 ítems, factura, movimiento caja) ---
  const numVentas = 60;
  console.log('\n[11] Ventas (' + numVentas + ')...');
  const paymentMethods = ['CASH', 'CARD', 'TRANSFER'];
  for (let i = 0; i < numVentas; i++) {
    const customer = pick(customers, i);
    const session = pick(sessions, i);
    const itemCount = 1 + (i % 3);
    const chosen = [];
    for (let k = 0; k < itemCount; k++) chosen.push(pick(products, i + k * 15));
    let subtotal = 0, taxTotal = 0;
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
    const soldAt = new Date(Date.now() - (numVentas - i) * 86400000);
    const sale = await prisma.sale.create({
      data: {
        tenantId,
        customerId: customer.id,
        createdByUserId: adminId,
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
    const invNum = 'FE-' + year + '-' + String(i + 1).padStart(5, '0');
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
        method: pick(paymentMethods, i),
        amount: money(grandTotal),
        reference: invNum,
        relatedSaleId: sale.id,
      },
    });
  }
  console.log('  Total ventas:', numVentas);

  // --- Cotizaciones (50 con 1-3 ítems) ---
  const numCotiz = 50;
  console.log('\n[12] Cotizaciones (' + numCotiz + ')...');
  const quoteStatuses = ['DRAFT', 'SENT', 'EXPIRED', 'CONVERTED', 'CANCELLED'];
  for (let i = 0; i < numCotiz; i++) {
    const customer = pick(customers, i);
    const itemCount = 1 + (i % 3);
    const chosen = [];
    for (let k = 0; k < itemCount; k++) chosen.push(pick(products, i + k * 12));
    let subtotal = 0, taxTotal = 0;
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
    const createdAt = new Date(Date.now() - (numCotiz - i) * 86400000);
    const validUntil = new Date(createdAt.getTime() + (10 + (i % 20)) * 86400000);
    await prisma.quote.create({
      data: {
        tenantId,
        customerId: customer.id,
        status: pick(quoteStatuses, i),
        validUntil,
        subtotal: money(subtotal),
        taxTotal: money(taxTotal),
        discountTotal: money(0),
        grandTotal: money(grandTotal),
        items: { create: quoteItems },
      },
    });
  }
  console.log('  Total cotizaciones:', numCotiz);

  const totalRegistros =
    categories.length + products.length + products.length + customers.length + suppliers.length +
    numSesiones + numGastos + purchaseOrders.length + numFacturasProv + numMov + numVentas + numCotiz;
  const elapsedMs = Date.now() - start;
  console.log('\n=== Seed 500 datos reales completado ===');
  console.log('Tiempo:', (elapsedMs / 1000).toFixed(1), 's');
  console.log('\nResumen (registros principales):');
  console.log('  Categorías:      ', categories.length);
  console.log('  Productos:       ', products.length);
  console.log('  Clientes:        ', customers.length);
  console.log('  Proveedores:     ', suppliers.length);
  console.log('  Sesiones caja:   ', sessions.length);
  console.log('  Gastos:          ', numGastos);
  console.log('  Pedidos compra:  ', purchaseOrders.length);
  console.log('  Facturas prov.:  ', numFacturasProv);
  console.log('  Mov. inventario: ', numMov);
  console.log('  Ventas:          ', numVentas);
  console.log('  Cotizaciones:    ', numCotiz);
  console.log('  Total aprox.     ', totalRegistros + ' (sin contar ítems/detalles)');
  console.log('\nCredenciales:');
  console.log('  ADMIN:', adminEmail, '/', adminPass);
  console.log('  USER:', userEmail, '/', userPass);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[ERROR]', e);
  process.exit(1);
});
