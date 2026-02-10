# Ejecutar el seed en producción (Render)

El seed crea o actualiza en la base de datos:

- Plan "Todo incluido" y módulos
- Tenant por defecto
- Permisos y roles (admin, user)
- Usuario **platform@admin.local** con contraseña **PlatformAdmin1!** (si no existe)

Así puedes comprobar que el programa está en orden y tener un usuario para entrar a la app.

---

## Opción 1: Script desde tu PC (recomendado)

1. En **Render** → **comercial-electrica-db** → **Connect** → copia la **Internal Database URL**.
2. Abre PowerShell en la raíz del proyecto y ejecuta:

   ```powershell
   cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica\apps\api
   .\scripts\seed-production.ps1
   ```
3. Cuando pida la URL, **pega** la que copiaste de Render y pulsa Enter.
4. El script desactiva tu `.env` local, ejecuta el seed contra la base de Render y restaura el `.env`.

Si todo va bien verás "Seed completado" y las credenciales para iniciar sesión.

---

## Opción 2: Comandos manuales

1. Copia la **Internal Database URL** de Render.
2. En PowerShell:

   ```powershell
   cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica\apps\api
   Rename-Item -Path ..\..\.env -NewName .env.local.backup -ErrorAction SilentlyContinue
   $env:DATABASE_URL = "postgresql://..."   # pega aquí la URL de Render
   npx prisma db seed
   Rename-Item -Path ..\..\.env.local.backup -NewName .env -ErrorAction SilentlyContinue
   ```

---

## Opción 3: Shell de Render

Si tienes acceso al **Shell** del servicio **comercial-electrica-api** en Render:

1. Abre el Shell (ya tiene `DATABASE_URL` de producción).
2. Ejecuta:

   ```bash
   cd apps/api
   npx prisma db seed
   ```

---

## Después del seed

- Inicia sesión en la web (Vercel) con:
  - **Email:** `platform@admin.local`
  - **Contraseña:** `PlatformAdmin1!`
- Ese usuario es administrador de plataforma (sin tenant); la app puede redirigirte al panel de proveedor. Para usar la app de un tenant, crea o asigna usuarios desde ese panel o con otros flujos (invitación, etc.).

El seed es **idempotente** en gran parte: puedes ejecutarlo más de una vez; no borra datos, solo crea lo que falta (plan, tenant, permisos, roles y el usuario platform si no existe).

---

## Producción real

Si esta base es solo para **pruebas**, está bien. Para **producción** con datos reales:

- Cambia la contraseña de la base de datos en Render (Dashboard → comercial-electrica-db → Info/Settings → Reset password o similar).
- Actualiza la variable `DATABASE_URL` en el servicio **comercial-electrica-api** con la nueva URL que te dé Render.
- Cambia la contraseña del usuario `platform@admin.local` desde la app o crea un admin con otro email y desactiva/elimina el de prueba.
