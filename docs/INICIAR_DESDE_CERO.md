# Iniciar el proyecto desde cero (sin base de datos)

Pasos para levantar **base de datos**, **crear credenciales** y **ejecutar el proyecto** cuando empiezas sin nada.

**Requisitos:** Node.js 18+, npm, Docker Desktop (para Postgres y Redis).

---

## 1. Ubicarse en la raíz del proyecto

```powershell
cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica
```

---

## 2. Variables de entorno

Si no tienes `.env`, créalo desde el ejemplo:

```powershell
copy env.example .env
```

Revisa que `.env` tenga al menos:

- `DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"`
- `JWT_ACCESS_SECRET` (puedes dejar el valor de ejemplo en desarrollo)
- `REDIS_URL="redis://localhost:6379"` (opcional si no usas Redis)

---

## 3. Instalar dependencias

```powershell
npm install
```

---

## 4. Levantar Postgres (y Redis) con Docker

Abre **Docker Desktop** y espera a que esté en marcha. Luego:

```powershell
npm run db:up
```

Espera unos 10–15 segundos. Comprueba con `docker ps` que estén los contenedores `ce_postgres` y `ce_redis`.

---

## 5. Generar cliente Prisma y aplicar migraciones

```powershell
npm run prisma:generate
npm run prisma:migrate
```

Si pide un nombre de migración, puedes usar `init` y Enter. Con esto se crean todas las tablas en la base de datos.

---

## 6. Crear usuarios y roles (credenciales para entrar)

**6.1 – Usuarios de desarrollo (admin + vendedor):**

```powershell
npm run db:seed
```

Crea:

- **ADMIN:** `admin@example.com` / `Admin123!`
- **USER:** `vendedor@example.com` / `User123!`

**6.2 – Roles y permisos (RBAC):**

```powershell
npm run prisma:seed
```

Crea Tenant, permisos, roles (admin/user) y los asigna a los usuarios anteriores.

---

## 7. Levantar API y frontend

```powershell
npm run dev
```

- **API:** http://localhost:3000  
- **Frontend:** http://localhost:3001  
- **Swagger:** http://localhost:3000/api/docs  

---

## Credenciales para iniciar sesión

| Rol   | Email               | Contraseña  |
|-------|----------------------|-------------|
| Admin | `admin@example.com`  | `Admin123!` |
| User  | `vendedor@example.com` | `User123!` |

Abre http://localhost:3001 e inicia sesión con uno de estos usuarios.

---

## Resumen de comandos (orden)

```powershell
cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica
copy env.example .env
npm install
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run prisma:seed
npm run dev
```

---

## Poblar la base de datos (100 o 10.000 elementos)

**Opción A – Solo usuarios (mínimo)**  
Ya lo haces con los pasos 6.1 y 6.2 (`db:seed` + `prisma:seed`).

**Opción B – 100 de cada entidad (rápido)**

1. Migraciones aplicadas (`npm run prisma:migrate`).
2. Ejecuta:

```powershell
npm run db:seed:100
```

Crea 100 categorías, 100 productos, 100 clientes, 100 proveedores, 100 ventas, 100 cotizaciones, etc., más los 2 usuarios (admin y vendedor).

3. Asigna roles:

```powershell
npm run prisma:seed
```

**Opción C – 10.000 de cada entidad (dataset grande)**

1. Migraciones aplicadas (`npm run prisma:migrate`).
2. Ejecuta (tarda varios minutos):

```powershell
npm run db:seed:10k
```

3. Luego: `npm run prisma:seed`.

**Otra cantidad (ej. 500):**

```powershell
node scripts/seed-10k.js --clean --count 500
```

**Nota:** `db:seed:100` y `db:seed:10k` usan `--clean`: borran datos de negocio y usuarios antes de crear todo. No los uses en producción.
