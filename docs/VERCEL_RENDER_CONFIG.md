# Configuración Vercel (web) + Render (API) – Evitar "Failed to fetch"

Para que la app web en Vercel pueda llamar a la API en Render sin errores de red o CORS, hay que configurar **dos cosas**.

---

## 1. Vercel: URL de la API

La web usa la variable `NEXT_PUBLIC_API_BASE_URL`. Si no está definida, intenta usar `http://localhost:3000` y las peticiones fallan en producción.

**Pasos:**

1. Entra en **Vercel** → proyecto **comercial-electrica-web**.
2. **Settings** → **Environment Variables**.
3. Añade (o edita):
   - **Name:** `NEXT_PUBLIC_API_BASE_URL`
   - **Value:** `https://comercial-electrica-api.onrender.com`  
     (sin barra final; usa tu URL de Render si es distinta)
   - **Environment:** Production (y Preview si quieres que los previews también usen la API).
4. Guarda y haz un **Redeploy** del proyecto para que la variable se aplique.

---

## 2. Render: CORS (ALLOWED_ORIGINS)

La API en Render solo acepta peticiones desde orígenes que estén en `ALLOWED_ORIGINS`. Si el origen de la web (Vercel) no está, el navegador bloquea la petición y verás "Failed to fetch" o errores CORS.

**Pasos:**

1. Entra en **Render** → servicio **comercial-electrica-api**.
2. **Environment** (o **Environment Variables**).
3. Añade o edita:
   - **Key:** `ALLOWED_ORIGINS`
   - **Value:** `https://comercial-electrica-web.vercel.app`  
     (exactamente la URL de tu app en Vercel, **sin** barra final)
4. Si usas más de un dominio (por ejemplo un dominio propio), sepáralos por coma:
   - `https://comercial-electrica-web.vercel.app,https://app.midominio.com`
5. Guarda. Render hará un redeploy automático.

---

## Comprobar

1. En Vercel: redeploy y espera a que termine.
2. En Render: que el servicio esté en estado "Live" y que `ALLOWED_ORIGINS` tenga la URL de Vercel.
3. Abre la web en Vercel, inicia sesión o haz una acción que llame a la API.  
   Si todo está bien, ya no deberías ver "Failed to fetch".

---

## Resumen

| Dónde  | Variable                    | Valor (ejemplo)                              |
|--------|-----------------------------|----------------------------------------------|
| Vercel | `NEXT_PUBLIC_API_BASE_URL`  | `https://comercial-electrica-api.onrender.com` |
| Render | `ALLOWED_ORIGINS`           | `https://comercial-electrica-web.vercel.app`   |

Ambas deben coincidir con tus URLs reales de Vercel y Render.

---

## Si despliegas la API en Vercel (comercial-electrica-api)

Si tienes un proyecto en Vercel que despliega la API (p. ej. `comercial-electrica-api.vercel.app`), la app **no arranca** si faltan variables de entorno. Verás:

`Error: Falta variable de entorno requerida: DATABASE_URL`

**Variables obligatorias** en ese proyecto (Settings → Environment Variables):

| Variable              | Uso |
|-----------------------|-----|
| `DATABASE_URL`        | URL de PostgreSQL |
| `REDIS_URL`            | URL de Redis |
| `JWT_ACCESS_SECRET`    | Debe coincidir con Render si compartes sesiones |
| `JWT_REFRESH_SECRET`   | Obligatorio en producción; mismo valor que en Render |

Opcional: `ALLOWED_ORIGINS` (orígenes CORS permitidos).

**Recomendación:** La API en producción está en **Render**. El front en Vercel ya apunta ahí. No es necesario desplegar la API también en Vercel; puedes usar solo Render para la API y evitar configurar DB/Redis/JWT dos veces.

---

## Cómo levantar comercial-electrica-api.vercel.app (cuando está caído)

Si la API en Render está bien pero **https://comercial-electrica-api.vercel.app/** sigue caída (500, "Falta DATABASE_URL"), haz esto **en el proyecto comercial-electrica-api** de Vercel:

### 1. Variables de entorno

- **Settings** → **Environment Variables**.
- Asegúrate de tener (y que **no** tengan espacios o el comando de redis-cli en REDIS_URL):

  | Variable | Ejemplo / formato |
  |----------|-------------------|
  | `DATABASE_URL` | `postgresql://user:pass@host/db` |
  | `REDIS_URL` | **Solo la URL**, ej. `rediss://default:TOKEN@allowed-goblin-45457.upstash.io:6379` (sin `redis-cli --tls -u`) |
  | `JWT_ACCESS_SECRET` | Mismo valor que en Render |
  | `JWT_REFRESH_SECRET` | Mismo valor que en Render |
  | `ALLOWED_ORIGINS` | `https://comercial-electrica-web.vercel.app` |
  | `NODE_ENV` | `production` |

### 2. Asignar a Production (y Preview)

- En **cada** variable, marca el entorno donde se usa:
  - **Production** ✅ (obligatorio para comercial-electrica-api.vercel.app).
  - **Preview** ✅ (si quieres que los previews también tengan env).
- Si solo está en "Preview" o "Development", en Production la variable **no existe** y seguirás viendo "Falta DATABASE_URL".

### 3. Guardar y redeploy

- Pulsa **Save** (o "Save, rebuild, and deploy" si lo ofrece la pantalla).
- Ve a **Deployments** → último deployment → menú (⋮) → **Redeploy**.
- Espera a que el nuevo deploy termine (estado "Ready").

Las variables se inyectan **en el deploy**. Si añadiste o corregiste variables pero no redeployaste, el código en ejecución sigue sin verlas.

### 4. Si sigue caído

- Revisa **Logs** del proyecto comercial-electrica-api (filtrar por el horario del último deploy).
- Si el error pasa de "DATABASE_URL" a otro (p. ej. Redis o conexión DB), corrige ese punto (REDIS_URL, firewall, etc.).
