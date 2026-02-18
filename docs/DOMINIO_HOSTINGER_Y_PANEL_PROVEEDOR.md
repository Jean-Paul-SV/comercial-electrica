# Dominio en Hostinger: subir el proyecto y configurar tu correo (Panel proveedor)

Guía para poner Orion en tu dominio comprado en Hostinger y usar **tu correo** para administrar las empresas desde el Panel proveedor.

---

## Resumen rápido

- **Hostinger** (donde compraste el dominio) se usa para **gestionar el DNS** del dominio. No hace falta contratar hosting web en Hostinger para este proyecto.
- La **web** (Next.js) se despliega en **Vercel** (gratis con GitHub).
- La **API** (NestJS) + **PostgreSQL** + **Redis** se despliegan en **Render** (u otro proveedor).
- En Hostinger solo configuras los **registros DNS** para que tu dominio apunte a Vercel (y, si quieres, un subdominio para la API).
- Tu correo de administrador del Panel proveedor se configura en la **API** antes de ejecutar el seed.

---

## 1. Tu correo para el Panel proveedor

El **Panel proveedor** es el que usas para administrar las empresas (tenants): dar de alta clientes, planes, facturación, etc. Ese usuario es el “dueño de la plataforma”.

### Cómo se crea ese usuario

Se crea al ejecutar el **seed** de la base de datos en el entorno donde esté la API (por ejemplo Render). Si defines estas variables **antes** de que se ejecute el seed, se crea tu usuario con tu correo:

- **`PLATFORM_ADMIN_EMAIL`** = tu correo real (ej. `tu-correo@gmail.com`)
- **`PLATFORM_ADMIN_PASSWORD`** = contraseña segura (mínimo 8 caracteres)

### Dónde configurarlas

- **Si la API está en Render:**  
  Dashboard de Render → tu servicio API → **Environment** → añade:
  - `PLATFORM_ADMIN_EMAIL` = `tu-correo@ejemplo.com`
  - `PLATFORM_ADMIN_PASSWORD` = `TuPasswordSeguro123!` (mínimo 8 caracteres)

Luego ejecuta el seed **una vez** en ese entorno (o deja que el proceso de despliegue lo haga). En Render suele hacerse en el primer deploy con `prisma migrate deploy && prisma db seed`. **Con solo esas dos variables**, el seed crea únicamente tu usuario (0 empresas, sin datos de prueba). Ver `docs/PASO_A_PASO_SEED_MI_CORREO.md` — Opción A.

- **Si ya ejecutaste el seed** sin estas variables, se habrá creado el usuario por defecto `platform@proveedor.local`. En ese caso puedes:
  - Cambiar el email de ese usuario en la base de datos (tabla `User`), o
  - Crear un nuevo usuario con rol admin de plataforma (sin tenant) y usar ese correo para el Panel proveedor.

Después de esto, entras al Panel proveedor con **tu correo** y la contraseña que definiste.

---

## 2. Desplegar la API (Render u otro)

1. Crea en **Render** (o el proveedor que uses):
   - Un servicio **PostgreSQL**.
   - Un servicio **Redis** (si lo usas).
   - Un **Web Service** para la API (NestJS).

2. En el Web Service de la API configura las variables de entorno (ver `env.example` y `docs/DEPLOY.md`). **Importante:** el `.env` de tu PC no se usa en producción; hay que definirlas en el panel de Render (Environment):
   - `DATABASE_URL`, `REDIS_URL`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - **`PLATFORM_ADMIN_EMAIL`** y **`PLATFORM_ADMIN_PASSWORD`** (tu correo para Panel proveedor). Con estas dos, al ejecutar el seed en producción solo se crea tu usuario (0 empresas, sin datos de prueba).
   - `ALLOWED_ORIGINS` y `FRONTEND_URL` (los pondrás cuando tengas el dominio final; ver paso 5)

3. En el **Build** del servicio API, asegúrate de que se ejecuten las migraciones y el seed, por ejemplo:
   - `npm run prisma:migrate:deploy` (o `npx prisma migrate deploy`)
   - `npm run prisma:seed` (o `npx prisma db seed`)

4. Anota la URL de la API (ej. `https://comercial-electrica-api.onrender.com`). La usarás en la web y en CORS.

---

## 3. Desplegar la web (Vercel)

