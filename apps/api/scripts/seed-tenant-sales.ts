/**
 * Seed de ventas para un tenant concreto (por defecto slug "prueba").
 *
 * Uso:
 *  1. Asegúrate de tener la base levantada y .env configurado (DATABASE_URL, etc.).
 *  2. Opcional: en el .env define:
 *       SEED_TENANT_SLUG=prueba
 *       SEED_SALES_COUNT=400
 *     Si no las defines, usa slug "prueba" y 400 ventas.
 *  3. Desde la raíz del repo:
 *       npm run db:up        # si aún no tienes la base corriendo
 *       npm run dev:api      # opcional, no es necesario para el seed
 *       npm run seed-tenant-sales -w api
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import {
  PrismaClient,
  SaleStatus,
  CustomerDocType,
  InventoryMovementType,
  PaymentMethod,
  QuoteStatus,
  InvoiceStatus,
  CashMovementType,
  SupplierInvoiceStatus,
  FeedbackStatus,
} from '@prisma/client';

// Cargar .env desde la raíz del repo (igual que otros scripts)
const candidates = [
  path.join(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envPath of candidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const prisma = new PrismaClient();

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const tenantSlug = process.env.SEED_TENANT_SLUG?.trim() || 'prueba';
  const salesCount = Number(process.env.SEED_SALES_COUNT ?? '400');

  console.log(`Seed de ventas para tenant slug="${tenantSlug}" (${salesCount} ventas)…`);

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug },
    select: { id: true, name: true },
  });

  if (!tenant) {
    console.error('No se encontró ningún tenant con slug:', tenantSlug);
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error('El tenant no tiene usuarios. Crea al menos un usuario antes de correr el seed.');
    process.exit(1);
  }

  let products = await prisma.product.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true, cost: true, price: true },
    take: 20,
  });

  if (products.length === 0) {
    console.log('No hay productos para este tenant. Creando productos eléctricos de prueba…');
    const seedProducts = [
      {
        internalCode: 'CABL-THHN-12R',
        name: 'Cable THHN 12 AWG rojo por metro',
        cost: 2500,
        price: 3900,
      },
      {
        internalCode: 'CABL-THHN-12N',
        name: 'Cable THHN 12 AWG negro por metro',
        cost: 2500,
        price: 3900,
      },
      {
        internalCode: 'CABL-THHN-10R',
        name: 'Cable THHN 10 AWG rojo por metro',
        cost: 3400,
        price: 5200,
      },
      {
        internalCode: 'FOCU-LED-9W',
        name: 'Bombillo LED 9W luz blanca E27',
        cost: 4200,
        price: 7800,
      },
      {
        internalCode: 'FOCU-LED-15W',
        name: 'Bombillo LED 15W luz cálida E27',
        cost: 5800,
        price: 10900,
      },
      {
        internalCode: 'TOMA-DOBLE-15A',
        name: 'Toma doble 110V 15A blanco',
        cost: 3200,
        price: 6900,
      },
      {
        internalCode: 'INTE-SENCILLO',
        name: 'Interruptor sencillo 110V blanco',
        cost: 2800,
        price: 5900,
      },
      {
        internalCode: 'INTE-DOBLE',
        name: 'Interruptor doble 110V blanco',
        cost: 3600,
        price: 7900,
      },
      {
        internalCode: 'REFL-LED-50W',
        name: 'Reflector LED 50W exterior IP65',
        cost: 32000,
        price: 58900,
      },
      {
        internalCode: 'TABL-12CIR',
        name: 'Tablero de distribución 12 circuitos empotrable',
        cost: 48000,
        price: 89900,
      },
      {
        internalCode: 'BREA-40A2P',
        name: 'Breaker termomagnético 40A 2 polos',
        cost: 21000,
        price: 38900,
      },
      {
        internalCode: 'CANAL-4040',
        name: 'Canaleta plástica 40x40 mm 2 m',
        cost: 8500,
        price: 15900,
      },
    ];

    const created: typeof products = [];
    for (const p of seedProducts) {
      const createdProduct = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          internalCode: p.internalCode,
          name: p.name,
          cost: p.cost,
          price: p.price,
          taxRate: 0,
          minStock: 5,
          isActive: true,
        },
      });
      created.push(createdProduct);
    }
    products = created;
  }

  // Clientes
  const existingCustomers = await prisma.customer.count({
    where: { tenantId: tenant.id },
  });
  if (existingCustomers === 0) {
    console.log('Creando clientes de prueba…');
    const firstNames = [
      'Carlos',
      'María',
      'Andrés',
      'Lucía',
      'Julián',
      'Paola',
      'Santiago',
      'Diana',
      'Felipe',
      'Laura',
      'Camilo',
      'Valentina',
    ];
    const lastNames = [
      'Gómez',
      'Rodríguez',
      'Pérez',
      'Martínez',
      'López',
      'García',
      'Hernández',
      'Ramírez',
      'Torres',
      'Castro',
      'Moreno',
      'Rojas',
    ];
    const cities = [
      { code: '11001', name: 'Bogotá' },
      { code: '05001', name: 'Medellín' },
      { code: '76001', name: 'Cali' },
      { code: '13001', name: 'Cartagena' },
      { code: '68001', name: 'Bucaramanga' },
    ];

    for (let i = 1; i <= 40; i++) {
      const fn = firstNames[randomInt(0, firstNames.length - 1)];
      const ln = lastNames[randomInt(0, lastNames.length - 1)];
      const city = cities[randomInt(0, cities.length - 1)];
      const docNumber = `10${randomInt(10000000, 99999999)}`;
      const phone = `3${randomInt(100000000, 999999999)}`;

      await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          docType: CustomerDocType.CC,
          docNumber,
          name: `${fn} ${ln}`,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}+${i}@cliente.demo`,
          phone,
          address: `Calle ${randomInt(1, 120)} # ${randomInt(1, 50)}-${randomInt(1, 30)} ${city.name}`,
          cityCode: city.code,
        },
      });
    }
  }

  // Proveedores
  const existingSuppliers = await prisma.supplier.count({
    where: { tenantId: tenant.id },
  });
  if (existingSuppliers === 0) {
    console.log('Creando proveedores de prueba…');
    const supplierNames = [
      'Electro Andina SAS',
      'Distribuciones Eléctricas del Centro',
      'Iluminación Colombia LTDA',
      'Cableados Industriales S.A.',
      'Comercializadora de Insumos Eléctricos',
      'Soluciones en Energía y Luz',
      'Mayorista de Iluminación LED',
      'Conexiones y Tendido Eléctrico',
      'Redes y Tableros del Norte',
      'Ferretería Eléctrica Nacional',
    ];

    for (let i = 0; i < supplierNames.length; i++) {
      const name = supplierNames[i];
      await prisma.supplier.create({
        data: {
          tenantId: tenant.id,
          nit: `900${randomInt(1000000, 9999999)}`,
          name,
          description: 'Proveedor especializado en materiales eléctricos e iluminación.',
          email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@proveedor.demo`,
          phone: `60${randomInt(10000000, 99999999)}`,
          address: `Zona industrial ${randomInt(1, 30)}, bodega ${randomInt(1, 20)}`,
          cityCode: '11001',
          contactPerson: `Contacto ${randomInt(1, 99)}`,
        },
      });
    }
  }

  // Stock inicial e histórico de inventario
  console.log('Creando stock inicial e historial de inventario…');
  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
    take: 3,
  });
  for (const product of products) {
    const baseQty = randomInt(20, 120);
    // Movimiento de entrada
    const movement = await prisma.inventoryMovement.create({
      data: {
        tenantId: tenant.id,
        type: InventoryMovementType.IN,
        reason: 'Stock inicial seed',
        supplierId: suppliers[0]?.id ?? null,
        createdBy: user.id,
        items: {
          create: [
            {
              productId: product.id,
              qty: baseQty,
              unitCost: product.cost,
            },
          ],
        },
      },
    });
    // Balance de stock (upsert por si ya existía)
    await prisma.stockBalance.upsert({
      where: { productId: product.id },
      create: {
        productId: product.id,
        qtyOnHand: baseQty,
        qtyReserved: 0,
      },
      update: {
        qtyOnHand: baseQty,
      },
    });
  }

  // Gastos
  const existingExpenses = await prisma.expense.count({
    where: { tenantId: tenant.id },
  });
  if (existingExpenses === 0) {
    console.log('Creando gastos de prueba…');
    const categories = ['Compras', 'Servicios', 'Arrendamiento', 'Papelería', 'Transporte'];
    const now = new Date();
    for (let i = 1; i <= 60; i++) {
      const daysBack = randomInt(0, 60);
      const expenseDate = new Date(now);
      expenseDate.setDate(expenseDate.getDate() - daysBack);
      const amount = randomInt(50_000, 800_000);
      await prisma.expense.create({
        data: {
          tenantId: tenant.id,
          amount,
          description: `Gasto ${i} seed`,
          category: categories[randomInt(0, categories.length - 1)],
          expenseDate,
          paymentMethod: [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER][
            randomInt(0, 2)
          ],
          cashSessionId: null,
          reference: null,
        },
      });
    }
  }

  // Sesiones de caja y movimientos
  const existingCashSessions = await prisma.cashSession.count({
    where: { tenantId: tenant.id },
  });
  if (existingCashSessions === 0) {
    console.log('Creando sesiones de caja y movimientos…');
    for (let i = 0; i < 3; i++) {
      const openedAt = new Date();
      openedAt.setDate(openedAt.getDate() - (3 - i));
      const openingAmount = randomInt(200_000, 800_000);
      const cashSession = await prisma.cashSession.create({
        data: {
          tenantId: tenant.id,
          openedAt,
          closedAt: new Date(openedAt.getTime() + 8 * 60 * 60 * 1000),
          openingAmount,
          closingAmount: openingAmount,
        },
      });
      // Algunos movimientos de caja por sesión
      const movementsPerSession = randomInt(5, 15);
      for (let m = 0; m < movementsPerSession; m++) {
        const amount = randomInt(20_000, 200_000);
        const type = m % 3 === 0 ? CashMovementType.OUT : CashMovementType.IN;
        await prisma.cashMovement.create({
          data: {
            sessionId: cashSession.id,
            type,
            method: PaymentMethod.CASH,
            amount,
            reference: `Mov caja ${m + 1}`,
          },
        });
      }
    }
  }

  // Cotizaciones
  const existingQuotes = await prisma.quote.count({
    where: { tenantId: tenant.id },
  });
  if (existingQuotes === 0) {
    console.log('Creando cotizaciones de prueba…');
    const customers = await prisma.customer.findMany({
      where: { tenantId: tenant.id },
      select: { id: true },
      take: 20,
    });
    for (let i = 1; i <= 40; i++) {
      const customer = customers.length
        ? customers[randomInt(0, customers.length - 1)]
        : null;
      const product = products[randomInt(0, products.length - 1)];
      const qty = randomInt(1, 10);
      const unitPrice = Number(product.price ?? product.cost ?? 10_000);
      const subtotal = unitPrice * qty;
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - randomInt(0, 30));
      const validUntil = new Date(createdAt.getTime());
      validUntil.setDate(validUntil.getDate() + randomInt(7, 20));
      const statusCycle = i % 4;
      const status =
        statusCycle === 0
          ? QuoteStatus.DRAFT
          : statusCycle === 1
          ? QuoteStatus.SENT
          : statusCycle === 2
          ? QuoteStatus.EXPIRED
          : QuoteStatus.CONVERTED;

      await prisma.quote.create({
        data: {
          tenantId: tenant.id,
          customerId: customer?.id ?? null,
          status,
          validUntil,
          subtotal,
          taxTotal: 0,
          discountTotal: 0,
          grandTotal: subtotal,
          createdAt,
          items: {
            create: [
              {
                productId: product.id,
                qty,
                unitPrice,
                taxRate: 0,
                lineTotal: subtotal,
              },
            ],
          },
        },
      });
    }
  }

  // Facturas simples a partir de algunas ventas
  const existingInvoices = await prisma.invoice.count({
    where: { tenantId: tenant.id },
  });
  if (existingInvoices === 0) {
    console.log('Creando facturas de prueba…');
    const someSales = await prisma.sale.findMany({
      where: { tenantId: tenant.id, status: SaleStatus.PAID },
      select: { id: true, grandTotal: true },
      take: 50,
    });
    let counter = 1;
    for (const sale of someSales) {
      const number = `INV-${String(counter).padStart(5, '0')}`;
      await prisma.invoice.create({
        data: {
          tenantId: tenant.id,
          saleId: sale.id,
          customerId: null,
          number,
          status: InvoiceStatus.ISSUED,
          subtotal: sale.grandTotal,
          taxTotal: 0,
          discountTotal: 0,
          grandTotal: sale.grandTotal,
        },
      });
      counter++;
    }
  }

  // Facturas de proveedor (SupplierInvoice)
  const existingSupplierInvoices = await prisma.supplierInvoice.count({
    where: { tenantId: tenant.id },
  });
  if (existingSupplierInvoices === 0) {
    console.log('Creando facturas de proveedor de prueba…');
    const suppliersForInvoices = await prisma.supplier.findMany({
      where: { tenantId: tenant.id },
      select: { id: true },
      take: 5,
    });
    const today = new Date();
    for (let i = 1; i <= 20; i++) {
      const supplier =
        suppliersForInvoices[randomInt(0, suppliersForInvoices.length - 1)];
      const invoiceDate = new Date();
      invoiceDate.setDate(invoiceDate.getDate() - randomInt(0, 45));
      const dueDate = new Date(invoiceDate.getTime());
      dueDate.setDate(dueDate.getDate() + randomInt(10, 40));
      const subtotal = randomInt(100_000, 2_000_000);
      const paidAmount = randomInt(0, Number(subtotal));
      const isPastDue = dueDate < today;
      let status: SupplierInvoiceStatus = SupplierInvoiceStatus.PENDING;
      if (paidAmount === 0) {
        status = isPastDue ? SupplierInvoiceStatus.OVERDUE : SupplierInvoiceStatus.PENDING;
      } else if (paidAmount < subtotal) {
        status = isPastDue ? SupplierInvoiceStatus.OVERDUE : SupplierInvoiceStatus.PARTIALLY_PAID;
      } else {
        status = SupplierInvoiceStatus.PAID;
      }

      await prisma.supplierInvoice.create({
        data: {
          tenantId: tenant.id,
          supplierId: supplier.id,
          invoiceNumber: `FP-${String(i).padStart(5, '0')}`,
          invoiceDate,
          dueDate,
          status,
          subtotal,
          taxTotal: 0,
          discountTotal: 0,
          grandTotal: subtotal,
          paidAmount,
        },
      });
    }
  }

  // Devoluciones de algunas ventas
  const someSalesForReturns = await prisma.sale.findMany({
    where: { tenantId: tenant.id, status: SaleStatus.PAID },
    select: { id: true, grandTotal: true },
    take: 20,
  });
  for (const sale of someSalesForReturns) {
    const hasReturn = await prisma.saleReturn.count({
      where: { saleId: sale.id },
    });
    if (hasReturn > 0) continue;
    const returnedAt = new Date();
    returnedAt.setDate(returnedAt.getDate() - randomInt(0, 30));
    const partial = Math.random() < 0.6;
    const returnTotal = partial
      ? Number(sale.grandTotal) * 0.3
      : Number(sale.grandTotal);
    await prisma.saleReturn.create({
      data: {
        saleId: sale.id,
        returnedAt,
        reason: partial ? 'Devolución parcial (seed)' : 'Devolución total (seed)',
        subtotal: returnTotal,
        taxTotal: 0,
        grandTotal: returnTotal,
        items: {
          create: [
            {
              productId: products[0].id,
              qty: partial ? 1 : 2,
              unitPrice: returnTotal,
              lineTotal: returnTotal,
            },
          ],
        },
      },
    });
  }

  // Diccionario de productos (búsquedas frecuentes)
  const existingDictionaryEntries = await prisma.productDictionaryEntry.count({
    where: { tenantId: tenant.id },
  });
  if (existingDictionaryEntries === 0) {
    console.log('Creando entradas de diccionario de productos…');
    const sampleTerms = ['bombillo led', 'cable rojo 12', 'toma doble', 'interruptor sencillo', 'reflector'];
    for (const term of sampleTerms) {
      const product = products[randomInt(0, products.length - 1)];
      await prisma.productDictionaryEntry.create({
        data: {
          tenantId: tenant.id,
          term,
          productId: product.id,
        },
      });
    }
  }

  // Sugerencias y solicitudes DIAN (TenantFeedback)
  const existingFeedback = await prisma.tenantFeedback.count({
    where: { tenantId: tenant.id },
  });
  if (existingFeedback === 0) {
    console.log('Creando sugerencias y solicitudes DIAN de prueba…');
    const feedbackMessages: { message: string; status: FeedbackStatus }[] = [
      {
        message: 'Me gustaría poder filtrar las ventas por forma de pago.',
        status: FeedbackStatus.PENDING,
      },
      {
        message: 'El informe de inventario está muy útil, pero sería bueno poder exportarlo a Excel.',
        status: FeedbackStatus.READ,
      },
      {
        message: 'Sería bueno que el sistema recuerde el último cliente usado en el punto de venta.',
        status: FeedbackStatus.DONE,
      },
      {
        message: 'Solicitud de activación de facturación electrónica para mi empresa.',
        status: FeedbackStatus.PENDING,
      },
      {
        message: 'Por favor iniciar proceso de activación de factura electrónica en DIAN.',
        status: FeedbackStatus.PENDING,
      },
    ];

    for (const f of feedbackMessages) {
      await prisma.tenantFeedback.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          message: f.message,
          status: f.status,
        },
      });
    }
  }

  const now = new Date();
  const customersForSales = await prisma.customer.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
    take: 40,
  });

  for (let i = 0; i < salesCount; i++) {
    const daysBack = randomInt(0, 60);
    const soldAt = new Date(now);
    soldAt.setDate(soldAt.getDate() - daysBack);
    // Horario típico de comercio: entre 8:00 y 19:00
    soldAt.setHours(randomInt(8, 19), randomInt(0, 59), randomInt(0, 59), 0);

    // Menos ventas los domingos
    const isSunday = soldAt.getDay() === 0;
    if (isSunday && Math.random() < 0.5) {
      continue;
    }

    const itemsCount = randomInt(1, 3);
    const items: {
      productId: string;
      qty: number;
      unitPrice: number;
      taxRate: number;
      lineTotal: number;
    }[] = [];
    let subtotal = 0;

    for (let j = 0; j < itemsCount; j++) {
      const product = products[randomInt(0, products.length - 1)];
      const qty = randomInt(1, 8);
      const unitPrice = Number(product.price ?? product.cost ?? 10000);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      items.push({
        productId: product.id,
        qty,
        unitPrice,
        taxRate: 0,
        lineTotal,
      });
    }

    // Ticket promedio entre ~30k y ~500k aprox.
    if (subtotal < 30000) {
      subtotal = 30000;
      const factor = subtotal / items.reduce((acc, it) => acc + it.lineTotal, 0);
      for (const it of items) {
        it.lineTotal = Math.round(it.lineTotal * factor);
      }
    }

    const statusRoll = Math.random();
    let status: SaleStatus = SaleStatus.PAID;
    if (statusRoll < 0.1) {
      status = SaleStatus.DRAFT;
    } else if (statusRoll < 0.2) {
      status = SaleStatus.CANCELLED;
    }

    const customerId =
      customersForSales.length && Math.random() < 0.7
        ? customersForSales[randomInt(0, customersForSales.length - 1)].id
        : null;

    await prisma.sale.create({
      data: {
        tenantId: tenant.id,
        customerId,
        createdByUserId: user.id,
        status,
        requireElectronicInvoice: false,
        soldAt,
        subtotal,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: subtotal,
        items: {
          create: items,
        },
      },
    });

    if ((i + 1) % 50 === 0) {
      console.log(`  → ${i + 1} ventas procesadas (incluye borradores/canceladas)…`);
    }
  }

  console.log(`Seed completado: ${salesCount} ventas para el tenant "${tenant.name}" (${tenantSlug}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

