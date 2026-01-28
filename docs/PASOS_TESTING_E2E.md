# 🧪 Pasos para Ejecutar Tests E2E

> **Fecha:** Enero 2026  
> **Estado:** Tests Unitarios ✅ Completados (67/67 pasando)

---

## 📋 **RESUMEN**

Ya hemos completado:
- ✅ **Paso 1:** Compilación exitosa
- ✅ **Paso 2:** Tests Unitarios (67/67 pasando)

Ahora procedemos con:
- 🔄 **Paso 3:** Tests E2E

---

## 🚀 **PASO 3: TESTS E2E**

### **3.1 Verificar Docker Desktop**

**IMPORTANTE:** Docker Desktop debe estar corriendo para que los tests E2E funcionen.

1. **Abrir Docker Desktop** (si no está corriendo)
2. **Verificar que está corriendo:**
   ```powershell
   docker ps
   ```

### **3.2 Iniciar Servicios (Postgres y Redis)**

Desde la raíz del proyecto:

```powershell
cd infra
docker-compose up -d
```

**Verificar que están corriendo:**
```powershell
docker-compose ps
```

**Deberías ver:**
- `ce_postgres` - Estado: `Up`
- `ce_redis` - Estado: `Up`

### **3.3 Verificar Variables de Entorno**

Asegúrate de tener un archivo `.env` en la raíz del proyecto con:

```env
# Database
DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="tu-secret-key-aqui"
JWT_EXPIRES_IN="24h"

# Otros...
```

### **3.4 Ejecutar Migraciones de Prisma**

```powershell
cd apps/api
npm run prisma:migrate
```

### **3.5 Ejecutar Tests E2E**

```powershell
cd apps/api
npm run test:e2e
```

**Tests E2E esperados:**
- ✅ `app.e2e-spec.ts` - Health checks
- ✅ `cash.e2e-spec.ts` - Flujo completo de caja
- ✅ `inventory.e2e-spec.ts` - Flujo completo de inventario
- ✅ `sales.e2e-spec.ts` - Flujo completo de ventas
- ✅ `quotes.e2e-spec.ts` - Flujo completo de cotizaciones
- ✅ `reports.e2e-spec.ts` - Reportes
- ✅ `backups.e2e-spec.ts` - Backups

---

## 🔧 **SI HAY PROBLEMAS**

### **Error: Docker no está corriendo**
```powershell
# Iniciar Docker Desktop manualmente
# Luego verificar:
docker ps
```

### **Error: Puerto ocupado**
```powershell
# Verificar qué está usando el puerto:
netstat -ano | findstr :5432  # Postgres
netstat -ano | findstr :6379  # Redis
netstat -ano | findstr :3000  # API
```

### **Error: Base de datos no conecta**
```powershell
# Verificar que Postgres está corriendo:
docker ps | findstr postgres

# Verificar conexión:
docker exec -it ce_postgres psql -U ce -d comercial_electrica -c "SELECT 1;"
```

### **Error: Redis no conecta**
```powershell
# Verificar que Redis está corriendo:
docker ps | findstr redis

# Verificar conexión:
docker exec -it ce_redis redis-cli ping
# Debería responder: PONG
```

---

## 📊 **RESULTADO ESPERADO**

Al ejecutar `npm run test:e2e`, deberías ver:

```
PASS  test/app.e2e-spec.ts
PASS  test/cash.e2e-spec.ts
PASS  test/inventory.e2e-spec.ts
PASS  test/sales.e2e-spec.ts
PASS  test/quotes.e2e-spec.ts
PASS  test/reports.e2e-spec.ts
PASS  test/backups.e2e-spec.ts

Test Suites: 7 passed, 7 total
Tests:       XX passed, XX total
```

---

## 🎯 **PRÓXIMOS PASOS**

Una vez que los tests E2E pasen:

1. **Paso 4:** Iniciar servidor de desarrollo
2. **Paso 5:** Probar endpoints en Swagger
3. **Paso 6:** Verificar validaciones
4. **Paso 7:** Verificar performance (caché, paginación)
5. **Paso 8:** Verificar logging

---

**¿Listo para ejecutar los tests E2E?**
