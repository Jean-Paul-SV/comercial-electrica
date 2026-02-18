/**
 * Seed: permisos, roles, plan "Todo incluido" y usuarios.
 * Ejecutar tras migración: npx prisma db seed
 *
 * Si defines PLATFORM_ADMIN_EMAIL y PLATFORM_ADMIN_PASSWORD en .env (mín. 8 caracteres):
 *   - Modo "todo vacío": solo se crea tu usuario (Panel proveedor). 0 empresas, sin datos de prueba.
 * Si no los defines:
 *   - Se crean usuario Panel proveedor (platform@proveedor.local) y admin de negocio (admin@negocio.local).
 * Ver docs/PASO_A_PASO_SEED_MI_CORREO.md
 */

import { PrismaClient, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Administrador de plataforma (dueño del sistema): Panel proveedor, gestión de tenants.
 * En producción define PLATFORM_ADMIN_EMAIL y PLATFORM_ADMIN_PASSWORD en el entorno
 * antes de ejecutar prisma:seed; así se crea tu usuario como dueño. Si no están definidas
 * o la contraseña tiene menos de 8 caracteres, se usa el usuario por defecto (solo desarrollo).
 */
const envPlatformEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim();
const envPlatformPassword = process.env.PLATFORM_ADMIN_PASSWORD?.trim();
const PLATFORM_ADMIN_EMAIL =
  envPlatformEmail && envPlatformPassword && envPlatformPassword.length >= 8
    ? envPlatformEmail
    : 'platform@proveedor.local';
const PLATFORM_ADMIN_PASSWORD =
  envPlatformEmail && envPlatformPassword && envPlatformPassword.length >= 8
    ? envPlatformPassword
    : 'PlatformProveedor1!';

/** Administrador del tenant por defecto (correos de prueba si no se definen en env). */
const TENANT_ADMIN_EMAIL = process.env.TENANT_ADMIN_EMAIL?.trim() || 'admin@negocio.local';
const TENANT_ADMIN_PASSWORD = process.env.TENANT_ADMIN_PASSWORD?.trim() || 'AdminNegocio1!';

/** Si true, solo se crea plan mínimo, permisos, roles y tu usuario (PLATFORM_ADMIN_EMAIL). Sin empresas ni usuarios de prueba.
 *  Se activa automáticamente cuando tienes PLATFORM_ADMIN_EMAIL y PLATFORM_ADMIN_PASSWORD en .env (todo vacío, solo tu acceso). */
const SEED_ONLY_PLATFORM_ADMIN =
  process.env.SEED_ONLY_PLATFORM_ADMIN === 'true' ||
  process.env.SEED_ONLY_PLATFORM_ADMIN === '1' ||
  (Boolean(envPlatformEmail && envPlatformPassword && envPlatformPassword.length >= 8));

/** Módulos del producto (alineado con ARQUITECTURA_MODULAR_SAAS). Plan "Todo incluido" los tiene todos. */
const MODULE_CODES = [
  'core',
  'inventory',
  'suppliers',
  'electronic_invoicing',
  'advanced_reports',
  'audit',
  'backups',
] as const;

const RESOURCES = [
  'sales', 'quotes', 'returns', 'cash', 'expenses', 'inventory', 'catalog',
  'customers', 'suppliers', 'purchases', 'supplier-invoices',
  'reports', 'audit', 'backups', 'dian', 'users', 'metrics',
] as const;

const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;

function buildPermissionSlugs(): { resource: string; action: string }[] {
  const out: { resource: string; action: string }[] = [];
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      out.push({ resource, action });
    }
  }
  return out;
}

