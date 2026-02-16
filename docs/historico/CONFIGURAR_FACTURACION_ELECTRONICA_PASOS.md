# Cómo configurar y probar Facturación electrónica (DIAN) por empresa

Pasos concretos para tener un usuario con permiso, el módulo activo y completar la configuración en la pantalla **Cuenta → Facturación electrónica**.

---

## ¿Qué hago en Render y qué en otro sitio?

| Dónde | Qué haces |
|-------|-----------|
| **Render (Dashboard)** | Solo **variables de entorno** de la API (pestaña Environment). Por ejemplo: `DIAN_CERT_ENCRYPTION_KEY` (obligatoria para subir certificados por empresa). Las migraciones se ejecutan solas en cada deploy (`startCommand`). **No** hay Prisma Studio ni “ejecutar seed” en Render. |
| **Tu PC (local)** | Migraciones y seed (`npx prisma migrate deploy`, `npx prisma db seed`), Prisma Studio para dar rol/tenant a un usuario, generar `DIAN_CERT_ENCRYPTION_KEY`. Puedes hacerlo contra la BD de Render (usando `DATABASE_URL` de Render en un `.env` local) o contra una BD local. |
| **App web (Vercel / tu URL)** | Todo lo que “ves” de facturación electrónica: **Cuenta → Facturación electrónica**, rellenar emisor, software DIAN, subir certificado y guardar. Eso es la app desplegada, no el Dashboard de Render. |

En resumen: **en Render solo configuras variables de entorno**; la pantalla de configuración DIAN la usas en tu **sitio web** (donde tengas el front desplegado).

---

## 1. Base de datos y seed

### 1.1 Migraciones

Desde la raíz del monorepo o desde `apps/api`:

```bash
cd apps/api
npx prisma migrate deploy
```

(En desarrollo puedes usar `npx prisma migrate dev` si la base está en marcha.)

### 1.2 Seed (permisos, plan, tenant, roles)

El seed crea:

- Plan **"Todo incluido"** con todos los módulos, incluido `electronic_invoicing`.
- Tenant **default** con ese plan (por tanto con módulo de facturación electrónica).
- Permisos `dian:manage`, etc.
- Rol **admin** con todos los permisos (incluido `dian:manage`).
- Rol **user** con un subconjunto (sin `dian:manage`).
- Asigna **tenant** y **UserRole** a todos los usuarios que ya existan en la BD.

Ejecutar:

```bash
cd apps/api
npx prisma db seed
```

(O desde raíz: `npm run prisma:seed` si está definido en el root.)

---

## 2. Usuario con permiso `dian:manage` y módulo activo

Para ver **Cuenta → Facturación electrónica** y usarla, el usuario debe:

1. Tener **rol Administrador** (o un rol que incluya el permiso `dian:manage`).
2. Estar asignado a un **tenant** que tenga el **módulo** `electronic_invoicing` (por ejemplo el tenant **default** con plan "Todo incluido").

### Opción A: Ya tienes usuarios en la BD

- Tras el seed, los usuarios existentes quedan con **tenant** = default y **UserRole** según su campo `role` (ADMIN → rol admin, USER → rol user).
- Si un usuario tiene `role = ADMIN`, ya tiene `dian:manage` y el tenant default tiene el módulo. **Inicia sesión con ese usuario** y deberías ver el menú **Facturación electrónica** en Cuenta.

### Opción B: Crear un usuario administrador de empresa (tenant)

Si no tienes ningún usuario de empresa (solo el admin de plataforma), crea uno y asígnale rol admin en el tenant default:

1. **Crear usuario** (por ejemplo desde **Administración → Usuarios** si ya tienes acceso, o por API/invite). Anota el **email** y el **id** del usuario (desde Prisma Studio o desde la API).

