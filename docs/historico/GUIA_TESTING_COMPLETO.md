# 🧪 Guía Completa de Testing - Verificación Pre-Frontend

> **Fecha:** Enero 2026  
> **Objetivo:** Verificar que todo el backend funciona correctamente antes de iniciar frontend

---

## 📋 **RESUMEN**

Esta guía te ayudará a testear **TODA** la funcionalidad implementada. He corregido los errores en los archivos de test, pero debido a restricciones del sistema, necesitas ejecutar los tests manualmente.

---

## ✅ **CORRECCIONES REALIZADAS**

He corregido los siguientes archivos de test:

1. ✅ `dian.service.spec.ts` - Agregado import de `DianDocumentType`
2. ✅ `auth.service.spec.ts` - Agregado mock de `AuditService`
3. ✅ `cash.service.spec.ts` - Agregados mocks de `ValidationLimitsService` y `AuditService`
4. ✅ `inventory.service.spec.ts` - Agregados mocks de `ValidationLimitsService` y `AuditService`
5. ✅ `sales.service.spec.ts` - Agregados mocks de `ValidationLimitsService`, `AuditService` y `CacheService`
6. ✅ `quotes.service.spec.ts` - Agregados mocks de `ValidationLimitsService`, `AuditService` y `CacheService`

---

## 🚀 **PASOS PARA TESTING**

### **Paso 1: Verificar Compilación** ✅

```bash
cd apps/api
npm run build
```

**Resultado esperado:** ✅ Build exitoso (ya verificado)

---

### **Paso 2: Ejecutar Tests Unitarios** 🧪

```bash
cd apps/api
npm run test
```

**Qué verificar:**
- ✅ Todos los tests pasan
- ✅ No hay errores de dependencias
- ✅ Cobertura de código aceptable

**Tests esperados:**
- Auth Service: ~10-15 tests
- Cash Service: ~5-10 tests
- Inventory Service: ~10-15 tests
- Sales Service: ~15-20 tests
- Quotes Service: ~15-20 tests
- Dian Service: ~5-10 tests (mocks)

**Si hay errores de permisos (EPERM):**
- Cierra otras instancias de Node.js
- Ejecuta como administrador si es necesario
- O usa: `npm run test -- --runInBand` (ejecuta en serie)

---

### **Paso 3: Ejecutar Tests E2E** 🎯

**Primero, verifica que Docker esté corriendo:**
```bash
docker-compose ps
```

Si no está corriendo:
```bash
docker-compose up -d
```

**Luego ejecuta tests E2E:**
```bash
cd apps/api
npm run test:e2e
```

**Qué verificar:**
- ✅ Todos los tests E2E pasan
- ✅ Base de datos de test funciona
- ✅ No hay problemas de conexión

**Tests esperados:**
- App E2E: Health checks
- Cash E2E: Apertura, cierre, movimientos
- Inventory E2E: Entrada, salida, ajuste
- Sales E2E: Crear venta, facturación
- Quotes E2E: Crear, actualizar, enviar, convertir
- Reports E2E: Todos los reportes
- Backups E2E: Crear, listar, verificar, eliminar

---

### **Paso 4: Iniciar Servidor y Probar con Swagger** 📚

**Iniciar servidor:**
```bash
cd apps/api
npm run start:dev
```

**Abrir Swagger:**
- URL: `http://localhost:3000/api`
- Verificar que todos los endpoints están documentados

**Probar endpoints críticos:**

#### **4.1 Autenticación**
1. `POST /auth/bootstrap-admin` - Crear admin
2. `POST /auth/login` - Login y obtener token
3. Usar token en `Authorization: Bearer <token>`

#### **4.2 Productos**
1. `GET /products` - Listar (paginado)
2. `POST /products` - Crear producto
3. `GET /products/:id` - Obtener por ID
4. `PATCH /products/:id` - Actualizar
5. `DELETE /products/:id` - Desactivar (validar ventas)

#### **4.3 Clientes**
1. `GET /customers` - Listar (paginado)
2. `POST /customers` - Crear cliente
3. `GET /customers/:id` - Obtener por ID
4. `PATCH /customers/:id` - Actualizar
5. `DELETE /customers/:id` - Eliminar (validar ventas)

#### **4.4 Inventario**
1. `GET /inventory/movements` - Listar (paginado)
2. `POST /inventory/movements` - Crear movimiento (IN/OUT/ADJUST)
3. Verificar actualización de stock

#### **4.5 Caja**
1. `GET /cash/sessions` - Listar (paginado)
2. `POST /cash/sessions` - Abrir sesión
3. `GET /cash/sessions/:id` - Obtener sesión
4. `POST /cash/sessions/:id/close` - Cerrar sesión
5. `GET /cash/sessions/:id/movements` - Listar movimientos

#### **4.6 Ventas**
1. `GET /sales` - Listar (paginado)
2. `POST /sales` - Crear venta completa
3. Verificar factura generada
4. Verificar documento DIAN creado
5. Verificar actualización de stock

#### **4.7 Cotizaciones**
1. `GET /quotes` - Listar (paginado)
2. `POST /quotes` - Crear cotización
3. `PATCH /quotes/:id` - Actualizar
4. `POST /quotes/:id/send` - Enviar cotización
5. `POST /quotes/:id/convert` - Convertir a venta
6. Validar estados (no actualizar CONVERTED/CANCELLED)

#### **4.8 Reportes**
1. `GET /reports/dashboard` - Dashboard (con caché)
2. `GET /reports/sales` - Reporte de ventas (con filtros)
3. `GET /reports/inventory` - Reporte de inventario
4. `GET /reports/cash` - Reporte de caja
5. `GET /reports/customers` - Reporte de clientes

