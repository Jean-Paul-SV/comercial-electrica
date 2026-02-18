# Migrar a mi dominio en Hostinger (solo mi usuario)

Guía para subir Orion a tu dominio de Hostinger con **solo tu usuario** (Panel proveedor), sin empresas ni datos de prueba.

---

## Resumen

- **Hostinger:** solo gestionas el **DNS** del dominio (no hace falta hosting web ahí).
- **Web (Next.js):** se despliega en **Vercel** y se conecta a tu dominio.
- **API + PostgreSQL + Redis:** se despliegan en **Render**.
- Tu correo y contraseña (los del `.env`: `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`) serán el único usuario; al ejecutar el seed en producción se crea solo ese usuario y 0 empresas.

---

## Paso 1: Subir el código a GitHub

Si aún no está:

1. Crea un repositorio en GitHub (público o privado).
2. Sube el proyecto:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```

---

## Paso 2: API en Render (PostgreSQL + Redis + NestJS)

1. Entra en **[render.com](https://render.com)** e inicia sesión.
2. Crea **tres servicios** (o usa un Blueprint si tienes `render.yaml`):
   - **PostgreSQL** (base de datos). Anota la **Internal Database URL**.
   - **Redis** (si la API lo usa). Anota la **Internal Redis URL**.
   - **Web Service** para la API: conecta el repo de GitHub, directorio raíz del monorepo (o el que use tu build).

3. En el **Web Service** de la API → **Environment**, añade:

   | Variable | Valor |
   |----------|--------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | (la Internal Database URL de tu PostgreSQL en Render) |
   | `REDIS_URL` | (la URL de Redis en Render) |
   | `JWT_ACCESS_SECRET` | Una cadena aleatoria segura (mín. 32 caracteres) |
   | `JWT_REFRESH_SECRET` | Otra cadena aleatoria distinta |
   | `PLATFORM_ADMIN_EMAIL` | **Tu correo** (ej. jean.serratov@orion.com) |
   | `PLATFORM_ADMIN_PASSWORD` | **Tu contraseña** (mín. 8 caracteres) |
   | `ALLOWED_ORIGINS` | Lo rellenarás en el paso 5 con tu dominio |
   | `FRONTEND_URL` | Lo rellenarás en el paso 5 con tu dominio |

4. **Build Command** del Web Service (ajusta si tu monorepo usa otro):
   - Ejemplo: `npm install && npx prisma generate -w api && npm run build -w api`
5. **Start Command**: algo como `npm run start -w api` o `node apps/api/dist/main.js` (según cómo esté definido en `package.json`).
6. En el **primer deploy** (o en un paso manual), ejecuta migraciones y seed contra la BD de producción:
   - En Render suele hacerse con un **Pre-Deploy** o **Build** que incluya:
     - `npx prisma migrate deploy` (desde la raíz o desde `apps/api`)
     - `npx prisma db seed` (desde `apps/api` o con `-w api` desde raíz)
   - Así se crea **solo tu usuario** (el de `PLATFORM_ADMIN_EMAIL`) y 0 empresas.
7. Anota la **URL del servicio API** (ej. `https://tu-api.onrender.com`).

---

## Paso 3: Web en Vercel

