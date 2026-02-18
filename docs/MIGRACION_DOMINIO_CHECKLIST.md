# Checklist: migración a tu dominio

Usa este checklist para llevar la app de **Vercel/Render** (ej. orion-web-one.vercel.app) a **tu dominio** (ej. app.tudominio.com).

---

## ¿Qué ya tienes?

Marca lo que ya está hecho:

- [ ] **1. GitHub** — Código en un repo (p. ej. Comercial-Electrica).
- [ ] **2. Render** — PostgreSQL + Redis + Web Service (API) desplegados; variables de entorno (DATABASE_URL, REDIS_URL, JWT_*, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD); migraciones y seed ejecutados.
- [ ] **3. Vercel** — Proyecto importado, root `apps/web`, variable `NEXT_PUBLIC_API_BASE_URL` = URL de la API; deploy funcionando (ej. orion-web-one.vercel.app).
- [ ] **4. Dominio en Hostinger** — Dominio comprado y acceso al panel de DNS (Zona DNS / Administrar dominio).

---

## Pasos para usar tu dominio

### Paso A: Añadir el dominio en Vercel

1. **Vercel** → tu proyecto (web) → **Settings** → **Domains** → **Add**.
2. Escribe el dominio que quieras (ej. `app.tudominio.com` o `tudominio.com`).
3. Vercel te mostrará qué registro DNS crear (normalmente **CNAME** a `cname.vercel-dns.com` o **A** con una IP). **No cierres esta pantalla**; la necesitas para el paso B.

### Paso B: Configurar DNS en Hostinger

1. **Hostinger** → **Dominios** → tu dominio → **Administrar** / **Zona DNS**.
2. Crea el registro que Vercel indicó:
   - **Si es CNAME:** nombre = `app` (para `app.tudominio.com`) → valor = `cname.vercel-dns.com`.
   - **Si es A:** nombre = `@` (para la raíz) → valor = la IP que te dio Vercel.
3. Guarda. La propagación puede tardar desde unos minutos hasta 24–48 h.
4. En **Vercel** → Domains, cuando el DNS esté bien, el dominio aparecerá como **Verified**.

### Paso C: Decirle a la API cuál es tu dominio (CORS)

1. **Render** → tu Web Service (API) → **Environment**.
2. Añade o edita:
   - **`ALLOWED_ORIGINS`** = `https://app.tudominio.com` (la URL exacta de tu web; si usas varias, separadas por coma).
   - **`FRONTEND_URL`** = `https://app.tudominio.com` (para enlaces de “olvidé contraseña”, etc.).
3. **Save**. Render redeploya solo; no hace falta hacer nada más.

### Paso D: Probar

1. Abre **https://app.tudominio.com** (o la URL que hayas configurado).
2. Inicia sesión con tu correo y contraseña (los de PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD).
3. Deberías ver el Panel proveedor. La app ya está en tu dominio.

---

## (Opcional) Subdominio para la API

Si quieres `api.tudominio.com` en lugar de `tu-api.onrender.com`:

1. **Render** → Web Service (API) → **Settings** → **Custom Domain** → añade `api.tudominio.com`.
2. Render te dirá qué CNAME crear. En **Hostinger** (DNS): CNAME `api` → valor que indique Render.
3. **Vercel** (web): cambia **`NEXT_PUBLIC_API_BASE_URL`** a `https://api.tudominio.com` → Redeploy.
4. **Render** (API): **`ALLOWED_ORIGINS`** y **`FRONTEND_URL`** deben incluir tu dominio; si ya los tienes, no hace falta cambiar nada más.

---

**Guía completa:** `docs/MIGRAR_A_MI_DOMINIO_HOSTINGER.md`
