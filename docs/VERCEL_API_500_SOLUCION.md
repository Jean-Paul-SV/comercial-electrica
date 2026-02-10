# API en Vercel da 500 – "Falta DATABASE_URL"

## El error

En **https://comercial-electrica-api.vercel.app/** la API cae con:

```
Error: Falta variable de entorno requerida: DATABASE_URL
```

Eso significa que la **función serverless** que atiende esa URL **no recibe** las variables de entorno que configuraste.

---

## Opción 1: No usar la API en Vercel (recomendado)

Tu API en **Render** ya funciona y la web puede usarla.

**Qué hacer:**

1. En Vercel, entra al proyecto **comercial-electrica-web** (el del front).
2. **Settings** → **Environment Variables**.
3. Asegúrate de tener:
   - **Name:** `NEXT_PUBLIC_API_BASE_URL`
   - **Value:** `https://comercial-electrica-api.onrender.com`
   - **Environments:** Production y Preview marcados.
4. Guarda y redeploy del proyecto **web** si cambiaste algo.

A partir de ahí, la web solo llama a la API de Render. La URL **comercial-electrica-api.vercel.app** puedes ignorarla o, si quieres dejar de desplegar la API en Vercel:

- En el dashboard de Vercel, entra al proyecto que se llama **comercial-electrica-api**.
- **Settings** → al final, **Delete Project** (o desvincula el repo para que no se redespliegue).

Así dejas de tener 500 en esa URL y sigues usando solo Render para la API.

---

## Opción 2: Hacer que la API en Vercel funcione

Solo tiene sentido si necesitas que **comercial-electrica-api.vercel.app** responda.

### Paso 1: Saber qué proyecto sirve esa URL

En Vercel:

1. Ve a **Dashboard** (lista de proyectos).
2. Busca el proyecto cuya **URL de producción** sea **comercial-electrica-api.vercel.app** (suele llamarse **comercial-electrica-api**).
3. Entra **solo** a ese proyecto. Las variables de entorno deben estar **ahí**, no en el proyecto de la web.

### Paso 2: Variables en ese proyecto

En ese proyecto (**comercial-electrica-api**):

1. **Settings** → **Environment Variables**.
2. Añade o edita (con **Production** y **Preview** marcados):

   | Key                 | Valor |
   |---------------------|--------|
   | `DATABASE_URL`      | Tu URL de PostgreSQL (ej. la de Render) |
   | `REDIS_URL`         | Solo la URL, ej. `rediss://default:...@allowed-goblin-45457.upstash.io:6379` (sin `redis-cli --tls -u`) |
   | `JWT_ACCESS_SECRET` | Mismo que en Render |
   | `JWT_REFRESH_SECRET`| Mismo que en Render |
   | `ALLOWED_ORIGINS`   | `https://comercial-electrica-web.vercel.app` |
   | `NODE_ENV`          | `production` |

3. En **cada** variable, marca **Production** (y **Preview** si usas previews).
4. Pulsa **Save** (o "Save, rebuild, and deploy" si aparece).

### Paso 3: Redeploy

1. En el **mismo** proyecto, ve a **Deployments**.
2. En el último deployment, menú (⋮) → **Redeploy**.
3. Espera a que termine (estado "Ready").

Las variables se inyectan en el momento del deploy. Si no redeployas después de guardar, el código que está corriendo sigue sin verlas.

### Paso 4: Si sigue fallando

- Confirma que estás en el proyecto correcto: el que al hacer clic en "Visit" te lleva a **comercial-electrica-api.vercel.app**.
- En **Settings** → **General**, revisa **Root Directory** y **Build Command**. No hace falta cambiarlos solo por este error; sirve para confirmar que es el proyecto de la API.
- Si en tu equipo hay más gente, que alguien con permisos revise que las variables estén en **Production** y que no haya otro proyecto sirviendo esa URL.

---

## Resumen

| Objetivo | Dónde actuar |
|----------|----------------|
| Que la web funcione usando la API de Render | Proyecto **comercial-electrica-web**: `NEXT_PUBLIC_API_BASE_URL` = `https://comercial-electrica-api.onrender.com`. No hace falta tocar la API en Vercel. |
| Que comercial-electrica-api.vercel.app deje de dar 500 | Proyecto **comercial-electrica-api**: añadir variables, marcar Production, **Save** y **Redeploy**. |
| Dejar de desplegar la API en Vercel | En el proyecto **comercial-electrica-api**, desvincular el repo o borrar el proyecto. |

Si con la **Opción 1** tienes la web apuntando a Render y no necesitas la API en Vercel, puedes ignorar los 500 de comercial-electrica-api.vercel.app o eliminar ese proyecto y listo.

---

## Volver a subir todo (Render + Vercel) desde cero

Si bajas los servicios y los vuelves a subir, sigue este orden para que quede bien:

1. **Render (API)**  
   - Crear o reconectar el servicio de la API.  
   - Añadir **todas** las variables de entorno (DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ALLOWED_ORIGINS, etc.) **antes** del primer deploy.  
   - Deploy y esperar a que esté "Live".  
   - Anotar la URL de la API (ej. `https://comercial-electrica-api.onrender.com`).

2. **Vercel (web)**  
   - Crear o reconectar el proyecto del front (comercial-electrica-web).  
   - En **Environment Variables** añadir **antes** del primer deploy:  
     `NEXT_PUBLIC_API_BASE_URL` = URL de la API de Render (la del paso 1), con **Production** y **Preview** marcados.  
   - Deploy.

3. **Render – CORS**  
   - En el servicio de la API en Render, variable `ALLOWED_ORIGINS` = URL de la web en Vercel (ej. `https://comercial-electrica-web.vercel.app`), sin barra final.  
   - Guardar (Render redespliega solo).

4. **Comprobar**  
   - Abrir la web en Vercel, iniciar sesión o hacer una acción que llame a la API.  
   - Si algo falla, revisar Logs en Vercel y en Render.

Si no vas a usar la API en Vercel, no hace falta crear el proyecto comercial-electrica-api en Vercel; solo Render (API) + Vercel (web) con la URL de la API bien puesta.
