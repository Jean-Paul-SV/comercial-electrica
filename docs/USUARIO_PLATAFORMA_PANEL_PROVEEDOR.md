# Usuario de plataforma (Panel proveedor y Planes)

El **usuario de plataforma** es el que gestiona empresas (tenants), planes y altas de clientes desde el **Panel proveedor** (`/provider`). No pertenece a ningún tenant (`tenantId = null`).

---

## Dónde se crea

- **Seed de Prisma** (`apps/api/prisma/seed.ts`, paso 6).  
  Se ejecuta al hacer:
  ```bash
  npm run prisma:seed
  ```
  (desde la raíz del repo; usa la `DATABASE_URL` del `.env`.)

- Si en el entorno existen **`PLATFORM_ADMIN_EMAIL`** y **`PLATFORM_ADMIN_PASSWORD`** (mín. 8 caracteres), el seed crea ese usuario.  
  Si no, crea por defecto:
  - **Email:** `platform@admin.local`
  - **Contraseña:** `PlatformAdmin1!`

---

## Cómo identificarlo en el sistema

- En base de datos: usuario con **`tenantId = null`**.
- En el JWT y en la API: **`isPlatformAdmin: true`**.
- Las rutas del **Panel proveedor** (`/provider/*`) solo permiten acceso si el usuario tiene `tenantId === null` (guard `PlatformAdminGuard`).

---

## Cómo usarlo en la app

1. Iniciar sesión en la web con el email y contraseña del usuario de plataforma.
2. La app redirige automáticamente a **`/provider`** (Panel proveedor).
3. Desde ahí puedes:
   - **Empresas:** listar, filtrar (Activas/Suspendidas), ver detalle, suspender/reactivar.
   - **Nueva empresa:** crear tenant + primer admin.
   - **Planes:** listar y editar planes (precios, Stripe, activo/inactivo).

---

## Si no existe o quieres resetear la contraseña

- **Crear o asegurar que exista:** ejecutar el seed (ver arriba). Si el usuario ya existe por email, el seed no lo sobrescribe.
- **Resetear contraseña (o crear el usuario sin ejecutar todo el seed):** usar el script de admins:
  ```bash
  cd apps/api
  $env:PLATFORM_ADMIN_EMAIL = "tu@email.com"
  $env:PLATFORM_ADMIN_PASSWORD = "TuPasswordSegura123!"
  $env:DATABASE_URL = "postgresql://..."   # tu connection string
  npx ts-node scripts/set-admins.ts
  ```
  Ver cabecera de `scripts/set-admins.ts` para las variables requeridas.

---

## Resumen

| Qué | Dónde |
|-----|--------|
| **Creación** | `prisma db seed` (paso 6 del seed). |
| **Credenciales por defecto** | `platform@admin.local` / `PlatformAdmin1!`. |
| **Credenciales propias** | Variables `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` al ejecutar el seed (o `set-admins.ts`). |
| **Acceso en la app** | Login → redirección a **`/provider`** (Empresas, Nueva empresa, Planes). |
| **Identificación en BD** | Usuario con **`tenantId = null`**. |
