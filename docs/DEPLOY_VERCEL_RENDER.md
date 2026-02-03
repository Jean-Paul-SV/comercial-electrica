# Despliegue en Vercel (frontend) + Render (API + PostgreSQL)

Guía paso a paso para dejar la aplicación funcionando en la nube de forma **gratuita** para pruebas:

- **Vercel**: frontend Next.js (`apps/web`)
- **Render**: API NestJS + PostgreSQL (`apps/api`)

---

## Requisitos previos

- Cuenta en [GitHub](https://github.com) con el repositorio subido
- Cuenta en [Vercel](https://vercel.com) (gratis, con GitHub)
- Cuenta en [Render](https://render.com) (gratis, con GitHub)
- Cuenta en [Upstash](https://upstash.com) (gratis) para Redis (la API lo requiere)

---

## Parte 1: API + base de datos en Render

### 1.1 Conectar el repositorio con Render

1. Entra en [dashboard.render.com](https://dashboard.render.com) e inicia sesión con GitHub.
2. Clic en **New** → **Blueprint**.
3. Conecta el repositorio de GitHub donde está el proyecto (si no está, autoriza a Render).
4. Render detectará el archivo `render.yaml` en la raíz del repo. Confirma y clic en **Apply**.
5. En la pantalla de variables con **sync: false**, te pedirá valores para:
   - **ALLOWED_ORIGINS** – Déjalo vacío por ahora; lo rellenarás después con la URL de Vercel.
   - **REDIS_URL** – Lo obtendrás en el paso 1.2.
   - **FRONTEND_URL** – Lo rellenarás después con la URL de Vercel (ej. `https://tu-proyecto.vercel.app`).
6. Crea una base Redis gratuita en Upstash (siguiente paso) y vuelve a **Environment** del servicio **comercial-electrica-api** en Render para pegar **REDIS_URL**.
7. Guarda y deja que Render haga el primer deploy (build + migraciones + arranque).

### 1.2 Redis gratis (Upstash)

La API usa Redis (cache y colas BullMQ). En el tier gratis de Render no hay Redis; se usa Upstash (gratis):

1. Entra en [console.upstash.com](https://console.upstash.com) y crea cuenta.
2. **Create Database** → elige región cercana a **Oregon** (donde está la API en Render).
3. Tipo **Regional**, plan **Free**.
4. Tras crear, en **Details** copia **Redis URL** (ej. `rediss://default:xxx@xxx.upstash.io:6379`).
5. En Render → servicio **comercial-electrica-api** → **Environment** → pega en **REDIS_URL**.

### 1.3 URLs de la API en Render

Cuando el deploy termine, en la pestaña del servicio verás algo como:

- **URL del servicio**: `https://comercial-electrica-api.onrender.com`

Guarda esta URL; la usarás en Vercel como `NEXT_PUBLIC_API_BASE_URL`.

### 1.4 Crear usuario para poder iniciar sesión (seed en producción)

La base de Render viene vacía de usuarios. Para poder entrar con `admin@example.com` / `Admin123!`:

1. En **Render** → base de datos **comercial-electrica-db** → **Connect**.
2. Copia la **External Database URL** (para ejecutar desde tu PC; no uses Internal).
3. En tu PC, desde la **raíz del proyecto**, ejecuta **solo esta vez** (sustituye `TU_EXTERNAL_URL` por la URL copiada):
   ```bash
   set DATABASE_URL=TU_EXTERNAL_URL
   node scripts/seed-dev.js --force
   ```
   En PowerShell:
   ```powershell
   $env:DATABASE_URL="TU_EXTERNAL_URL"; node scripts/seed-dev.js --force
   ```
   **Importante:** `--force` es necesario porque el script por defecto solo permite bases locales; con `--force` acepta la URL de Render.
4. No uses `--clean` si no quieres borrar datos; `--force` sin `--clean` crea solo los usuarios si no existen.
5. Tras el seed, restaura tu `.env` local (o cierra la terminal) para no seguir apuntando a producción.

**Credenciales creadas:** `admin@example.com` / `Admin123!` (y opcionalmente `vendedor@example.com` / `User123!`).

---

## Parte 2: Frontend en Vercel

### 2.1 Crear proyecto en Vercel

1. Entra en [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. **Add New** → **Project**.
3. Importa el mismo repositorio de GitHub.
4. Configuración del proyecto:
   - **Root Directory**: haz clic en **Edit** y selecciona **`apps/web`**.
   - **Framework Preset**: Next.js (debería detectarse solo).
   - **Build Command**: `npm run build` (por defecto).
   - **Output Directory**: por defecto (Next.js).
5. **Environment Variables** – Añade:
   - **Name**: `NEXT_PUBLIC_API_BASE_URL`  
   - **Value**: `https://comercial-electrica-api.onrender.com`  
     (sustituye por la URL real de tu API en Render si es distinta).
6. **Deploy**.

### 2.2 URL del frontend

Al terminar el deploy, Vercel te dará una URL tipo:

- `https://comercial-electrica-xxx.vercel.app`

Cópiala.

---

## Parte 3: Enlazar frontend y API (CORS y variables)

### 3.1 CORS en Render

Para que el frontend en Vercel pueda llamar a la API en Render:

1. Render → servicio **comercial-electrica-api** → **Environment**.
2. **ALLOWED_ORIGINS**: pon la URL de Vercel, por ejemplo:  
   `https://comercial-electrica-xxx.vercel.app`  
   Si tienes más dominios (preview, producción), sepáralos por coma.
3. **FRONTEND_URL**: misma URL del frontend (ej. `https://comercial-electrica-xxx.vercel.app`).
4. Guarda cambios; Render hará un redeploy automático.

### 3.2 Comprobar que todo funciona

1. Abre la URL de Vercel en el navegador.
2. Inicia sesión (o regístrate si la app lo permite); las peticiones deben ir a la API en Render.
3. Si la API estuvo inactiva, el primer request puede tardar ~1 minuto (plan gratis de Render “despierta” el servicio).

---

## Resumen de variables

| Dónde   | Variable                     | Valor / Origen |
|---------|------------------------------|----------------|
| Render  | `DATABASE_URL`                | Automático (Blueprint + PostgreSQL) |
| Render  | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Generados por Render |
| Render  | `REDIS_URL`                   | Upstash → Redis URL |
| Render  | `ALLOWED_ORIGINS`             | URL(s) del frontend en Vercel |
| Render  | `FRONTEND_URL`                | URL del frontend en Vercel |
| Vercel  | `NEXT_PUBLIC_API_BASE_URL`    | URL del servicio API en Render |

---

## Limitaciones del tier gratis

- **Render (free)**  
  - El servicio se “duerme” tras ~15 min sin tráfico.  
  - La primera petición tras eso puede tardar ~1 minuto.  
  - Adecuado para pruebas y demos, no para producción estable.

- **Vercel**  
  - Límites de uso del plan gratuito (ancho de banda, builds).  
  - Suficiente para desarrollo y pruebas.

- **Upstash (free)**  
  - Límite de comandos/día; suficiente para uso ligero.

---

## Estructura de archivos usados

- **Raíz del repo**: `render.yaml` – define en Render la base PostgreSQL y el servicio web de la API.
- **apps/web**: `vercel.json` – opcional; refuerza que el proyecto es Next.js para Vercel.

Si cambias de rama o de repo, actualiza en Render y Vercel la rama conectada y las variables si cambian las URLs.