#### **4.9 Backups**
1. `POST /backups` - Crear backup manual
2. `GET /backups` - Listar backups
3. `GET /backups/:id` - Obtener backup
4. `POST /backups/:id/verify` - Verificar backup
5. `DELETE /backups/:id` - Eliminar backup

#### **4.10 Audit Logs**
1. `GET /audit-logs` - Listar logs
2. `GET /audit-logs/entity/:entity/:entityId` - Logs de entidad

#### **4.11 Utilidades**
1. `GET /health` - Health check mejorado
2. `GET /stats` - Estadísticas (requiere ADMIN)

---

### **Paso 5: Verificar Validaciones** ✅

#### **5.1 Validaciones de Límites**
- [ ] Intentar crear movimiento con cantidad > MAX_INVENTORY_QTY
- [ ] Intentar abrir caja con monto > MAX_OPENING_AMOUNT
- [ ] Intentar crear venta con items > MAX_ITEMS_PER_SALE
- [ ] Intentar crear cotización con items > MAX_ITEMS_PER_QUOTE
- [ ] Intentar reporte con rango > 1 año

#### **5.2 Validaciones de Integridad**
- [ ] Intentar desactivar producto con ventas → Debe fallar
- [ ] Intentar eliminar cliente con ventas → Debe fallar
- [ ] Intentar cerrar caja con ventas pendientes → Debe fallar
- [ ] Intentar actualizar cotización CONVERTED → Debe fallar
- [ ] Intentar enviar cotización CANCELLED → Debe fallar

#### **5.3 Validaciones de DTOs**
- [ ] Email inválido en cliente → Debe fallar
- [ ] Teléfono < 7 caracteres → Debe fallar
- [ ] Precio negativo → Debe fallar
- [ ] Cantidad no entera → Debe fallar

---

### **Paso 6: Verificar Performance** ⚡

#### **6.1 Caché**
- [ ] Primera llamada a `/products` → Debe consultar BD
- [ ] Segunda llamada a `/products` → Debe usar caché (más rápido)
- [ ] Crear producto → Debe invalidar caché
- [ ] Dashboard debe usar caché (1 minuto TTL)

#### **6.2 Paginación**
- [ ] Verificar que todos los listados tienen paginación
- [ ] Verificar metadatos (total, pages, hasNext, hasPrevious)
- [ ] Verificar límites máximos (1000 registros)

#### **6.3 Rate Limiting**
- [ ] Hacer 100+ requests rápidos → Debe limitar
- [ ] Verificar diferenciación usuario/IP

---

### **Paso 7: Verificar Logging** 📝

#### **7.1 Logs en Consola**
- [ ] Verificar logs estructurados
- [ ] Verificar métricas de performance (tiempo en ms)
- [ ] Verificar logging de operaciones lentas (>1s)

#### **7.2 Audit Logs**
- [ ] Verificar que se registran creates
- [ ] Verificar que se registran updates
- [ ] Verificar que se registran deletes
- [ ] Verificar que se registran conversiones

---

## 📊 **CHECKLIST COMPLETO**

### **Compilación:**
- [x] ✅ `npm run build` exitoso
- [ ] `npm run test` - Todos los tests pasan
- [ ] `npm run test:e2e` - Todos los tests E2E pasan

### **Servicios:**
- [ ] Postgres funcionando (`docker-compose ps`)
- [ ] Redis funcionando (`docker-compose ps`)
- [ ] API Server funcionando (`npm run start:dev`)
- [ ] Health check responde (`GET /health`)

### **Endpoints Críticos:**
- [ ] Autenticación completa
- [ ] CRUD de productos
- [ ] CRUD de clientes
- [ ] Gestión de inventario
- [ ] Gestión de caja
- [ ] Gestión de ventas
- [ ] Gestión de cotizaciones
- [ ] Reportes
- [ ] Backups
- [ ] Audit logs

### **Validaciones:**
- [ ] Límites de cantidad/montos
- [ ] Integridad referencial
- [ ] Validaciones de DTOs
- [ ] Rangos de fechas

### **Performance:**
- [ ] Caché funcionando
- [ ] Paginación funcionando
- [ ] Rate limiting activo

### **Logging:**
- [ ] Logs estructurados
- [ ] Métricas de performance
- [ ] Audit logs completos

---

## 🚨 **SOLUCIÓN DE PROBLEMAS**

### **Error: EPERM al ejecutar tests**
```bash
# Opción 1: Ejecutar en serie
npm run test -- --runInBand

# Opción 2: Cerrar otras instancias de Node.js
# Opción 3: Ejecutar como administrador
```

### **Error: Base de datos no conecta**
```bash
# Verificar Docker
docker-compose ps
docker-compose up -d

# Verificar variables de entorno
cat .env | grep DATABASE
```

### **Error: Redis no conecta**
```bash
# Verificar Docker
docker-compose ps redis

# Verificar variables de entorno
cat .env | grep REDIS
```

### **Error: Puerto ocupado**
```bash
# Cambiar puerto en .env
PORT=3001
```

---

## 📈 **RESULTADO ESPERADO**

Al finalizar este testing, deberías tener:

1. ✅ **Confianza total** en que el backend funciona
2. ✅ **Documentación** de cualquier problema encontrado
3. ✅ **Lista de mejoras** menores (si las hay)
4. ✅ **Base sólida** para iniciar frontend

---

## 🎯 **PRÓXIMOS PASOS**

Una vez completado el testing:

1. **Si todo pasa:** ✅ Iniciar frontend
2. **Si hay problemas:** 🔧 Corregir antes de continuar
3. **Si hay mejoras menores:** 📝 Documentar para después

---

**¿Listo para ejecutar los tests?**
