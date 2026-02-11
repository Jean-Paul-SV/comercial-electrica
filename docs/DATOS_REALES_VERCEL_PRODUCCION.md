# Ver datos reales en Vercel (producción)

La **web en Vercel** muestra lo que devuelve la **API en Render**. Esa API usa la **base de datos PostgreSQL** de Render. Para que en Vercel se vean productos, ventas, clientes, etc., hay que **cargar esos datos en la base de producción** (la de Render), no en Redis ni en ningún otro sitio.

---

## Resumen

| Dónde está | Qué hace |
|------------|----------|
| **Vercel** | Solo la web (frontend). No tiene base de datos. |
| **Render** | API + PostgreSQL. Los datos “reales” están en esta PostgreSQL. |
| **Redis** (ej. Upstash) | Colas y caché. No guarda productos ni ventas. |

Para ver datos en la URL de Vercel: **llenar la PostgreSQL de Render** con el seed (roles + 500 datos).

---

## Pasos para cargar datos en producción

### 1. Tener la API y la BD en Render ya desplegadas

- Servicio **comercial-electrica-api** en Live.
- Base de datos **comercial-electrica-db** creada y enlazada (Render inyecta `DATABASE_URL` en la API).

### 2. Obtener la URL de la base de datos de producción

En **Render**:

1. Entra al **database** `comercial-electrica-db`.
2. En **Connect**, copia la **External Database URL** (la que permite conexión desde fuera de Render).  
   Si solo usas la Internal URL, los scripts desde tu PC no podrán conectarse; en ese caso tendrías que ejecutar los seeds desde un job o desde la API (no está previsto por defecto).

Guárdala como `DATABASE_URL` para usarla en el paso siguiente (solo en tu máquina, no la subas al repo).

### 3. Ejecutar migraciones (si no se aplican solas)

En cada deploy, Render ya ejecuta `npx prisma migrate deploy` antes de arrancar la API. Si tu servicio está desplegado, las tablas ya deberían existir. Si creaste la BD nueva y aún no has desplegado, haz un deploy de la API y listo.

### 4. Ejecutar el seed de roles y tenant (una vez)

Desde tu **PC**, en la raíz del proyecto, con la **URL de producción** en `DATABASE_URL`:

```bash
# Poner la URL de Render (solo para este comando; no la dejes en .env si es la de prod)
set DATABASE_URL=postgresql://usuario:password@host/database?sslmode=require
npm run prisma:seed -w api
```

(Sustituye por la External Database URL real de Render. En PowerShell puedes usar `$env:DATABASE_URL = "postgresql://..."`.)

### 5. Cargar los 500+ datos reales (productos, ventas, clientes…)

Desde la **misma carpeta** y con la **misma** `DATABASE_URL` de producción:

```bash
node scripts/seed-500-real.js --clean --force
```

- `--clean`: borra datos de negocio del tenant por defecto y vuelve a crear todo.
- `--force`: necesario porque la URL no es `localhost` (el script por seguridad pide confirmación para no local).

Esto crea:

- Usuarios: `admin@example.com` / `Admin123!` y `vendedor@example.com` / `User123!`
- Categorías, productos, clientes, proveedores, ventas, cotizaciones, caja, gastos, etc.

### 6. Comprobar en Vercel

1. Abre la URL de tu web en Vercel (ej. `https://comercial-electrica-web.vercel.app`).
2. Inicia sesión con **admin@example.com** / **Admin123!**.
3. Deberías ver dashboard, ventas, productos, clientes, reportes, etc. con datos.

---

## Resumen de comandos (desde tu PC, con DATABASE_URL de producción)

```bash
# 1. Variable solo para esta sesión (PowerShell)
$env:DATABASE_URL = "postgresql://USER:PASS@HOST/DB?sslmode=require"

# 2. Seed de roles y tenant
npm run prisma:seed -w api

# 3. Seed de 500 datos (productos, ventas, clientes…)
node scripts/seed-500-real.js --clean --force
```

Luego entra en la web en Vercel con **admin@example.com** / **Admin123!**.

---

## Si no tienes External Database URL en Render

En el plan **free** de Render, a veces solo se muestra la **Internal** URL (accesible solo desde otros servicios de Render). En ese caso:

- **Opción A:** Usar un **túnel** (ej. ngrok) hacia tu API y que un script local llame a un endpoint que ejecute el seed (tendrías que crear ese endpoint solo para uso interno).
- **Opción B:** Subir a un plan de Render que dé **External Database URL** y ejecutar los comandos de arriba desde tu PC.
- **Opción C:** Crear un **Background Worker** o **Cron Job** en Render que, una sola vez, ejecute `prisma db seed` y `node scripts/seed-500-real.js --clean --force` usando la Internal Database URL (el worker sí está en la misma red que la BD).

Si me dices si tienes o no External URL, se puede detallar la opción que prefieras.

---

## Importante

- **Redis:** No hace falta “poner” datos ahí. La API lo usa para colas y caché. Solo tiene que estar configurado (`REDIS_URL` en Render).
- **Vercel:** No tiene base de datos. Solo sirve el front y llama a la API de Render. Los datos que ves vienen de la PostgreSQL de Render.
- **Contraseñas:** En producción conviene cambiar las de los usuarios de prueba (`Admin123!`, `User123!`) desde la propia app una vez cargados los datos.