1. Entra en **[vercel.com](https://vercel.com)** e inicia sesión (por ejemplo con GitHub).
2. **Add New** → **Project** → importa el repositorio del proyecto.
3. Configuración:
   - **Root Directory:** `apps/web`
   - **Framework:** Next.js
   - **Environment Variables** (en Vercel → proyecto → Settings → Environment Variables):
     - **`NEXT_PUBLIC_API_BASE_URL`** = URL de tu API (ej. `https://comercial-electrica-api.onrender.com`, sin barra final)
     - Opcionales: `NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER`, `NEXT_PUBLIC_SUPPORT_WHATSAPP_MESSAGE`
4. **Deploy**. Vercel te dará una URL tipo `https://tu-proyecto.vercel.app`.

Más detalle: `docs/SUBIR_WEB_AL_DOMINIO.md`.

---

## 4. Usar tu dominio de Hostinger

Tu dominio está en **Hostinger**; desde ahí solo vas a **apuntar el dominio** a donde está realmente la app (Vercel).

### En Vercel

1. Vercel → tu proyecto → **Settings** → **Domains**.
2. **Add** → escribe tu dominio (ej. `app.tudominio.com` o `orion.tudominio.com`). Si quieres que la página principal sea el mismo dominio, puedes usar `tudominio.com` o `www.tudominio.com`.
3. Vercel te mostrará qué registro DNS crear (normalmente un **CNAME** a `cname.vercel-dns.com` o un **A** con una IP).

### En Hostinger (DNS)

1. Entra en **Hostinger** → **Dominios** → tu dominio → **Administrar** / **DNS** (o “Zona DNS” / “DNS Zone”).
2. Crea el registro que Vercel te indique:
   - Si Vercel pide **CNAME**: nombre (ej. `app` para `app.tudominio.com`) → valor `cname.vercel-dns.com`.
   - Si pide **A**: nombre `@` (o el subdominio) → valor = la IP que te dé Vercel.
3. Guarda y espera la propagación (puede tardar desde minutos hasta 24–48 h).

Cuando el DNS esté bien, Vercel marcará el dominio como activo y la web se servirá en **tu dominio**.

### (Opcional) Subdominio para la API

Si quieres algo como `api.tudominio.com`:

- En Render (o tu proveedor de la API) configura un **custom domain** `api.tudominio.com` y te dirán qué CNAME o A crear.
- En Hostinger creas ese CNAME o A apuntando a la URL que te indique Render.

---

## 5. Decirle a la API cuál es tu dominio (CORS y frontend)

Para que el navegador permita que la web (en tu dominio) hable con la API, y para que los enlaces en correos y facturación sean correctos:

1. En **Render** (servicio de la API) → **Environment**:
   - **`ALLOWED_ORIGINS`** = URL de tu web con tu dominio (ej. `https://app.tudominio.com`). Si tienes varias, sepáralas por coma, sin espacios.
   - **`FRONTEND_URL`** = la misma URL de la web (ej. `https://app.tudominio.com`).

2. **Redeploy** del servicio API para que cargue las nuevas variables.

---

## 6. Resumen de pasos

| Paso | Dónde | Qué hacer |
|------|--------|-----------|
| 1 | Render (API) | Variables `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` con tu correo y contraseña. Ejecutar migraciones + seed. |
| 2 | Vercel | Importar repo, root `apps/web`, variable `NEXT_PUBLIC_API_BASE_URL` = URL de la API. Deploy. |
| 3 | Vercel | Domains → añadir tu dominio (ej. `app.tudominio.com`). |
| 4 | Hostinger | En DNS, crear el CNAME o A que indique Vercel para ese dominio. |
| 5 | Render (API) | `ALLOWED_ORIGINS` y `FRONTEND_URL` = URL de tu web (tu dominio). Redeploy. |
| 6 | Probar | Abrir `https://app.tudominio.com` (o la URL que hayas elegido), iniciar sesión con **tu correo** y contraseña del Panel proveedor. |

---

## 7. Entrar al Panel proveedor

- URL: la misma de tu web (ej. `https://app.tudominio.com`).
- En el menú verás **Panel proveedor** → Empresas (`/provider`), Nueva empresa (`/provider/new`), Planes (`/provider/plans`).
- Login: el **correo** y **contraseña** que configuraste en `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD`.

Solo los usuarios con rol de administrador de plataforma (sin tenant) ven la sección Panel proveedor.

---

**Referencias:**  
- `docs/SUBIR_WEB_AL_DOMINIO.md` — detalle web + dominio  
- `docs/DEPLOY.md` — checklist y despliegue API  
- `env.example` — variables de entorno (incluye `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`)
