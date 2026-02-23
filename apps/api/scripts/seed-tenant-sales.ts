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
import { PrismaClient, SaleStatus } from '@prisma/client';

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
    console.log('No hay productos para este tenant. Creando productos de prueba…');
    const created = [];
    for (let i = 1; i <= 10; i++) {
      const cost = 5000 + i * 100;
      const price = cost * 1.3;
      const p = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          internalCode: `P-${i.toString().padStart(3, '0')}`,
          name: `Producto ${i}`,
          cost,
          price,
          taxRate: 0,
          isActive: true,
        },
      });
      created.push(p);
    }
    products = created;
  }

  const now = new Date();

  for (let i = 0; i < salesCount; i++) {
    const daysBack = randomInt(0, 60);
    const soldAt = new Date(now);
    soldAt.setDate(soldAt.getDate() - daysBack);

    const product = products[randomInt(0, products.length - 1)];
    const qty = randomInt(1, 5);
    const unitPrice = Number(product.price ?? product.cost ?? 10_000);
    const subtotal = unitPrice * qty;

    await prisma.sale.create({
      data: {
        tenantId: tenant.id,
        customerId: null,
        createdByUserId: user.id,
        status: SaleStatus.PAID,
        requireElectronicInvoice: false,
        soldAt,
        subtotal,
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: subtotal,
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

    if ((i + 1) % 50 === 0) {
      console.log(`  → ${i + 1} ventas creadas…`);
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

