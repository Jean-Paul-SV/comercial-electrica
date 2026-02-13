# Base de datos en Render: solo los 3 usuarios que ingresamos

> **Ubicación:** Documento en `historico`. Referencia para producción con BD purgada y solo 3 usuarios.

Si quieres que en producción (Render) **solo** existan y puedan iniciar sesión **3 usuarios** con **acceso a todo** (plan, tenant, roles de administrador), y la **base de datos está purgada** (sin datos de negocio), haz lo siguiente.

---

## Base de datos purgada: qué queda

- **Solo** lo que crea el seed de Prisma: **Plan**, **Tenant**, **Roles** (admin, user), **Permisos**, **Suscripción** y **1 usuario** (administrador de plataforma). No hay productos, ventas, clientes ni otros datos de negocio.
- Ese **1 usuario** puede entrar por el link de Vercel y tiene **acceso a todo** (Panel proveedor y, si entra al tenant, todos los módulos). Los **otros 2** usuarios los creas desde la app y les asignas el rol **Administrador** para que también tengan acceso a todo.

---

## 1. Que en la BD solo existan 3 usuarios

- **No ejecutes** en producción ningún seed que cree más usuarios:
  - **No** ejecutes `node scripts/seed-500-real.js` ni `node scripts/seed-dev.js` contra la BD de Render (esos scripts crean `admin@example.com`, `vendedor@example.com`, etc.).
- **Sí ejecuta una sola vez** el seed de Prisma (crea plan, tenant, roles, **usuario Panel proveedor** y **admin del tenant**):
  ```powershell
  cd apps/api
  # Pega la connection string de Render (Dashboard → BD → Connect). No la subas al repo.
  $env:DATABASE_URL = "postgresql://..."
  npx prisma db seed
  ```
  Por defecto el seed crea **2 usuarios de prueba**:
  | Usuario | Correo | Contraseña | Uso |
  |---------|--------|------------|-----|
  | Panel proveedor | platform@proveedor.local | PlatformProveedor1! | Gestión de empresas/tenants, planes |
  | Admin del tenant | admin@negocio.local | AdminNegocio1! | Acceso a todo el negocio (ventas, caja, reportes, etc.) |
  El **tercer usuario** créalo desde la app (link de Vercel) → inicia sesión con `admin@negocio.local` → **Usuarios** → Invitar usuario (rol **Administrador**).

Así en la base de datos de Render quedarán los 3 usuarios con **acceso a todo** (rol admin + plan con todos los módulos).

---

## 2. Que solo esos 3 puedan iniciar sesión (whitelist)

1. En **Render** → tu servicio **API** → **Environment**.
2. Añade una variable:
   - **Key:** `ALLOWED_LOGIN_EMAILS`
   - **Value:** los 3 correos separados por coma, por ejemplo:
     ```text
     admin@empresa.com,vendedor@empresa.com,contador@empresa.com
     ```
3. Guarda y **redeploy** la API.

Solo esos 3 correos podrán iniciar sesión desde el link de Vercel.

---

## Resumen

| Objetivo | Qué hacer |
|----------|-----------|
| BD purgada, solo 3 usuarios con acceso a todo | Ejecutar solo `prisma db seed` una vez (1 usuario) y crear los otros 2 desde la app con rol Administrador. No ejecutar `seed-500-real.js` ni `seed-dev.js`. |
| Solo 3 puedan iniciar sesión | Definir `ALLOWED_LOGIN_EMAILS` en Render con los 3 correos y redeploy. |

Ver también: `PRIMER_USUARIO_PRODUCCION.md`, `env.example` (sección ALLOWED_LOGIN_EMAILS).