2. **Asignar tenant y rol admin** en la base de datos. Puedes usar Prisma Studio:

   ```bash
   cd apps/api
   npx prisma studio
   ```

   - En **User**: editar el usuario y poner `tenantId` = id del tenant **default** (tabla Tenant, slug `default`), y `role` = `ADMIN`.
   - En **UserRole**: crear un registro con:
     - `userId` = id del usuario
     - `roleId` = id del rol **admin** (tabla Role, slug `admin`, tenantId `null`)
     - `tenantId` = id del tenant default

   O con SQL (sustituye los UUIDs por los reales):

   ```sql
   -- Obtener ids (ejemplo):
   -- SELECT id FROM "Tenant" WHERE slug = 'default';
   -- SELECT id FROM "User" WHERE email = 'tu@email.com';
   -- SELECT id FROM "Role" WHERE slug = 'admin' AND "tenantId" IS NULL;

   UPDATE "User" SET "tenantId" = '<TENANT_DEFAULT_ID>', role = 'ADMIN' WHERE email = 'tu@email.com';
   INSERT INTO "UserRole" (id, "userId", "roleId", "tenantId")
   VALUES (gen_random_uuid(), '<USER_ID>', '<ADMIN_ROLE_ID>', '<TENANT_DEFAULT_ID>');
   ```

3. Iniciar sesión con ese email y contraseña. En el menú **Cuenta** debería aparecer **Facturación electrónica**.

---

## 3. Variable de entorno para el certificado (API)

Para poder **subir el certificado .p12** desde la pantalla, la API debe tener la clave de cifrado:

En `apps/api` (o en el `.env` que use la API), añade:

```env
DIAN_CERT_ENCRYPTION_KEY=<clave de 32 bytes en hex (64 caracteres)>
```

Generar una clave (ejemplo en PowerShell):

```powershell
# PowerShell: 32 bytes = 64 caracteres hex
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

O en Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Reinicia la API después de añadir la variable.

---

## 4. Ir a Cuenta → Facturación electrónica

1. Inicia sesión en la **web** con un usuario que tenga:
   - tenant asignado (ej. default),
   - rol con permiso `dian:manage` (ej. admin),
   - y tenant con módulo `electronic_invoicing` (plan "Todo incluido" lo incluye).
2. En el menú lateral, abre **Cuenta** y haz clic en **Facturación electrónica**.
3. Deberías ver la pantalla con el **estado** (p. ej. "No configurado" o "Incompleto") y las secciones del formulario.

---

## 5. Completar configuración y dejar “Listo para facturar”

Rellena en orden (no es obligatorio guardar en este orden, pero ayuda):

1. **Datos del emisor**
   - NIT (ej. `900123456-7`).
   - Razón social (ej. `Mi Empresa S.A.S.`).

2. **Software DIAN**
   - Software ID (el que asigna la DIAN al habilitar el software).
   - PIN del software.

3. **Certificado .p12**
   - Selecciona el archivo `.p12` (o `.pfx`) de firma electrónica.
   - Contraseña del certificado.
   - Clic en **Subir certificado**.

4. **Numeración y ambiente**
   - Ambiente: **Habilitación** (pruebas) o **Producción** (real).
   - Número de resolución (opcional).
   - Prefijo (ej. `FAC`).
   - Rango desde / hasta (ej. 1 y 999999).

5. **Guardar configuración**
   - Clic en **Guardar configuración** para persistir datos del emisor, software y numeración.

Cuando todo esté completo (emisor, software ID/PIN, certificado subido, y si aplica numeración), el **Estado** pasará a **"Listo para facturar"** y el badge será verde.

---

## 6. Si no ves el menú “Facturación electrónica”

- Comprueba que el **tenant** del usuario tiene el módulo `electronic_invoicing` (plan "Todo incluido" lo trae por defecto).
- Comprueba que el **rol** del usuario tiene el permiso `dian:manage` (el rol **admin** del seed lo tiene).
- Cierra sesión y vuelve a entrar para refrescar permisos y módulos en el JWT / sesión.

---

## 7. Resumen rápido (entorno de desarrollo)

```bash
# 1. Migrar
cd apps/api && npx prisma migrate deploy

# 2. Seed (plan, tenant default, permisos, roles)
npx prisma db seed

# 3. Clave para certificados (generar y añadir a .env)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Añadir a .env: DIAN_CERT_ENCRYPTION_KEY=<resultado>

# 4. Reiniciar API; iniciar web; iniciar sesión con usuario ADMIN del tenant default
# 5. Cuenta → Facturación electrónica → completar formulario y subir .p12 → Guardar
```

---

**Última actualización:** Febrero 2026
