# 🔧 Solución Inmediata: Error de Autenticación PostgreSQL

## 🔴 Problema Actual

```
Error: P1000: Authentication failed against database server at `localhost`, 
the provided database credentials for `(not available)` are not valid.
```

**Causa:** Hay DOS servidores PostgreSQL intentando usar el puerto 5432:
- PostgreSQL de Docker (`ce_postgres`) - Usuario: `ce`, Password: `ce_password`
- PostgreSQL de Windows (servicio local) - Usuario: `postgres`, Password diferente

Cuando Prisma intenta conectarse, Windows puede estar redirigiendo al Postgres local en lugar del de Docker.

---

## ✅ Solución Paso a Paso

### Paso 1: Detener PostgreSQL de Windows

**Opción A - Desde PowerShell (como Administrador):**
```powershell
# Buscar servicios de PostgreSQL
Get-Service | Where-Object { $_.Name -like "*postgres*" }

# Detener el servicio (reemplaza NOMBRE_SERVICIO con el nombre real)
Stop-Service -Name "postgresql-x64-18" -Force

# Cambiar a Manual para que no se inicie automáticamente
Set-Service -Name "postgresql-x64-18" -StartupType Manual
```

**Opción B - Desde Interfaz Gráfica:**
1. Presiona `Win + R`
2. Escribe `services.msc` y presiona Enter
3. Busca `postgresql-x64-18` (o similar)
4. Clic derecho → **Detener**
5. Clic derecho → **Propiedades**
6. Cambiar "Tipo de inicio" a **Manual**

---

### Paso 2: Verificar que Docker Postgres está corriendo

```powershell
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica
docker ps
```

Deberías ver:
- `ce_postgres` en puerto `0.0.0.0:5432->5432/tcp`
- `ce_redis` en puerto `0.0.0.0:6379->6379/tcp`

Si NO están corriendo:
```powershell
npm run db:up
```

---

### Paso 3: Reiniciar contenedores Docker (limpiar estado)

```powershell
# Detener y eliminar volúmenes (esto borra la base de datos)
docker compose -f infra/docker-compose.yml down -v

# Volver a iniciar
docker compose -f infra/docker-compose.yml up -d

# Esperar 5 segundos para que Postgres inicie
Start-Sleep -Seconds 5
```

---

### Paso 4: Verificar conexión directa a Docker Postgres

```powershell
docker exec ce_postgres psql -U ce -d comercial_electrica -c "SELECT version();"
```

Si funciona, verás la versión de PostgreSQL. Si falla, el problema está en Docker.

---

### Paso 5: Aplicar migraciones de Prisma

```powershell
cd apps/api
npm run prisma:migrate
```

**Si esto funciona**, el problema estaba resuelto. Continúa con los tests.

**Si sigue fallando**, verifica el archivo `.env`:

```powershell
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica
Get-Content .env | Select-String "DATABASE_URL"
```

Debe mostrar:
```
DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"
```

---

### Paso 6: Ejecutar tests

```powershell
cd apps/api
npm run test:e2e -- backups.e2e-spec.ts
```

---

## 🛠️ Script de Verificación Automática

He creado un script que verifica todo automáticamente:

```powershell
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica
.\scripts\verificar-postgres.ps1
```

Este script te mostrará:
- Estado de Docker
- Contenedores corriendo
- Servicios de PostgreSQL de Windows
- Puerto 5432
- Conexión a Docker Postgres
- Configuración del `.env`

---

## 📝 Notas Importantes

1. **Para desarrollo:** Usa solo el Postgres de Docker. Es más fácil de manejar y está configurado específicamente para este proyecto.

2. **Si necesitas ambos Postgres:** Cambia el puerto del Postgres de Windows a 5433 editando `postgresql.conf` en `C:\Program Files\PostgreSQL\18\data\`.

3. **Verificación rápida:** Si después de detener el servicio de Windows y reiniciar Docker, `npm run prisma:migrate` funciona, el problema estaba resuelto.

---

**Fecha:** 2026-01-28  
**Estado:** Solución documentada y lista para ejecutar
