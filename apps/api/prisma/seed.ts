/**
 * Seed: permisos, roles, planes y (opcional) usuarios.
 * Ejecutar tras migración: npx prisma db seed
 *
 * SEED_PLANS_ONLY=true: solo planes y permisos/roles. No crea tenant ni usuarios. Borra platform@proveedor.local y admin@negocio.local.
 * Sin SEED_PLANS_ONLY: comportamiento completo (plan, tenant, usuarios según PLATFORM_ADMIN_EMAIL / TENANT_ADMIN_EMAIL).
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

/** Si true, el seed solo actualiza planes y permisos/roles. No crea tenant ni usuarios. Elimina platform@proveedor.local y admin@negocio.local. */
const SEED_PLANS_ONLY = process.env.SEED_PLANS_ONLY === 'true' || process.env.SEED_PLANS_ONLY === '1';

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

  // 1.1 Planes estándar: Básico/Premium sin DIAN, Básico/Premium con DIAN, Enterprise
  // Nota: se crean SIEMPRE (incluso en modo \"solo tu usuario\"), porque son configuración de plataforma.
  // Lógica: Básico = sin reportes; Premium = con reportes; con DIAN añade facturación electrónica; Enterprise = todo.
  const standardPlans = [
    { slug: 'basico-sin-dian', name: 'Plan Básico sin DIAN', description: 'Ventas, inventario y clientes. Backup 1 día a la semana. Sin facturación electrónica ni reportes.', priceMonthly: 89_000, priceYearly: 890_000, maxUsers: 3, moduleCodes: ['core', 'inventory', 'backups'] as const },
    { slug: 'premium-sin-dian', name: 'Plan Premium sin DIAN', description: 'Todo lo del Básico más reportes. Backup 2 días a la semana. Sin facturación electrónica DIAN.', priceMonthly: 120_000, priceYearly: 1_150_000, maxUsers: 5, moduleCodes: ['core', 'inventory', 'advanced_reports', 'backups'] as const },
    { slug: 'premium-con-dian', name: 'Plan Premium con DIAN (Recomendado)', description: 'DIAN, reportes y proveedores. Backup diario. Para equipos que facturan electrónicamente.', priceMonthly: 200_000, priceYearly: 1_920_000, maxUsers: 8, moduleCodes: ['core', 'inventory', 'suppliers', 'electronic_invoicing', 'advanced_reports', 'backups'] as const },
    { slug: 'basico-con-dian', name: 'Plan Básico con DIAN', description: 'Facturación electrónica DIAN, ventas, inventario y clientes. Backup 3 días a la semana. Sin reportes.', priceMonthly: 169_000, priceYearly: 1_620_000, maxUsers: 3, moduleCodes: ['core', 'inventory', 'electronic_invoicing', 'backups'] as const },
    { slug: 'enterprise', name: 'Plan Enterprise', description: 'Todo: DIAN, reportes, proveedores, auditoría y backups.', priceMonthly: 299_000, priceYearly: 2_890_000, maxUsers: 25, moduleCodes: [...MODULE_CODES] },
  ];
  for (const p of standardPlans) {
    const moduleCodes = [...p.moduleCodes];
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
      for (const code of moduleCodes) {
        await prisma.planFeature.create({
          data: { planId: existing.id, moduleCode: code },
        });
      }
      console.log('Plan creado:', p.name, 'con', moduleCodes.length, 'módulos');
    } else {
      await prisma.plan.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          maxUsers: p.maxUsers,
        },
      });
      await prisma.planFeature.deleteMany({ where: { planId: existing.id } });
      for (const code of moduleCodes) {
        await prisma.planFeature.create({
          data: { planId: existing.id, moduleCode: code },
        });
      }
      console.log('Plan actualizado:', p.name, 'con', moduleCodes.length, 'módulos');
    }
  }

  // Eliminar planes viejos/duplicados (reasignar empresas al plan nuevo equivalente y borrar)
  const oldPlanSlugsToRemove = ['plan-premium', 'con-dian', 'sin-dian'] as const;
  const oldToNewSlug: Record<string, string> = { 'sin-dian': 'basico-sin-dian', 'con-dian': 'basico-con-dian', 'plan-premium': 'premium-con-dian' };
  for (const oldSlug of oldPlanSlugsToRemove) {
    const oldPlan = await prisma.plan.findFirst({ where: { slug: oldSlug } });
    if (!oldPlan) continue;
    const newSlug = oldToNewSlug[oldSlug];
    const newPlan = newSlug ? await prisma.plan.findFirst({ where: { slug: newSlug } }) : null;
    if (newPlan) {
      await prisma.tenant.updateMany({ where: { planId: oldPlan.id }, data: { planId: newPlan.id } });
      await prisma.subscription.updateMany({ where: { planId: oldPlan.id }, data: { planId: newPlan.id } });
    } else {
      await prisma.tenant.updateMany({ where: { planId: oldPlan.id }, data: { planId: null } });
      await prisma.subscription.updateMany({ where: { planId: oldPlan.id }, data: { planId: null } });
    }
    await prisma.planFeature.deleteMany({ where: { planId: oldPlan.id } });
    await prisma.plan.delete({ where: { id: oldPlan.id } });
    console.log('Plan antiguo eliminado:', oldSlug);
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

  // 2. Tenant por defecto (con plan "Todo incluido") — se omite si SEED_ONLY_PLATFORM_ADMIN o SEED_PLANS_ONLY
  let tenant: { id: string; planId: string | null } | null = null;
  if (!SEED_PLANS_ONLY && !SEED_ONLY_PLATFORM_ADMIN) {
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

  // 5. Asignar tenant a usuarios existentes y UserRole según role legacy (solo si hay tenant) — omitido si SEED_PLANS_ONLY
  if (!SEED_PLANS_ONLY && tenant) {
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

  // 6. Usuario administrador de plataforma (sin tenant) para Panel proveedor — omitido si SEED_PLANS_ONLY
  if (!SEED_PLANS_ONLY) {
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
  } // fin if (!SEED_PLANS_ONLY)

  // SEED_PLANS_ONLY: eliminar usuarios de prueba por defecto (el perfil ya está asignado en producción)
  if (SEED_PLANS_ONLY) {
    const emailsToRemove = ['platform@proveedor.local', 'admin@negocio.local'];
    for (const email of emailsToRemove) {
      const deleted = await prisma.user.deleteMany({ where: { email } });
      if (deleted.count > 0) console.log('Usuario eliminado:', email);
    }
  }

  // Desvincular de tenant a los correos en PLATFORM_ADMIN_EMAILS (nunca deben tener empresa asignada)
  const platformEmailsRaw = process.env.PLATFORM_ADMIN_EMAILS?.trim();
  if (platformEmailsRaw) {
    const platformEmails = platformEmailsRaw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    for (const email of platformEmails) {
      const user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
      if (user) {
        await prisma.userRole.updateMany({ where: { userId: user.id }, data: { tenantId: null } });
        await prisma.user.update({ where: { id: user.id }, data: { tenantId: null } });
        console.log('Usuario desvinculado de tenant (Panel proveedor):', email);
      }
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