1. Entra en **[vercel.com](https://vercel.com)** e inicia sesión (con GitHub).
2. **Add New** → **Project** → importa el repositorio del proyecto.
3. Configuración:
   - **Root Directory:** `apps/web`
   - **Framework:** Next.js
4. **Environment Variables** (en Vercel → proyecto → Settings → Environment Variables):
   - `NEXT_PUBLIC_API_BASE_URL` = **URL de tu API en Render** (ej. `https://tu-api.onrender.com`, sin barra final).
5. **Deploy**. Anota la URL que te da Vercel (ej. `https://tu-proyecto.vercel.app`). Luego la cambiarás por tu dominio.

---

## Paso 4: Tu dominio en Hostinger → Vercel

1. En **Vercel** → tu proyecto → **Settings** → **Domains** → **Add**.
2. Escribe el dominio que quieras usar (ej. `app.tudominio.com` o `tudominio.com`).
3. Vercel te dirá qué registro DNS crear (normalmente **CNAME** a `cname.vercel-dns.com` o **A** con una IP).
4. En **Hostinger**:
   - Entra en **Dominios** → tu dominio → **Administrar** / **DNS** (Zona DNS).
   - Crea el registro que Vercel indicó:
     - **CNAME:** nombre = `app` (para `app.tudominio.com`) → valor = `cname.vercel-dns.com`.
     - O **A:** nombre = `@` (para la raíz) → valor = IP que te dé Vercel.
5. Guarda y espera la propagación DNS (desde minutos hasta 24–48 h). Cuando Vercel lo verifique, la web se servirá en **tu dominio**.

---

## Paso 5: Decirle a la API cuál es tu dominio (CORS)

1. En **Render** → tu Web Service (API) → **Environment**.
2. Añade o edita:
   - **`ALLOWED_ORIGINS`** = `https://app.tudominio.com` (la URL exacta de tu web con tu dominio; si usas varias, separadas por coma).
   - **`FRONTEND_URL`** = la misma URL (ej. `https://app.tudominio.com`).
3. **Redeploy** del servicio API para que cargue las variables.

---

## Paso 6: (Opcional) Subdominio para la API

Si quieres `api.tudominio.com` en vez de `tu-api.onrender.com`:

1. En **Render** → tu Web Service → **Settings** → **Custom Domain** → añade `api.tudominio.com`.
2. Render te dirá qué CNAME crear. En **Hostinger** (DNS) crea un **CNAME**: nombre `api` → valor el que indique Render.
3. En **Vercel** (web), cambia **`NEXT_PUBLIC_API_BASE_URL`** a `https://api.tudominio.com` y vuelve a desplegar.
4. En **Render** (API), actualiza **`ALLOWED_ORIGINS`** y **`FRONTEND_URL`** si hace falta y redeploy.

---

## Resumen de pasos

| # | Dónde | Qué hacer |
|---|--------|-----------|
| 1 | GitHub | Subir el código del proyecto. |
| 2 | Render | Crear PostgreSQL, Redis y Web Service (API). Variables: `DATABASE_URL`, `REDIS_URL`, `JWT_*`, **`PLATFORM_ADMIN_EMAIL`**, **`PLATFORM_ADMIN_PASSWORD`**. Ejecutar migraciones + seed. |
| 3 | Vercel | Importar repo, root `apps/web`, variable `NEXT_PUBLIC_API_BASE_URL` = URL de la API. Deploy. |
| 4 | Vercel + Hostinger | En Vercel: Domains → añadir tu dominio. En Hostinger: DNS → crear el CNAME o A que indique Vercel. |
| 5 | Render | En la API: `ALLOWED_ORIGINS` y `FRONTEND_URL` = URL de tu web (tu dominio). Redeploy. |
| 6 | Probar | Abrir `https://app.tudominio.com`, iniciar sesión con **tu correo** y **tu contraseña** (las del .env / las que pusiste en Render). |

---

## Entrar al Panel proveedor en producción

- **URL:** la de tu web con tu dominio (ej. `https://app.tudominio.com`).
- **Login:** el **correo** y **contraseña** que configuraste en `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` en Render.
- Verás **Panel proveedor** (Empresas, Nueva empresa, Planes) y 0 empresas hasta que des de alta las que quieras.

---

**Referencias:**  
- `docs/DOMINIO_HOSTINGER_Y_PANEL_PROVEEDOR.md` — detalle correo y DNS  
- `docs/SUBIR_WEB_AL_DOMINIO.md` — web y dominio  
- `docs/DEPLOY.md` — checklist y despliegue API
