# 🧪 Plan de Testing Completo - Verificación Pre-Frontend

> **Fecha:** Enero 2026  
> **Objetivo:** Verificar que todo el backend funciona correctamente antes de iniciar frontend

---

## 📋 **RESUMEN EJECUTIVO**

Este documento detalla el plan completo para testear **TODA** la funcionalidad implementada hasta el momento, asegurando que el backend está 100% funcional antes de iniciar el desarrollo del frontend.

---

## 🎯 **OBJETIVOS DE TESTING**

1. ✅ Verificar que todos los tests unitarios pasan
2. ✅ Verificar que todos los tests E2E pasan
3. ✅ Verificar que la API compila sin errores
4. ✅ Verificar que Swagger funciona correctamente
5. ✅ Probar endpoints críticos manualmente
6. ✅ Verificar que la base de datos funciona
7. ✅ Verificar que Redis funciona
8. ✅ Verificar que las colas funcionan

---

## 📊 **TESTS DISPONIBLES**

### **Tests Unitarios:**
- `auth.service.spec.ts` - Autenticación
- `cash.service.spec.ts` - Gestión de caja
- `inventory.service.spec.ts` - Gestión de inventario
- `sales.service.spec.ts` - Gestión de ventas
- `quotes.service.spec.ts` - Gestión de cotizaciones
- `dian.service.spec.ts` - Procesamiento DIAN (mocks)

### **Tests E2E:**
- `app.e2e-spec.ts` - Health checks básicos
- `cash.e2e-spec.ts` - Flujo completo de caja
- `inventory.e2e-spec.ts` - Flujo completo de inventario
- `sales.e2e-spec.ts` - Flujo completo de ventas
- `quotes.e2e-spec.ts` - Flujo completo de cotizaciones
- `reports.e2e-spec.ts` - Reportes (NUEVO)
- `backups.e2e-spec.ts` - Backups (NUEVO)

---

## 🔧 **PASOS DE TESTING**

### **Fase 1: Verificación de Compilación** ✅

```bash
cd apps/api
npm run build
```

**Qué verificar:**
- ✅ No hay errores de TypeScript
- ✅ No hay errores de linting
- ✅ Build exitoso

---

### **Fase 2: Tests Unitarios** 🧪

```bash
cd apps/api
npm run test
```

**Qué verificar:**
- ✅ Todos los tests pasan
- ✅ Cobertura de código aceptable
- ✅ No hay tests fallando

**Tests esperados:**
- Auth Service: ~10-15 tests
- Cash Service: ~5-10 tests
- Inventory Service: ~10-15 tests
- Sales Service: ~15-20 tests
- Quotes Service: ~15-20 tests
- Dian Service: ~5-10 tests (mocks)

---

### **Fase 3: Tests E2E** 🎯

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

### **Fase 4: Verificación de Servicios** 🔍

#### **4.1 Base de Datos**
```bash
# Verificar que Postgres está corriendo
docker-compose ps

# Verificar conexión
npm run db:status
```

#### **4.2 Redis**
```bash
# Verificar que Redis está corriendo
docker-compose ps

# Probar conexión Redis (si hay script)
```

#### **4.3 API Server**
```bash
# Iniciar servidor
npm run start:dev

# Verificar health check
curl http://localhost:3000/health
```

---

### **Fase 5: Testing Manual con Swagger** 📚

**URL:** `http://localhost:3000/api`

#### **5.1 Autenticación**
- [ ] Crear usuario admin (bootstrap)
- [ ] Login exitoso
- [ ] Obtener token JWT
- [ ] Verificar token válido

#### **5.2 Productos**
- [ ] Listar productos (paginado)
- [ ] Crear producto
- [ ] Obtener producto por ID
- [ ] Actualizar producto
- [ ] Desactivar producto (validar ventas)

#### **5.3 Clientes**
- [ ] Listar clientes (paginado)
- [ ] Crear cliente
- [ ] Obtener cliente por ID
- [ ] Actualizar cliente
- [ ] Eliminar cliente (validar ventas)

#### **5.4 Inventario**
- [ ] Listar movimientos (paginado)
- [ ] Crear movimiento de entrada
- [ ] Crear movimiento de salida
- [ ] Crear ajuste de inventario
- [ ] Verificar actualización de stock

#### **5.5 Caja**
- [ ] Listar sesiones (paginado)
- [ ] Abrir sesión de caja
- [ ] Obtener sesión por ID
- [ ] Listar movimientos de sesión
- [ ] Cerrar sesión (validar ventas pendientes)

#### **5.6 Ventas**
- [ ] Listar ventas (paginado)
- [ ] Crear venta completa
- [ ] Verificar factura generada
- [ ] Verificar documento DIAN creado
- [ ] Verificar actualización de stock

#### **5.7 Cotizaciones**
- [ ] Listar cotizaciones (paginado)
- [ ] Crear cotización
- [ ] Actualizar cotización
- [ ] Enviar cotización
- [ ] Convertir cotización a venta
- [ ] Validar estados (no actualizar CONVERTED/CANCELLED)