async function main() {
  const slugList = buildPermissionSlugs();

  // 1. Plan "Todo incluido" (todos los módulos, con DIAN) — compatibilidad con tenant por defecto
  let plan = await prisma.plan.findFirst({ where: { slug: 'all' } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        name: 'Todo incluido',
        slug: 'all',
        description: 'Todos los módulos activos, incluye facturación electrónica DIAN.',
        maxUsers: 50,
        isActive: true,
      },
    });
    for (const code of MODULE_CODES) {
      await prisma.planFeature.create({
        data: { planId: plan.id, moduleCode: code },
      });
    }
    console.log('Plan "Todo incluido" creado con', MODULE_CODES.length, 'módulos (con DIAN)');
  }

  // 1.1 Planes de ejemplo: sin DIAN y con DIAN (se omiten si SEED_ONLY_PLATFORM_ADMIN=true)
  if (!SEED_ONLY_PLATFORM_ADMIN) {
  const examplePlans = [
    { slug: 'sin-dian', name: 'Plan sin DIAN', description: 'Ventas, inventario y clientes. Sin facturación electrónica DIAN.', priceMonthly: 79_000, priceYearly: 790_000, maxUsers: 5, moduleCodes: ['core', 'inventory'] as const },
    { slug: 'con-dian', name: 'Plan con DIAN', description: 'Incluye facturación electrónica DIAN, proveedores y reportes.', priceMonthly: 179_000, priceYearly: 1_790_000, maxUsers: 25, moduleCodes: ['core', 'inventory', 'suppliers', 'electronic_invoicing', 'advanced_reports'] as const },
    {
      slug: 'basico',
      name: 'Plan Básico (sin DIAN)',
      description: 'Ideal para empezar: ventas, inventario y clientes. Sin facturación electrónica.',
      priceMonthly: 99_000,
      priceYearly: 990_000,
      maxUsers: 5,
      moduleCodes: ['core', 'inventory'] as const,
    },
    {
      slug: 'premium',
      name: 'Plan Premium (con DIAN)',
      description: 'Incluye facturación electrónica DIAN, proveedores y reportes avanzados.',
      priceMonthly: 199_000,
      priceYearly: 1_990_000,
      maxUsers: 25,
      moduleCodes: ['core', 'inventory', 'suppliers', 'electronic_invoicing', 'advanced_reports'] as const,
    },
    {
      slug: 'empresarial',
      name: 'Plan Empresarial (con DIAN)',
      description: 'Todo: DIAN, auditoría, backups y soporte completo.',
      priceMonthly: 399_000,
      priceYearly: 3_990_000,
      maxUsers: 50,
      moduleCodes: [...MODULE_CODES],
    },
  ];
  for (const p of examplePlans) {
    let existing = await prisma.plan.findFirst({ where: { slug: p.slug } });
    if (!existing) {
      existing = await prisma.plan.create({
        data: {
          name: p.name,
          slug: p.slug,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          maxUsers: p.maxUsers,
          isActive: true,
        },
      });
      for (const code of p.moduleCodes) {
        await prisma.planFeature.create({
          data: { planId: existing.id, moduleCode: code },
        });
      }
      console.log('Plan ejemplo creado:', p.name, 'con', p.moduleCodes.length, 'módulos');
    } else if (existing.maxUsers == null) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: { maxUsers: p.maxUsers },
      });
      console.log('Plan ejemplo actualizado con maxUsers:', p.name, '->', p.maxUsers);
    }
  }
  }
  // Backfill maxUsers para plan "Todo incluido" si existe sin límite
  const allPlan = await prisma.plan.findFirst({ where: { slug: 'all' } });
  if (allPlan != null && allPlan.maxUsers == null) {
    await prisma.plan.update({
      where: { id: allPlan.id },
      data: { maxUsers: 50 },
    });
    console.log('Plan "Todo incluido" actualizado con maxUsers: 50');
  }

  // 2. Tenant por defecto (con plan "Todo incluido") — se omite si SEED_ONLY_PLATFORM_ADMIN=true
  let tenant: { id: string; planId: string | null } | null = null;
  if (!SEED_ONLY_PLATFORM_ADMIN) {
    tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: 'Negocio principal', slug: 'default', planId: plan.id, isActive: true },
      });
      console.log('Tenant por defecto creado:', tenant.id);
    } else {
      // Unificar nombre si la migración lo creó como "Default"; asegurar planId
      const update: { planId: string; name?: string } = { planId: plan.id };
      const current = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { name: true } });
      if (current?.name === 'Default') update.name = 'Negocio principal';
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: update,
      });
      if (update.name) console.log('Tenant por defecto renombrado a "Negocio principal"');
      else if (!tenant.planId) console.log('Tenant por defecto actualizado con planId:', plan.id);
    }

    // 2.1 Suscripción para tenants que no tengan (backfill para BD existentes)
    const tenantsWithoutSub = await prisma.tenant.findMany({
      where: { subscription: null },
      select: { id: true, planId: true },
    });
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);
    for (const t of tenantsWithoutSub) {
      await prisma.subscription.create({
        data: {
          tenantId: t.id,
          planId: t.planId,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      console.log('Subscription creada para tenant:', t.id);
    }
  }

  // 3. Permisos (upsert por resource+action)
  for (const { resource, action } of slugList) {
    await prisma.permission.upsert({
      where: { resource_action: { resource, action } },
      create: { resource, action, description: `${resource}:${action}` },
      update: {},
    });
  }
  await prisma.permission.upsert({
    where: { resource_action: { resource: 'dian', action: 'manage_certificate' } },
    create: { resource: 'dian', action: 'manage_certificate', description: 'dian:manage_certificate (subir certificado y editar resolución/rangos)' },
    update: {},
  });
  console.log('Permisos creados/actualizados:', slugList.length + 1);

  // 4. Roles de sistema (globales, tenantId null para que apliquen en cualquier tenant)
  const allPerms = await prisma.permission.findMany({ select: { id: true } });

  let adminRole = await prisma.role.findFirst({
    where: { slug: 'admin', tenantId: null },
  });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: 'Administrador',
        slug: 'admin',
        description: 'Todos los permisos',
        tenantId: null,
        isSystem: true,
      },
    });
    for (const p of allPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        create: { roleId: adminRole.id, permissionId: p.id },
        update: {},
      });
    }
    console.log('Rol admin creado con', allPerms.length, 'permisos');
  }

  const userPermSlugs = [
    'sales:read', 'sales:create', 'quotes:read', 'quotes:create', 'quotes:update',
    'returns:read', 'returns:create', 'cash:read', 'cash:create', 'cash:update',
    'expenses:read', 'expenses:create', 'catalog:read', 'customers:read', 'customers:create',
    'inventory:read', 'reports:read',
  ];
  const userPermIds = await prisma.permission.findMany({
    where: {
      OR: userPermSlugs.map((s) => {
        const [resource, action] = s.split(':');
        return { resource, action };
      }),
    },
    select: { id: true },
  });

  let userRole = await prisma.role.findFirst({
    where: { slug: 'user', tenantId: null },
  });
  if (!userRole) {
    userRole = await prisma.role.create({
      data: {
        name: 'Usuario',
        slug: 'user',
        description: 'Permisos básicos de operación',
        tenantId: null,
        isSystem: true,
      },
    });
    for (const p of userPermIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: userRole!.id, permissionId: p.id } },
        create: { roleId: userRole!.id, permissionId: p.id },
        update: {},
      });
    }
    console.log('Rol user creado con', userPermIds.length, 'permisos');
  }

  // 5. Asignar tenant a usuarios existentes y UserRole según role legacy (solo si hay tenant)
  if (tenant) {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true },
    });
    for (const u of users) {
      await prisma.user.update({
        where: { id: u.id },
        data: { tenantId: tenant.id },
      });
      const existingUserRole = await prisma.userRole.findFirst({
        where: { userId: u.id },
      });
      if (!existingUserRole) {
        const roleId = u.role === RoleName.ADMIN ? adminRole!.id : userRole!.id;
        await prisma.userRole.create({
          data: {
            userId: u.id,
            roleId,
            tenantId: tenant.id,
          },
        });
        console.log('UserRole asignado:', u.email, '->', u.role === RoleName.ADMIN ? 'admin' : 'user');
      }
    }
  }

  // 6. Usuario administrador de plataforma (sin tenant) para Panel proveedor
  let platformAdmin = await prisma.user.findFirst({
    where: { email: PLATFORM_ADMIN_EMAIL },
    select: { id: true, tenantId: true },
  });
  if (!platformAdmin) {
    const passwordHash = await argon2.hash(PLATFORM_ADMIN_PASSWORD);
    platformAdmin = await prisma.user.create({
      data: {
        email: PLATFORM_ADMIN_EMAIL,
        passwordHash,
        role: RoleName.ADMIN,
        tenantId: null,
      },
      select: { id: true, tenantId: true },
    });
    await prisma.userRole.create({
      data: {
        userId: platformAdmin.id,
        roleId: adminRole!.id,
        tenantId: null,
      },
    });
    console.log('Admin de plataforma creado:', PLATFORM_ADMIN_EMAIL);
  } else if (platformAdmin.tenantId !== null) {
    // Si ya existía pero tenía tenant, corregir para que sea admin de plataforma
    await prisma.user.update({
      where: { id: platformAdmin.id },
      data: { tenantId: null },
    });
    await prisma.userRole.updateMany({
      where: { userId: platformAdmin.id },
      data: { tenantId: null },
    });
    console.log('Admin de plataforma corregido (tenantId = null):', PLATFORM_ADMIN_EMAIL);
  }

  // 7. Usuario administrador del tenant por defecto (acceso a todo el negocio) — solo si hay tenant
  if (tenant) {
    let tenantAdmin = await prisma.user.findFirst({
      where: { email: TENANT_ADMIN_EMAIL },
      select: { id: true },
    });
    if (!tenantAdmin && TENANT_ADMIN_PASSWORD.length >= 8) {
      const tenantAdminHash = await argon2.hash(TENANT_ADMIN_PASSWORD);
      tenantAdmin = await prisma.user.create({
        data: {
          email: TENANT_ADMIN_EMAIL,
          passwordHash: tenantAdminHash,
          role: RoleName.ADMIN,
          tenantId: tenant.id,
        },
        select: { id: true },
      });
      await prisma.userRole.create({
        data: {
          userId: tenantAdmin.id,
          roleId: adminRole!.id,
          tenantId: tenant.id,
        },
      });
      console.log('Admin de tenant creado:', TENANT_ADMIN_EMAIL);
    }
  }

  // 8. Modo vacío: quitar tenant por defecto (creado por migración) y cualquier usuario que no sea el tuyo
  if (SEED_ONLY_PLATFORM_ADMIN) {
    const defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'default' }, select: { id: true } });
    if (defaultTenant) {
      await prisma.tenant.delete({ where: { id: defaultTenant.id } });
      console.log('Tenant por defecto eliminado (panel quedará con 0 empresas).');
    }
    const deleted = await prisma.user.deleteMany({
      where: { email: { not: PLATFORM_ADMIN_EMAIL } },
    });
    if (deleted.count > 0) {
      console.log('Usuarios de prueba eliminados; solo queda:', PLATFORM_ADMIN_EMAIL);
    }
  }
}

main()
  .then(() => {
    console.log('Seed completado.');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
