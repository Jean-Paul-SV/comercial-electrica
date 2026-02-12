# Primer usuario en producción

El proyecto **no incluye base de datos** en el repositorio. En producción debes crear la BD, aplicar el esquema y luego crear los usuarios iniciales.

---

## Si desplegaste en Render: las credenciales no “aparecen” solas

En Render, el **deploy no ejecuta el seed**. El `startCommand` solo hace migraciones y arranca la API. Por tanto:

- **El usuario de plataforma** (`platform@admin.local` o el que definas) **no se crea** hasta que ejecutes el seed **una vez** contra la BD de producción.
- Las variables **`PLATFORM_ADMIN_EMAIL`** y **`PLATFORM_ADMIN_PASSWORD`** en el Dashboard de Render son opcionales y **solo se usan si en algún momento se ejecuta el seed** con ese entorno (por ejemplo desde un job o shell que apunte a esa BD). Para crear el usuario la primera vez, lo habitual es ejecutar el seed **desde tu PC** (ver más abajo).

**Qué hacer:**

1. En tu PC, apunta a la BD de Render y ejecuta el seed **una vez** (después del primer deploy):
   ```powershell
   cd apps/api
   $env:DATABASE_URL = "postgresql://..."   # Copia la connection string de Render (Dashboard → BD → Connect)
   # Opcional: usar tu email/contraseña como dueño del sistema
   $env:PLATFORM_ADMIN_EMAIL = "tu@email.com"
   $env:PLATFORM_ADMIN_PASSWORD = "TuPasswordSegura123!"
   npx prisma db seed
   ```
2. Si **no** defines `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`, el seed crea por defecto **`platform@admin.local`** / **`PlatformAdmin1!`**. Puedes usar esas credenciales para entrar en la app desplegada y acceder al Panel proveedor.
3. (Opcional) Si quieres que en el Dashboard de Render figuren las variables para referencia o para un futuro job que ejecute el seed, añade `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` en Environment; el usuario solo existirá después de ejecutar el seed como en el paso 1.

---

## Dueño del sistema (administrador de plataforma)

El **dueño del sistema** es el usuario que puede acceder al **Panel proveedor** (gestión de empresas/tenants, planes, altas de clientes). Ese usuario se crea al ejecutar **`prisma:seed`**.

Para que **tu cuenta** sea la dueña (y no el usuario genérico de desarrollo):

1. Antes de ejecutar el seed en producción, configura en tu entorno (ej. variables de entorno en Render):
   - **`PLATFORM_ADMIN_EMAIL`** = tu email (ej. `tu@empresa.com`)
   - **`PLATFORM_ADMIN_PASSWORD`** = tu contraseña segura (mínimo 8 caracteres)

2. Ejecuta el seed (desde tu PC con `DATABASE_URL` de producción, o en el pipeline que use la BD):
   ```bash
   npm run prisma:seed -w api
   ```
   Se creará el usuario con ese email como **administrador de plataforma** (sin tenant; acceso al Panel proveedor). Si no defines esas variables, se usa por defecto `platform@admin.local` / `PlatformAdmin1!`.

---

## Orden de pasos (primera vez)

1. **Crear la base de datos** en tu proveedor (Render, Railway, Neon, etc.) y configurar `DATABASE_URL` en las variables de entorno de producción.

2. **Aplicar migraciones** (crea tablas vacías):
   ```bash
   npm run prisma:migrate -w api
   ```
   O en tu pipeline de deploy, el equivalente según tu entorno.

3. **Ejecutar el seed** (crea tenant por defecto, plan, roles, permisos y **el dueño del sistema**; ver sección anterior):
   ```bash
   # Opcional: exportar tu email y contraseña para que seas el dueño
   # export PLATFORM_ADMIN_EMAIL="tu@email.com"
   # export PLATFORM_ADMIN_PASSWORD="TuPasswordSeguro123!"
   npm run prisma:seed -w api
   ```

4. **Crear el primer administrador del tenant** “Negocio principal” (para operar dentro de la app con un negocio) con un request a la API (solo si aún no hay usuarios con tenant):
   ```bash
   curl -X POST https://TU-API-PRODUCCION/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -d '{"email":"admin-tenant@ejemplo.com","password":"TuPasswordSeguro123!"}'
   ```
   Ese usuario será **admin del tenant por defecto** (no el dueño de la plataforma). Si prefieres cargar muchos datos de prueba, puedes usar en su lugar `node scripts/seed-500-real.js --clean --force` (crea `admin@example.com` / `Admin123!` y datos de negocio).

5. Entra en la app: con el **dueño** (PLATFORM_ADMIN_EMAIL) accedes al Panel proveedor; con el admin del tenant o `admin@example.com` operas dentro del negocio.

---

## Detalle técnico

- **Dueño del sistema (platform admin):** Lo crea `prisma:seed`. Si defines `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` (mín. 8 caracteres) en el entorno, se usa tu cuenta; si no, se crea `platform@admin.local` / `PlatformAdmin1!`. Ese usuario tiene `tenantId: null` y acceso al Panel proveedor.
- **`POST /auth/bootstrap-admin`** crea el **primer admin del tenant por defecto** (negocio principal). Solo funciona si no hay ningún usuario en la BD; si ya existe alguno, responde 400 con *"Bootstrap ya fue realizado"*. El usuario creado se asigna al tenant por defecto y al rol admin (operación dentro de la app).
- Si ejecutas el seed primero, ya existirá el dueño (platform admin). Si quieres un admin de tenant distinto, usa bootstrap-admin después o el seed-500-real.

---

## Resumen rápido

| Paso | Acción |
|------|--------|
| 1 | Crear BD y configurar `DATABASE_URL` |
| 2 | `npm run prisma:migrate -w api` |
| 3 | (Opcional) Definir `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` para ser el dueño del sistema |
| 4 | `npm run prisma:seed -w api` (crea tenant, roles y dueño de plataforma) |
| 5 | `POST /auth/bootstrap-admin` o `seed-500-real.js` para admin del tenant / datos de prueba |
| 6 | Iniciar sesión en la web (dueño = Panel proveedor; admin tenant = operación del negocio) |
