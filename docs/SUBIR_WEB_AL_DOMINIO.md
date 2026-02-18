# Subir la página (web) al dominio

Guía para desplegar la aplicación web (Next.js) y dejarla en tu dominio (Vercel o dominio propio).

---

## 1. Subir la web a Vercel

La web del proyecto está en `apps/web` (Next.js). La forma más rápida es usar **Vercel** (gratis con GitHub).

### Opción A: Desde la web de Vercel (recomendado)

1. Entra en **[vercel.com](https://vercel.com)** e inicia sesión (con GitHub).
2. **Add New** → **Project**.
3. **Import** tu repositorio de GitHub (Comercial-Electrica o el nombre que tenga).
4. **Configuración del proyecto:**
   - **Root Directory:** haz clic en *Edit* y pon: **`apps/web`**.
   - **Framework Preset:** Next.js (Vercel lo detecta).
   - **Build Command:** `npm run build` (por defecto).
   - **Output Directory:** (vacío, por defecto).
5. **Environment Variables** (añade antes de desplegar):
   - **`NEXT_PUBLIC_API_BASE_URL`** = URL de tu API.  
     - Si la API está en **Render:** algo como `https://comercial-electrica-api.onrender.com` (sin barra final).  
     - Si aún no tienes API en producción: puedes poner temporalmente la URL de Render que te den al desplegar la API, o dejarla y añadirla después (entonces la web no podrá hacer login hasta que la configures).
6. Pulsa **Deploy**.  
   Cuando termine, Vercel te dará una URL tipo:  
   **`https://comercial-electrica-xxx.vercel.app`**  
   Esa ya es tu “dominio” por defecto.

### Opción B: Desde la terminal (Vercel CLI)

```bash
npm i -g vercel
vercel login
cd apps/web
vercel
```

Sigue las preguntas (link a proyecto existente o nuevo). Luego en el **Dashboard de Vercel** → tu proyecto → **Settings** → **Environment Variables** añade **`NEXT_PUBLIC_API_BASE_URL`** con la URL de tu API (ej. `https://tu-api.onrender.com`).  
Vuelve a desplegar: **Deployments** → **Redeploy** (o `vercel --prod` desde `apps/web`).

---

## 2. Usar tu dominio propio

Si ya tienes un dominio (ej. `app.midominio.com` o `orion.com`):

1. En **Vercel** → tu proyecto → **Settings** → **Domains**.
2. **Add** → escribe tu dominio (ej. `app.midominio.com`).
3. Vercel te indica qué registros DNS crear en tu proveedor (donde compraste el dominio):
   - Normalmente un **CNAME** que apunte a `cname.vercel-dns.com`, o
   - Un **A** con la IP que te indique Vercel.
4. Guarda los cambios en el DNS y espera a que propague (minutos u horas).  
   Cuando Vercel vea el dominio correcto, la web quedará servida en **tu dominio**.

Tu “página” ya está subida a ese dominio.

---

## 3. Que la API acepte tu dominio (CORS)

Para que el navegador permita llamadas desde tu web (login, datos, etc.), la **API** debe tener configurado ese dominio en CORS.

- Si la API está en **Render:**  
  **Dashboard** → servicio de la API → **Environment** → variable **`ALLOWED_ORIGINS`**:
  - Con dominio de Vercel:  
    `https://comercial-electrica-xxx.vercel.app`
  - Con dominio propio:  
    `https://app.midominio.com`  
  (si tienes varios, sepáralos por coma, sin espacios).
- **`FRONTEND_URL`** en la API (Render): pon la misma URL de la web (ej. `https://app.midominio.com` o la de Vercel). Se usa para enlaces en correos y flujos de facturación.

Después de cambiar variables en Render, haz **Redeploy** del servicio API para que tome los cambios.

---

## 4. Resumen rápido

| Paso | Dónde | Qué hacer |
|------|--------|-----------|
| 1 | Vercel | Importar repo, root `apps/web`, variable `NEXT_PUBLIC_API_BASE_URL` = URL de la API. |
| 2 | Vercel | (Opcional) Domains → añadir tu dominio y configurar DNS. |
| 3 | Render (API) | `ALLOWED_ORIGINS` = URL de tu web; `FRONTEND_URL` = misma URL. |
| 4 | Probar | Abrir la URL de la web (Vercel o tu dominio) y hacer login. |

Cuando esto esté hecho, la página está subida al dominio que tengas configurado (el de Vercel o el tuyo).
