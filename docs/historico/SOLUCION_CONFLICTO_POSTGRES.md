# Solución: Conflicto de PostgreSQL en Puerto 5432

## 🔴 Problema Identificado

Tienes **DOS servidores PostgreSQL** intentando usar el mismo puerto `5432`:

1. **PostgreSQL de Docker** (`ce_postgres`) - Usuario: `ce`, Password: `ce_password`
2. **PostgreSQL de Windows** (`postgresql-x64-18`) - Usuario: `postgres`, Password: generada

Cuando Prisma intenta conectarse a `localhost:5432`, Windows puede estar redirigiendo al Postgres local en lugar del de Docker, causando errores de autenticación.

## ✅ Solución Completa

### Opción 1: Detener PostgreSQL de Windows (Recomendado)

**Paso 1:** Abrir Servicios de Windows
- Presiona `Win + R`
- Escribe `services.msc` y presiona Enter

**Paso 2:** Detener PostgreSQL de Windows
- Busca `postgresql-x64-18` (o similar)
- Clic derecho → **Detener**
- Clic derecho → **Propiedades**
- Cambiar "Tipo de inicio" a **Manual** (para que no se inicie automáticamente)

**Paso 3:** Verificar que solo Docker Postgres está activo
```powershell
docker ps
```

Deberías ver solo:
- `ce_postgres` en puerto 5432
- `ce_redis` en puerto 6379

**Paso 4:** Reiniciar contenedores Docker (por si acaso)
```powershell
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica
docker compose -f infra/docker-compose.yml restart
```

**Paso 5:** Verificar conexión
```powershell
cd apps/api
npm run prisma:migrate
```

Si funciona, continúa con los tests.

---

### Opción 2: Cambiar Puerto de PostgreSQL de Windows

Si necesitas mantener ambos Postgres corriendo:

**Paso 1:** Editar configuración de PostgreSQL de Windows
- Buscar archivo `postgresql.conf` en `C:\Program Files\PostgreSQL\18\data\`
- Cambiar `port = 5432` a `port = 5433`
- Reiniciar servicio de PostgreSQL de Windows

**Paso 2:** Verificar que Docker Postgres sigue en 5432
```powershell
docker ps
```

---

## 🧪 Verificar que Funciona

Después de aplicar la solución:

```powershell
# Desde la raíz del proyecto
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica

# Verificar contenedores
docker ps

# Aplicar migraciones
cd apps/api
npm run prisma:migrate

# Ejecutar tests
npm run test:e2e -- backups.e2e-spec.ts
```

---

## 📝 Nota Importante

**Para desarrollo:** Usa solo el Postgres de Docker (`ce_postgres`). Es más fácil de manejar y está configurado específicamente para este proyecto.

**Para producción:** El Postgres de Windows puede ser útil, pero debería estar en un puerto diferente para evitar conflictos.

---

**Fecha:** 2026-01-28  
**Estado:** Solución documentada
