# Guía paso a paso: Levantar el proyecto completo

> **Objetivo:** Ejecutar API (NestJS), Frontend (Next.js), Postgres y Redis desde cero.  
> **Requisitos:** Node.js 18+ y npm, **Docker Desktop** (con WSL actualizado: `wsl --update` si Docker pide actualizar WSL).

---

## Resumen rápido (checklist)

**Opción automática (recomendada):** desde la raíz del proyecto ejecuta:
```powershell
.\scripts\instalar-todo.ps1
```
El script instala dependencias, crea `.env` si falta, levanta Docker, aplica migraciones y te pregunta si quieres ejecutar el seed.

**Opción manual:**

| # | Acción | Comando |
|---|--------|---------|
| 1 | Ir a la raíz del proyecto | `cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica` |
| 2 | Instalar dependencias | `npm install` |
| 3 | Crear archivo de entorno | `copy env.example .env` |
| 4 | Levantar Postgres y Redis | `npm run db:up` |
| 5 | Generar cliente Prisma | `npm run prisma:generate` |
| 6 | Aplicar migraciones a la BD | `npm run prisma:migrate` |
| 7 | (Opcional) Crear usuario y datos de prueba | `npm run db:seed` |
| 8 | Levantar API y Frontend | `npm run dev` |

**URLs al terminar:**
- **API:** http://localhost:3000  
- **Health:** http://localhost:3000/health  
- **Swagger:** http://localhost:3000/api/docs  
- **Frontend:** http://localhost:3001  

---

## Paso 1: Ubicarse en la raíz del proyecto

Todos los comandos siguientes se ejecutan desde la **raíz** (donde están `package.json`, `env.example` y la carpeta `apps`).

```powershell
cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica
```

Comprobar que estás en el lugar correcto:

```powershell
dir package.json
dir env.example
dir apps
```

Si no ves esos archivos, vuelve a la carpeta correcta del proyecto.

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

**Resumen del día con IA (opcional):** para que el dashboard muestre el "Resumen del día" generado por IA, añade en `.env` tu clave de OpenAI (sin comillas): `OPENAI_API_KEY=sk-...`. Obtén la clave en [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Si no la configuras, se mostrará el "Resumen automático" (sin LLM).

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

- Si es la **primera vez**, Prisma pedirá un nombre para la migración: escribe **`init`** y pulsa Enter.
- Esto crea o actualiza todas las tablas en Postgres.

---

## Paso 7 (opcional): Datos iniciales y usuario admin

Para tener un usuario con el que loguearte en el frontend y datos de prueba:

```powershell
npm run db:seed
```

- Crea el primer usuario administrador: **email** `admin@example.com`, **contraseña** `Admin123!`
- Si la base ya tiene usuarios, el script puede indicar que el bootstrap ya se hizo; en ese caso usa ese usuario o crea uno desde Swagger (`POST /auth/users` con token de admin).

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

## Verificación rápida (cuando todo esté levantado)

1. **Health (API):**  
   - Abre http://localhost:3000/health  
   - Debe devolver JSON con `status`, `database`, `redis`, etc.

2. **Swagger:**  
   - Abre http://localhost:3000/api/docs  
   - Authorize con el token que obtengas de `POST /auth/login` (email y contraseña del seed).

3. **Frontend:**  
   - Abre http://localhost:3001  
   - Te redirigirá a login; inicia sesión con `admin@example.com` / `Admin123!` (si hiciste el seed).

---

## Si algo falla

| Problema | Qué hacer |
|----------|-----------|
| Puerto 3000 u otro ya en uso | Cierra la app que lo use o cambia `PORT` en `.env` (y en frontend `NEXT_PUBLIC_API_BASE_URL` si aplica). |
| Docker no arranca | Abre Docker Desktop y vuelve a ejecutar `npm run db:up`. Si pide actualizar WSL, ejecuta `wsl --update` como administrador. |
| Error de conexión a BD | Comprueba que `ce_postgres` esté en marcha (`docker ps`) y que `DATABASE_URL` en `.env` coincida con `infra/docker-compose.yml`. |
| Prisma EPERM | Cerrar IDE, ejecutar PowerShell como administrador, `npm run prisma:generate` de nuevo. |
| 500 / Error interno (esquema de base de datos) en /auth/users o /sales | Migraciones pendientes. Desde la raíz: `npm run prisma:migrate`. Luego reinicia la API. |
| "npm no se reconoce" | Node.js no está en el PATH: reinstala Node.js (marca "Add to PATH") o abre una terminal nueva. |
| “Bootstrap ya fue realizado” | Ya hay usuarios; usa ese usuario o crea uno por `POST /auth/users` (con token de admin). |

---

## Qué instalar si falta algo

- **Node.js 18+** (incluye npm): https://nodejs.org — descarga LTS, instala y reinicia la terminal.
- **Docker Desktop**: https://www.docker.com/products/docker-desktop — para Postgres y Redis.
- **WSL**: Si Docker muestra "WSL needs updating", abre PowerShell como **Administrador** y ejecuta `wsl --update`. Luego reinicia Docker Desktop.

---

## Levantar solo API o solo Frontend

- **Solo API:**  
  `npm run dev:api`  
  (API en http://localhost:3000)

- **Solo Frontend:**  
  `npm run dev:web`  
  (Web en http://localhost:3001; la API debe estar levantada en 3000 para que el login y los datos funcionen.)

---

## Cuando el programa esté finalizado

Si el desarrollo está completo y quieres desplegar y operar en producción, sigue la guía:

- **[Pasos cuando el programa esté finalizado](./PASOS_CUANDO_FINALICE.md)** — cierre de desarrollo, despliegue (Vercel + Render), primer usuario, CORS, backups y operación continua.

---

**Última actualización:** Febrero 2026
