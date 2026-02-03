# Pasos para inicializar todo el programa

Guía para dejar el proyecto **Comercial Eléctrica** listo desde cero: base de datos, backend y frontend.

---

## Requisitos previos

- **Node.js 18+** (con npm): https://nodejs.org (versión LTS)
- **Docker Desktop**: https://www.docker.com/products/docker-desktop  
  (para PostgreSQL y Redis; en Windows asegúrate de tener WSL actualizado: `wsl --update` si Docker lo pide)

---

## Resumen rápido (orden de comandos)

Ejecuta todo desde la **raíz del proyecto** (`Comercial-Electrica`).

| # | Paso | Comando |
|---|------|--------|
| 1 | Ir a la raíz del proyecto | `cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica` |
| 2 | Instalar dependencias | `npm install` |
| 3 | Crear archivo de entorno | `copy env.example .env` |
| 4 | Iniciar Docker Desktop | Abrirlo y esperar a que esté en marcha |
| 5 | Levantar Postgres y Redis | `npm run db:up` |
| 6 | Generar cliente Prisma | `npm run prisma:generate` |
| 7 | Aplicar migraciones a la BD | `npm run prisma:migrate` |
| 8 | Crear usuario admin y datos de prueba | `npm run db:seed` |
| 9 | (Opcional) Crear roles y permisos RBAC | `npm run prisma:seed` |
| 10 | Levantar API y frontend | `npm run dev` |

---

## Paso 1: Ubicarse en la raíz del proyecto

Todos los comandos se ejecutan desde la carpeta donde están `package.json`, `env.example` y `apps`.

```powershell
cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica
```

Comprueba que estés en el lugar correcto:

```powershell
dir package.json
dir env.example
dir apps
```

---

## Paso 2: Instalar dependencias

```powershell
npm install
```

Se instalan dependencias de la raíz, `apps/api` y `apps/web`. Puede tardar unos minutos.

---

## Paso 3: Variables de entorno

Si no tienes el archivo `.env`, créalo a partir del ejemplo:

```powershell
copy env.example .env
```

Revisa que en `.env` figuren al menos:

- `PORT=3000` (puerto de la API)
- `DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"`
- `REDIS_URL="redis://localhost:6379"`
- `JWT_ACCESS_SECRET` (puedes dejar el valor de ejemplo en desarrollo)

El frontend usa por defecto `http://localhost:3000` para la API. Si cambias el puerto de la API, en `apps/web` crea o edita `.env.local` con:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

## Paso 4: Iniciar Docker Desktop

Abre **Docker Desktop** y espera a que esté completamente iniciado (ícono verde en la bandeja). Sin Docker no se pueden levantar Postgres ni Redis.

---

## Paso 5: Levantar base de datos (PostgreSQL y Redis)

```powershell
npm run db:up
```

Espera 10–15 segundos. Comprueba que los contenedores estén en ejecución:

```powershell
docker ps
```

Debes ver dos contenedores: **ce_postgres** y **ce_redis**.

---

## Paso 6: Generar cliente Prisma

```powershell
npm run prisma:generate
```

Si aparece un error de permisos (EPERM), cierra el IDE, abre PowerShell como administrador y vuelve a ejecutar el comando.

---

## Paso 7: Aplicar migraciones a la base de datos

```powershell
npm run prisma:migrate
```

- Si es la **primera vez**, Prisma puede pedir un nombre para la migración: escribe **`init`** (o el que prefieras) y pulsa Enter.
- Con esto se crean o actualizan todas las tablas en PostgreSQL.

---

## Paso 8: Crear usuario admin y datos de prueba

```powershell
npm run db:seed
```

Esto crea:

- Usuario **administrador**: `admin@example.com` / `Admin123!`
- Usuario **vendedor**: `vendedor@example.com` / `User123!`
- Datos de prueba (categorías, productos, clientes, etc.)

Si la base ya tiene usuarios, el script puede indicar que el bootstrap ya se realizó; en ese caso usa ese usuario o crea uno desde Swagger.

---

## Paso 9 (opcional): Roles y permisos (RBAC)

Si el proyecto usa roles y permisos por tenant:

```powershell
npm run prisma:seed
```

Crea el tenant, permisos, roles (admin/user) y los asigna a los usuarios creados en el paso 8.

---

## Paso 10: Levantar API y frontend

```powershell
npm run dev
```

Se inician:

- **API (NestJS)** en http://localhost:3000  
- **Frontend (Next.js)** en http://localhost:3001  

---

## URLs cuando todo esté levantado

| Servicio   | URL |
|-----------|-----|
| API       | http://localhost:3000 |
| Health    | http://localhost:3000/health |
| Swagger   | http://localhost:3000/api/docs |
| Frontend  | http://localhost:3001 |

---

## Credenciales para iniciar sesión

| Rol    | Email                  | Contraseña  |
|--------|------------------------|-------------|
| Admin  | `admin@example.com`    | `Admin123!` |
| User   | `vendedor@example.com` | `User123!`  |

Abre http://localhost:3001 e inicia sesión con uno de estos usuarios.

---

## Verificación rápida

1. **Health (API):** http://localhost:3000/health → debe devolver JSON con `status`, `database`, `redis`, etc.
2. **Swagger:** http://localhost:3000/api/docs → puedes probar endpoints; usa **Authorize** con el token de `POST /auth/login`.
3. **Frontend:** http://localhost:3001 → login con `admin@example.com` / `Admin123!`.

---

## Si algo falla

| Problema | Qué hacer |
|----------|-----------|
| Puerto 3000 o 3001 en uso | Cierra la aplicación que lo use o cambia `PORT` en `.env` (y en frontend `NEXT_PUBLIC_API_BASE_URL` si aplica). |
| Docker no arranca o `db:up` falla | Abre Docker Desktop, espera a que esté listo y ejecuta de nuevo `npm run db:up`. Si pide actualizar WSL: `wsl --update` como administrador. |
| Error de conexión a la BD | Comprueba que `ce_postgres` esté en marcha (`docker ps`) y que `DATABASE_URL` en `.env` coincida con `infra/docker-compose.yml`. |
| Error de conexión a Redis | Comprueba que `ce_redis` esté en marcha (`docker ps`). La API puede arrancar con avisos de Redis; caché y colas no funcionarán hasta que Redis esté activo. |
| Prisma EPERM | Cierra el IDE, abre PowerShell como administrador y ejecuta `npm run prisma:generate` de nuevo. |
| "npm no se reconoce" | Node.js no está en el PATH: reinstala Node.js marcando "Add to PATH" o abre una terminal nueva. |

---

## Opción automática (script)

Desde la raíz del proyecto puedes usar el script que instala dependencias, crea `.env` si falta, levanta Docker, aplica migraciones y te pregunta si quieres ejecutar el seed:

```powershell
.\scripts\instalar-todo.ps1
```

Luego solo tendrías que ejecutar `npm run dev` para levantar API y frontend.

---

## Levantar solo una parte

- **Solo API:** `npm run dev:api` → API en http://localhost:3000  
- **Solo frontend:** `npm run dev:web` → Frontend en http://localhost:3001 (la API debe estar en 3000 para login y datos)

---

**Última actualización:** Febrero 2026
