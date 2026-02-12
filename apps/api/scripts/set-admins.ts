/**
 * Setea/crea administradores de plataforma y de tenant en una sola corrida.
 *
 * Útil cuando:
 * - Tu usuario "proveedor/plataforma" terminó con tenantId asignado y por eso entra a /app
 * - Necesitas crear (o resetear) un admin para el tenant por defecto
 *
 * Uso:
 *   Desde la raíz del monorepo:  npm run set-admins -w api
 *   Desde apps/api:             npm run set-admins   o   npx ts-node scripts/set-admins.ts
 *
 * Variables (las que no pongas se leen del .env o usan valor por defecto):
 *   DATABASE_URL     → se carga del .env del proyecto si no está definida
 *   PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD  → admin de plataforma (Panel proveedor)
 *   TENANT_SLUG      → "default" si no se define
 *   TENANT_ADMIN_EMAIL / TENANT_ADMIN_PASSWORD     → admin del tenant
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Cargar .env: desde raíz del repo (cwd/.env) o desde apps/api (cwd/../../.env)
const cwd = process.cwd();
const envRoot = path.resolve(cwd, '.env');
const envFromApi = path.resolve(cwd, '../../.env');
const envPath = fs.existsSync(envRoot) ? envRoot : envFromApi;
dotenv.config({ path: envPath, override: true });

import { PrismaClient, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function mustEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Falta variable ${name}`);
  return v;
}

async function ensureAdminRoleId(): Promise<string> {
  const adminRole = await prisma.role.findFirst({
    where: { slug: 'admin', tenantId: null },
    select: { id: true },
  });
  if (!adminRole) {
    throw new Error(
      'No existe rol admin (slug=admin, tenantId=null). Ejecuta primero: npm run prisma:seed -w api',
    );
  }
  return adminRole.id;
}

async function upsertUserRole(params: {
  userId: string;
  roleId: string;
  tenantId: string | null;
}) {
  const existing = await prisma.userRole.findFirst({
    where: { userId: params.userId, roleId: params.roleId, tenantId: params.tenantId },
    select: { id: true },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId: params.userId, roleId: params.roleId, tenantId: params.tenantId },
    });
  }
}

async function main() {
  // Validar que Prisma tenga conexión
  mustEnv('DATABASE_URL');

  const adminRoleId = await ensureAdminRoleId();

  // --- 1) Admin de plataforma (Panel proveedor) ---
  const platformEmail = mustEnv('PLATFORM_ADMIN_EMAIL');
  const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD?.trim(); // opcional: si viene, se resetea

  const platformPasswordHash = platformPassword ? await argon2.hash(platformPassword) : undefined;

  const platformUser = await prisma.user.upsert({
    where: { email: platformEmail },
    create: {
      email: platformEmail,
      passwordHash: platformPasswordHash ?? (await argon2.hash('PlatformAdmin1!')),
      role: RoleName.ADMIN,
      tenantId: null,
      name: 'Platform Admin',
    },
    update: {
      role: RoleName.ADMIN,
      tenantId: null,
      ...(platformPasswordHash ? { passwordHash: platformPasswordHash } : {}),
    },
    select: { id: true, email: true, tenantId: true },
  });
  await upsertUserRole({ userId: platformUser.id, roleId: adminRoleId, tenantId: null });
  console.log('✅ Admin de plataforma listo:', platformUser.email, '| tenantId:', platformUser.tenantId);

  // --- 2) Admin de tenant (operación del negocio) ---
  const tenantSlug = (process.env.TENANT_SLUG ?? 'default').trim() || 'default';
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug }, select: { id: true, slug: true } });
  if (!tenant) {
    throw new Error(`No existe tenant con slug "${tenantSlug}". Ejecuta primero: npm run prisma:seed -w api`);
  }

  const tenantAdminEmail = mustEnv('TENANT_ADMIN_EMAIL');
  const tenantAdminPassword = mustEnv('TENANT_ADMIN_PASSWORD');
  const tenantAdminPasswordHash = await argon2.hash(tenantAdminPassword);

  const tenantAdmin = await prisma.user.upsert({
    where: { email: tenantAdminEmail },
    create: {
      email: tenantAdminEmail,
      passwordHash: tenantAdminPasswordHash,
      role: RoleName.ADMIN,
      tenantId: tenant.id,
      name: 'Tenant Admin',
    },
    update: {
      role: RoleName.ADMIN,
      tenantId: tenant.id,
      passwordHash: tenantAdminPasswordHash,
    },
    select: { id: true, email: true, tenantId: true },
  });
  await upsertUserRole({ userId: tenantAdmin.id, roleId: adminRoleId, tenantId: tenant.id });
  console.log('✅ Admin de tenant listo:', tenantAdmin.email, '| tenant:', tenant.slug);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

