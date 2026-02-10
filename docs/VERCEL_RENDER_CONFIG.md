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