#### **5.8 Reportes**
- [ ] Dashboard (con caché)
- [ ] Reporte de ventas (con filtros)
- [ ] Reporte de inventario (con filtros)
- [ ] Reporte de caja (con filtros)
- [ ] Reporte de clientes (con top)

#### **5.9 Backups**
- [ ] Crear backup manual
- [ ] Listar backups
- [ ] Obtener backup por ID
- [ ] Verificar backup (checksum)
- [ ] Eliminar backup

#### **5.10 Audit Logs**
- [ ] Listar logs de auditoría
- [ ] Obtener logs de entidad específica
- [ ] Verificar que se registran operaciones

#### **5.11 Utilidades**
- [ ] Health check mejorado
- [ ] Stats (requiere ADMIN)

---

### **Fase 6: Testing de Validaciones** ✅

#### **6.1 Validaciones de Límites**
- [ ] Validar cantidad máxima en inventario
- [ ] Validar monto máximo en caja
- [ ] Validar cantidad máxima de items en venta
- [ ] Validar cantidad máxima de items en cotización
- [ ] Validar rango de fechas en reportes (máx 1 año)

#### **6.2 Validaciones de Integridad**
- [ ] No desactivar producto con ventas
- [ ] No eliminar cliente con ventas
- [ ] No cerrar caja con ventas pendientes
- [ ] No actualizar cotización CONVERTED/CANCELLED
- [ ] No enviar cotización CONVERTED/CANCELLED

#### **6.3 Validaciones de DTOs**
- [ ] Email válido en clientes
- [ ] Teléfono mínimo 7 caracteres
- [ ] Precios positivos
- [ ] Cantidades enteras positivas

---

### **Fase 7: Testing de Performance** ⚡

#### **7.1 Caché**
- [ ] Verificar caché en productos
- [ ] Verificar caché en clientes
- [ ] Verificar caché en dashboard
- [ ] Verificar invalidación de caché

#### **7.2 Paginación**
- [ ] Verificar paginación en todos los listados
- [ ] Verificar límites máximos
- [ ] Verificar metadatos (total, pages, hasNext, etc.)

#### **7.3 Rate Limiting**
- [ ] Verificar rate limiting activo
- [ ] Probar límites (100 req/min, 500 req/10min, etc.)
- [ ] Verificar diferenciación usuario/IP

---

### **Fase 8: Testing de Logging** 📝

#### **8.1 Logging Estructurado**
- [ ] Verificar logs en consola
- [ ] Verificar métricas de performance
- [ ] Verificar logging de operaciones lentas (>1s)

#### **8.2 Audit Logging**
- [ ] Verificar que se registran creates
- [ ] Verificar que se registran updates
- [ ] Verificar que se registran deletes
- [ ] Verificar que se registran conversiones

---

## 📊 **CHECKLIST COMPLETO**

### **Compilación y Build:**
- [ ] `npm run build` exitoso
- [ ] No hay errores TypeScript
- [ ] No hay errores de linting

### **Tests Automatizados:**
- [ ] Todos los tests unitarios pasan
- [ ] Todos los tests E2E pasan
- [ ] Cobertura de código aceptable

### **Servicios:**
- [ ] Postgres funcionando
- [ ] Redis funcionando
- [ ] API Server funcionando
- [ ] Health check responde

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

## 🚨 **PROBLEMAS COMUNES Y SOLUCIONES**

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

### **Error: Tests fallan**
```bash
# Limpiar base de datos de test
npm run test:e2e:clean (si existe)

# Re-ejecutar tests
npm run test:e2e
```

### **Error: Puerto ocupado**
```bash
# Cambiar puerto en .env
PORT=3001
```

---

## 📈 **MÉTRICAS DE ÉXITO**

### **Tests:**
- ✅ 100% de tests pasando
- ✅ Cobertura > 70%
- ✅ Sin tests flaky

### **API:**
- ✅ Todos los endpoints responden
- ✅ Validaciones funcionan
- ✅ Errores manejados correctamente

### **Performance:**
- ✅ Caché funcionando
- ✅ Paginación funcionando
- ✅ Rate limiting activo

### **Logging:**
- ✅ Logs estructurados
- ✅ Audit logs completos
- ✅ Métricas disponibles

---

## 🎯 **RESULTADO ESPERADO**

Al finalizar este plan de testing, deberías tener:

1. ✅ **Confianza total** en que el backend funciona
2. ✅ **Documentación** de cualquier problema encontrado
3. ✅ **Lista de mejoras** menores (si las hay)
4. ✅ **Base sólida** para iniciar frontend

---

## 📝 **PRÓXIMOS PASOS DESPUÉS DE TESTING**

Una vez completado el testing:

1. **Si todo pasa:** ✅ Iniciar frontend
2. **Si hay problemas:** 🔧 Corregir antes de continuar
3. **Si hay mejoras menores:** 📝 Documentar para después

---

**¿Empezamos con el testing?**
