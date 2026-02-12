/**
 * Crea un usuario administrador del tenant "default" para probar Facturación electrónica.
 * Uso: DATABASE_URL=postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public npx ts-node scripts/create-tenant-admin.ts
 */
import { PrismaClient, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const EMAIL = 'admin@local.dev';
const PASSWORD = 'AdminLocal1!';

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) {
    throw new Error('No existe tenant con slug "default". Ejecuta antes: npm run prisma:seed');
  }

  const adminRole = await prisma.role.findFirst({
    where: { slug: 'admin', tenantId: null },
  });
  if (!adminRole) {
    throw new Error('No existe rol admin. Ejecuta antes: npm run prisma:seed');
  }

  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tenantId: tenant.id, role: RoleName.ADMIN },
    });
    const ur = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: adminRole.id, tenantId: tenant.id },
    });
    if (!ur) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: adminRole.id, tenantId: tenant.id },
      });
    }
    console.log('Usuario actualizado:', EMAIL, '| tenant:', tenant.id, '| rol: admin');
  } else {
    const passwordHash = await argon2.hash(PASSWORD);
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash,
        role: RoleName.ADMIN,
        tenantId: tenant.id,
        name: 'Admin Local',
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: adminRole.id, tenantId: tenant.id },
    });
    console.log('Usuario creado:', EMAIL, '| contraseña:', PASSWORD);
  }
  console.log('Inicia sesión en la web con este usuario para ver Cuenta → Facturación electrónica.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
