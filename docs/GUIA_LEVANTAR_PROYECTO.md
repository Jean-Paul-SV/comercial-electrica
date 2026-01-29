# Guía paso a paso: Levantar el proyecto completo

> **Objetivo:** Ejecutar API (NestJS), Frontend (Next.js), Postgres y Redis desde cero.  
> **Requisitos:** Node.js 18+, npm, **Docker Desktop** (debe estar abierto y en ejecución antes del Paso 4).

---

## Resumen rápido

| Paso | Comando / Acción |
|------|------------------|
| 1 | Ir a la raíz del proyecto |
| 2 | `npm install` |
| 3 | Copiar `env.example` → `.env` |
| 4 | `npm run db:up` (Docker: Postgres + Redis) |
| 5 | `npm run prisma:generate` |
| 6 | `npm run prisma:migrate` |
| 7 | (Opcional) `npm run db:seed` |
| 8 | `npm run dev` (API + Web a la vez) |

**URLs al terminar:**
- **Frontend:** http://localhost:3001  
- **API:** http://localhost:3000  
- **Swagger:** http://localhost:3000/api/docs  

---

## Paso 1: Ubicarse en la raíz del proyecto

Todos los comandos se ejecutan desde la **raíz** (donde están `package.json`, `env.example` y la carpeta `apps`).

```powershell
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica
```

Comprobar que existe:

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

Si aún no tienes `.env`:

```powershell
copy env.example .env
```

Revisar que `.env` tenga al menos:

- `PORT=3000` (API)
- `DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"`
- `REDIS_URL="redis://localhost:6379"`
- `JWT_ACCESS_SECRET` (puedes dejar el valor de ejemplo en desarrollo)

El frontend usa por defecto `http://localhost:3000` para la API. Si cambias el puerto de la API, en `apps/web` crea o edita `.env.local` con:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

## Paso 4: Levantar Postgres y Redis (Docker)

**Importante:** Abre **Docker Desktop** y espera a que esté completamente iniciado antes de ejecutar:

```powershell
npm run db:up
```

Espera 10–15 segundos y comprueba:

```powershell
docker ps
```

Debes ver dos contenedores: `ce_postgres` y `ce_redis`.

---

## Paso 5: Generar cliente Prisma

Desde la raíz:

```powershell
npm run prisma:generate
```

Si aparece error de permisos (EPERM), cierra el IDE, abre PowerShell como administrador y vuelve a ejecutar el comando. Ver también `docs/SOLUCION_ERROR_EPERM_PRISMA.md`.

---

## Paso 6: Aplicar migraciones

Desde la raíz:

```powershell
npm run prisma:migrate
```

Si es la primera vez y pide nombre de migración, puedes usar `init` o aceptar el que proponga. Esto crea/actualiza las tablas en Postgres.

---

## Paso 7 (opcional): Datos iniciales y usuario admin

Para tener un usuario con el que loguearte en el frontend:

```powershell
npm run db:seed
```

Esto crea el primer usuario administrador (por ejemplo `admin@example.com` / `Admin123!`). Si la base ya tiene usuarios, el seed puede indicar que el bootstrap ya se hizo; en ese caso usa ese usuario o crea uno por API/Swagger.

---

## Paso 8: Levantar API y Frontend

Desde la raíz:

```powershell
npm run dev
```

Con esto se inician:

- **API (NestJS)** en http://localhost:3000  
- **Frontend (Next.js)** en http://localhost:3001  

Cada uno se ejecuta en su propia ventana de terminal (si usas `concurrently`).

---

## Verificación rápida

1. **API:**  
   - http://localhost:3000/health  
   - Debe responder con estado de DB/Redis.

2. **Swagger:**  
   - http://localhost:3000/api/docs  
   - Probar login y otros endpoints.

3. **Frontend:**  
   - http://localhost:3001  
   - Te redirige a login; inicia sesión con el usuario del seed (o el que tengas).

---

## Si algo falla

| Problema | Qué hacer |
|----------|-----------|
| Puerto 3000 u otro ya en uso | Cierra la app que lo use o cambia `PORT` en `.env` (y en frontend `NEXT_PUBLIC_API_BASE_URL` si aplica). |
| Docker no arranca | Abre Docker Desktop y vuelve a ejecutar `npm run db:up`. |
| Error de conexión a BD | Comprueba que `ce_postgres` esté en marcha (`docker ps`) y que `DATABASE_URL` en `.env` coincida con `infra/docker-compose.yml`. |
| Prisma EPERM | Cerrar IDE, ejecutar PowerShell como administrador, `npm run prisma:generate` de nuevo. |
| “Bootstrap ya fue realizado” | Ya hay usuarios; usa ese usuario o crea uno por `POST /auth/users` (con token de admin). |

---

## Levantar solo API o solo Frontend

- **Solo API:**  
  `npm run dev:api`  
  (API en http://localhost:3000)

- **Solo Frontend:**  
  `npm run dev:web`  
  (Web en http://localhost:3001; la API debe estar levantada en 3000 para que el login y los datos funcionen.)

---

**Última actualización:** Enero 2026
