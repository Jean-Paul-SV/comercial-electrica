/**
 * Actualiza contraseña (y opcionalmente correo) de un usuario existente.
 * Uso:
 *   1. En tu .env (raíz del proyecto) define:
 *      UPDATE_ADMIN_EMAIL=email-actual-del-usuario@ejemplo.com   (o PLATFORM_ADMIN_EMAIL)
 *      ADMIN_NEW_PASSWORD=TuNuevaContraseña123
 *      ADMIN_NEW_EMAIL=nuevo@ejemplo.com   (opcional; solo si quieres cambiar el correo)
 *   2. DATABASE_URL debe apuntar a la base (local o producción/Render).
 *   3. Desde la raíz: npm run update-admin-password -w api
 */
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

// Cargar .env: raíz del repo (cwd al usar "npm run ... -w api") o apps/api/../..
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

async function main() {
  const currentEmail = (
    process.env.UPDATE_ADMIN_EMAIL?.trim() ||
    process.env.PLATFORM_ADMIN_EMAIL?.trim()
  );
  const newPassword = process.env.ADMIN_NEW_PASSWORD?.trim();
  const newEmail = process.env.ADMIN_NEW_EMAIL?.trim();

  if (!currentEmail || !newPassword) {
    console.error('Faltan variables de entorno. Define UPDATE_ADMIN_EMAIL (o PLATFORM_ADMIN_EMAIL) y ADMIN_NEW_PASSWORD en tu .env');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: currentEmail },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error('No se encontró ningún usuario con email:', currentEmail);
    process.exit(1);
  }

  const passwordHash = await argon2.hash(newPassword);
  const data: { passwordHash: string; email?: string } = { passwordHash };
  if (newEmail && newEmail !== currentEmail) {
    const existing = await prisma.user.findFirst({ where: { email: newEmail }, select: { id: true } });
    if (existing) {
      console.error('Ya existe otro usuario con el correo:', newEmail);
      process.exit(1);
    }
    data.email = newEmail;
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  console.log('Usuario actualizado correctamente.');
  if (data.email) console.log('  Correo:', currentEmail, '->', data.email);
  console.log('  Contraseña: actualizada.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
