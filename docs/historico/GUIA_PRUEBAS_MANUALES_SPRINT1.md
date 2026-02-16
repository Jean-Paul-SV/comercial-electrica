# Guía de pruebas manuales — Sprint 1 (Correcciones críticas)

**Objetivo:** Validar manualmente todas las correcciones críticas implementadas.  
**Fecha:** Febrero 2026.

---

## Preparación del entorno

### 1. Ejecutar migración de StripeEvent

```bash
cd apps/api
npx prisma migrate deploy
# O si estás en desarrollo:
npx prisma migrate dev
```

**Verificar:** La tabla `StripeEvent` debe existir en la base de datos.

```sql
-- Verificar en PostgreSQL
SELECT * FROM "StripeEvent" LIMIT 1;
```

### 2. Configurar variables de entorno

**En desarrollo (.env):**
```env
# CORS (puede estar vacío en desarrollo)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Stripe (opcional para pruebas, pero necesario para webhooks)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**En producción:**
```env
# OBLIGATORIO: Debe estar configurado o la API no arrancará
ALLOWED_ORIGINS=https://app.tudominio.com,https://admin.tudominio.com
```

### 3. Reiniciar la API

```bash
cd apps/api
npm run start:dev
```

**Verificar:** La API arranca sin errores. Si `ALLOWED_ORIGINS` está vacío en producción, debe fallar con error claro.

---

## Prueba 1: Fugas multi-tenant corregidas

### 1.1 GET /stats — Filtrar por tenantId

**Preparación:**
1. Crear dos tenants diferentes:
   - Tenant A: "Empresa A" (slug: `empresa-a`)
   - Tenant B: "Empresa B" (slug: `empresa-b`)

2. Crear usuarios admin para cada tenant:
   - `admin-a@test.com` → Tenant A
   - `admin-b@test.com` → Tenant B

3. Crear datos de prueba:
   - En Tenant A: 5 ventas, 10 productos, 3 clientes
   - En Tenant B: 8 ventas, 15 productos, 5 clientes

**Pasos:**

1. **Login como admin de Tenant A:**
   ```bash
   POST http://localhost:3000/auth/login
   {
     "email": "admin-a@test.com",
     "password": "password123"
   }
   ```
   Guardar el `accessToken` como `TOKEN_A`.

2. **Obtener stats con Token A:**
   ```bash
   GET http://localhost:3000/stats
   Authorization: Bearer TOKEN_A
   ```

   **Resultado esperado:**
   ```json
   {
     "timestamp": "2026-02-09T...",
     "tenantId": "uuid-tenant-a",
     "users": { "total": 1 },
     "products": { "total": 10, "lowStock": 0 },
     "customers": { "total": 3 },
     "sales": { "total": 5, "today": { "count": 0, "total": 0 } },
     "quotes": { "total": 0 },
     "cash": { "openSessions": 0 }
   }
   ```
   ✅ **Verificar:** `sales.total` debe ser 5 (no 13), `customers.total` debe ser 3 (no 8).

3. **Login como admin de Tenant B:**
   ```bash
   POST http://localhost:3000/auth/login
   {
     "email": "admin-b@test.com",
     "password": "password123"
   }
   ```
   Guardar el `accessToken` como `TOKEN_B`.

4. **Obtener stats con Token B:**
   ```bash
   GET http://localhost:3000/stats
   Authorization: Bearer TOKEN_B
   ```

   **Resultado esperado:**
   ```json
   {
     "tenantId": "uuid-tenant-b",
     "sales": { "total": 8 },
     "customers": { "total": 5 },
     ...
   }
   ```
   ✅ **Verificar:** `sales.total` debe ser 8 (no 13), `customers.total` debe ser 5 (no 8).

5. **Probar como platform admin (opcional):**
   - Si tienes un usuario sin `tenantId` (platform admin):
   ```bash
   GET http://localhost:3000/stats?tenantId=uuid-tenant-a
   Authorization: Bearer TOKEN_PLATFORM_ADMIN
   ```
   ✅ **Verificar:** Debe devolver stats del tenant especificado.

---

### 1.2 GET /reports/dashboard — Filtrar por tenantId

**Pasos:**

1. **Obtener dashboard con Token A (Tenant A):**
   ```bash
   GET http://localhost:3000/reports/dashboard
   Authorization: Bearer TOKEN_A
   ```

   **Resultado esperado:**
   ```json
   {
     "date": "2026-02-09T...",
     "tenantId": "uuid-tenant-a",
     "sales": { "today": { "count": 0, "total": 0 } },
     "customers": { "total": 3 },
     "inventory": { "totalProducts": 10, "lowStockCount": 0 },
     "cash": { "openSessions": 0 },
     "quotes": { "pending": 0, "expiringSoon": 0 }
   }
   ```
   ✅ **Verificar:** `customers.total` debe ser 3 (no 8), `inventory.totalProducts` debe ser 10 (no 25).

2. **Obtener dashboard con Token B (Tenant B):**
   ```bash
   GET http://localhost:3000/reports/dashboard
   Authorization: Bearer TOKEN_B
   ```

   **Resultado esperado:**
   ```json
   {
     "tenantId": "uuid-tenant-b",
     "customers": { "total": 5 },
     "inventory": { "totalProducts": 15 },
     ...
   }
   ```
   ✅ **Verificar:** `customers.total` debe ser 5 (no 8), `inventory.totalProducts` debe ser 15 (no 25).

---

### 1.3 GET /reports/operational-state — Filtrar por tenantId

**Pasos:**

1. **Obtener estado operativo con Token A:**
   ```bash
   GET http://localhost:3000/reports/operational-state
   Authorization: Bearer TOKEN_A
   ```

   **Resultado esperado:**
   ```json
   {
     "indicators": {
       "cash": { "openSessions": 0 },
       "inventory": { "lowStockCount": 0, "zeroStockCount": 0 },
       "quotes": { "pending": 0, "expiringSoon": 0, "expired": 0 },
       "sales": { "todayTotal": 0, "last7DaysTotal": 0 },
       "supplierInvoices": { "overdue": 0, "dueSoon": 0 }
     },
     "alerts": []
   }
   ```
   ✅ **Verificar:** Todos los conteos deben corresponder solo a Tenant A.

2. **Obtener estado operativo con Token B:**
   ```bash
   GET http://localhost:3000/reports/operational-state
   Authorization: Bearer TOKEN_B
   ```
   ✅ **Verificar:** Los conteos deben corresponder solo a Tenant B.

---

### 1.4 GET /reports/sales — Filtrar por tenantId

**Pasos:**

1. **Obtener reporte de ventas con Token A:**
   ```bash
   GET http://localhost:3000/reports/sales?startDate=2026-01-01&endDate=2026-12-31
   Authorization: Bearer TOKEN_A
   ```

   **Resultado esperado:**
   ```json
   {
     "period": { "startDate": "2026-01-01", "endDate": "2026-12-31" },
     "summary": {
       "totalSales": 5,
       "totalAmount": 500000,
       ...
     },
     "sales": [
       // Solo 5 ventas de Tenant A
     ]
   }
   ```
   ✅ **Verificar:** `summary.totalSales` debe ser 5 (no 13), y el array `sales` debe tener solo 5 elementos.

2. **Obtener reporte de ventas con Token B:**
   ```bash
   GET http://localhost:3000/reports/sales?startDate=2026-01-01&endDate=2026-12-31
   Authorization: Bearer TOKEN_B
   ```
   ✅ **Verificar:** `summary.totalSales` debe ser 8 (no 13), y el array `sales` debe tener solo 8 elementos.

---

### 1.5 GET /reports/inventory — Filtrar por tenantId

**Preparación:**
- En Tenant A: 10 productos activos
- En Tenant B: 15 productos activos

**Pasos:**

1. **Obtener reporte de inventario con Token A:**
   ```bash
   GET http://localhost:3000/reports/inventory
   Authorization: Bearer TOKEN_A
   ```
   ✅ **Verificar:** El reporte debe mostrar solo los 10 productos de Tenant A.

2. **Obtener reporte de inventario con Token B:**
   ```bash
   GET http://localhost:3000/reports/inventory
   Authorization: Bearer TOKEN_B
   ```
   ✅ **Verificar:** El reporte debe mostrar solo los 15 productos de Tenant B.

---

### 1.6 GET /reports/cash — Filtrar por tenantId

**Preparación:**
- En Tenant A: 2 sesiones de caja
- En Tenant B: 3 sesiones de caja

**Pasos:**

1. **Obtener reporte de caja con Token A:**
   ```bash
   GET http://localhost:3000/reports/cash?startDate=2026-01-01&endDate=2026-12-31
   Authorization: Bearer TOKEN_A
   ```
   ✅ **Verificar:** El reporte debe mostrar solo las 2 sesiones de Tenant A.

2. **Obtener reporte de caja con Token B:**
   ```bash
   GET http://localhost:3000/reports/cash?startDate=2026-01-01&endDate=2026-12-31
   Authorization: Bearer TOKEN_B
   ```
   ✅ **Verificar:** El reporte debe mostrar solo las 3 sesiones de Tenant B.

---

### 1.7 GET /reports/customers — Filtrar por tenantId

**Preparación:**
- En Tenant A: 3 clientes con ventas
- En Tenant B: 5 clientes con ventas

**Pasos:**

1. **Obtener reporte de clientes con Token A:**
   ```bash
   GET http://localhost:3000/reports/customers?startDate=2026-01-01&endDate=2026-12-31
   Authorization: Bearer TOKEN_A
   ```
   ✅ **Verificar:** El reporte debe mostrar solo los 3 clientes de Tenant A.

2. **Obtener reporte de clientes con Token B:**
   ```bash
   GET http://localhost:3000/reports/customers?startDate=2026-01-01&endDate=2026-12-31
   Authorization: Bearer TOKEN_B
   ```
   ✅ **Verificar:** El reporte debe mostrar solo los 5 clientes de Tenant B.

---

### 1.8 GET /reports/actionable-indicators — Filtrar por tenantId

**Preparación:**
- En Tenant A: algunos productos con pérdida, facturas vencidas
- En Tenant B: otros productos con pérdida, facturas vencidas

**Pasos:**

1. **Obtener indicadores accionables con Token A:**
   ```bash
   GET http://localhost:3000/reports/actionable-indicators?days=30
   Authorization: Bearer TOKEN_A
   ```
   ✅ **Verificar:** Los indicadores deben referirse solo a datos de Tenant A (productos, facturas proveedor, ventas de Tenant A).

2. **Obtener indicadores accionables con Token B:**
   ```bash
   GET http://localhost:3000/reports/actionable-indicators?days=30
   Authorization: Bearer TOKEN_B
   ```
   ✅ **Verificar:** Los indicadores deben referirse solo a datos de Tenant B.

---

### 1.9 GET /reports/customer-clusters — Filtrar por tenantId

**Preparación:**
- En Tenant A: clientes con ventas
- En Tenant B: otros clientes con ventas

**Pasos:**

1. **Obtener clusters de clientes con Token A:**
   ```bash
   GET http://localhost:3000/reports/customer-clusters?days=90&k=3
   Authorization: Bearer TOKEN_A
   ```
   ✅ **Verificar:** Los clusters deben incluir solo clientes de Tenant A.

2. **Obtener clusters de clientes con Token B:**
   ```bash
   GET http://localhost:3000/reports/customer-clusters?days=90&k=3
   Authorization: Bearer TOKEN_B
   ```
   ✅ **Verificar:** Los clusters deben incluir solo clientes de Tenant B.

---

### 1.10 GET /reports/trending-products — Filtrar por tenantId

**Preparación:**
- En Tenant A: productos vendidos
- En Tenant B: otros productos vendidos

**Pasos:**

1. **Obtener productos trending con Token A:**
   ```bash
   GET http://localhost:3000/reports/trending-products?days=30&top=10
   Authorization: Bearer TOKEN_A
   ```
   ✅ **Verificar:** Los productos trending deben ser solo de Tenant A.

2. **Obtener productos trending con Token B:**
   ```bash
   GET http://localhost:3000/reports/trending-products?days=30&top=10
   Authorization: Bearer TOKEN_B
   ```
   ✅ **Verificar:** Los productos trending deben ser solo de Tenant B.

---

### 1.11 GET /reports/dashboard-summary — Filtrar por tenantId

**Preparación:**
- En Tenant A: datos para generar resumen
- En Tenant B: otros datos para generar resumen

**Pasos:**

1. **Obtener resumen del dashboard con Token A:**
   ```bash
   GET http://localhost:3000/reports/dashboard-summary?days=30
   Authorization: Bearer TOKEN_A
   ```
   ✅ **Verificar:** El resumen debe basarse solo en indicadores de Tenant A.

2. **Obtener resumen del dashboard con Token B:**
   ```bash
   GET http://localhost:3000/reports/dashboard-summary?days=30
   Authorization: Bearer TOKEN_B
   ```
   ✅ **Verificar:** El resumen debe basarse solo en indicadores de Tenant B.

---

## Prueba 2: Rate limiting activado

### 2.1 Rate limiting en POST /auth/login

**Pasos:**

1. **Intentar login 11 veces seguidas desde la misma IP:**
   ```bash
   # Ejecutar 11 veces rápidamente (en menos de 1 minuto)
   POST http://localhost:3000/auth/login
   {
     "email": "admin-a@test.com",
     "password": "password123"
   }
   ```

   **Resultado esperado:**
   - Primeras 10 requests: ✅ 200 OK o 401 Unauthorized (según credenciales)
   - Request 11: ❌ **429 Too Many Requests**
   ```json
   {
     "statusCode": 429,
     "message": "ThrottlerException: Too Many Requests"
   }
   ```

   ✅ **Verificar:** La request 11 debe devolver 429.

2. **Esperar 1 minuto y volver a intentar:**
   ```bash
   # Esperar 60 segundos
   POST http://localhost:3000/auth/login
   {
     "email": "admin-a@test.com",
     "password": "password123"
   }
   ```
   ✅ **Verificar:** Debe funcionar de nuevo (el límite se resetea cada minuto).

---

### 2.2 Rate limiting en GET /reports/*

**Preparación:**
- Tener un usuario autenticado con token válido.

**Pasos:**

1. **Hacer 31 requests seguidas a GET /reports/dashboard:**
   ```bash
   # Ejecutar 31 veces rápidamente (en menos de 1 minuto)
   GET http://localhost:3000/reports/dashboard
   Authorization: Bearer TOKEN_A
   ```

   **Resultado esperado:**
   - Primeras 30 requests: ✅ 200 OK
   - Request 31: ❌ **429 Too Many Requests**

   ✅ **Verificar:** La request 31 debe devolver 429.

---

### 2.3 Rate limiting en GET /reports/export

**Pasos:**

1. **Hacer 11 requests seguidas a GET /reports/export:**
   ```bash
   # Ejecutar 11 veces rápidamente
   GET http://localhost:3000/reports/export?entity=sales
   Authorization: Bearer TOKEN_A
   ```

   **Resultado esperado:**
   - Primeras 10 requests: ✅ 200 OK (CSV)
   - Request 11: ❌ **429 Too Many Requests**

   ✅ **Verificar:** La request 11 debe devolver 429.

---

## Prueba 3: CORS estricto en producción

### 3.1 Validación de ALLOWED_ORIGINS en producción

**Pasos:**

1. **Configurar NODE_ENV=production sin ALLOWED_ORIGINS:**
   ```bash
   # En .env o variables de entorno
   NODE_ENV=production
   # NO configurar ALLOWED_ORIGINS
   ```

2. **Intentar arrancar la API:**
   ```bash
   cd apps/api
   npm run start:prod
   ```

   **Resultado esperado:**
   ❌ **Error al arrancar:**
   ```
   Error: ALLOWED_ORIGINS debe estar configurado en producción. Ejemplo: ALLOWED_ORIGINS=https://app.tudominio.com,https://admin.tudominio.com
   ```

   ✅ **Verificar:** La API no debe arrancar sin ALLOWED_ORIGINS en producción.

3. **Configurar ALLOWED_ORIGINS y arrancar:**
   ```bash
   ALLOWED_ORIGINS=https://app.tudominio.com
   npm run start:prod
   ```
   ✅ **Verificar:** La API debe arrancar correctamente.

---

### 3.2 Validación de origen permitido

**Pasos:**

1. **Desde un origen NO permitido (ej. Postman o curl sin Origin):**
   ```bash
   curl -X GET http://localhost:3000/health \
     -H "Origin: https://malicious-site.com"
   ```

   **Resultado esperado:**
   - Si el origen no está en `ALLOWED_ORIGINS`: ❌ CORS bloquea la request
   - El navegador mostrará error de CORS

2. **Desde un origen permitido:**
   ```bash
   curl -X GET http://localhost:3000/health \
     -H "Origin: https://app.tudominio.com"
   ```
   ✅ **Verificar:** La request debe funcionar.

---

## Prueba 4: Idempotencia en webhooks Stripe

### 4.1 Verificar tabla StripeEvent

**Pasos:**

1. **Verificar que la tabla existe:**
   ```sql
   SELECT * FROM "StripeEvent" LIMIT 1;
   ```
   ✅ **Verificar:** La tabla debe existir (puede estar vacía).

---

### 4.2 Probar idempotencia con evento duplicado

**Preparación:**
- Tener un tenant con suscripción Stripe activa.
- Tener `STRIPE_WEBHOOK_SECRET` configurado.

**Pasos:**

1. **Crear evento mock de Stripe (invoice.paid):**
   ```bash
   # Usar Stripe CLI o crear evento manualmente
   stripe trigger invoice.paid
   ```
   O crear manualmente:
   ```json
   {
     "id": "evt_test_123456",
     "type": "invoice.paid",
     "data": {
       "object": {
         "id": "in_test_123",
         "subscription": "sub_test_123",
         "status": "paid"
       }
     }
   }
   ```

2. **Enviar webhook primera vez:**
   ```bash
   POST http://localhost:3000/billing/webhooks/stripe
   Content-Type: application/json
   Stripe-Signature: whsec_...
   {
     "id": "evt_test_123456",
     "type": "invoice.paid",
     ...
   }
   ```

   **Resultado esperado:**
   ✅ **200 OK** con `{ "received": true }`

3. **Verificar en BD que el evento fue guardado:**
   ```sql
   SELECT * FROM "StripeEvent" WHERE "eventId" = 'evt_test_123456';
   ```
   ✅ **Verificar:** Debe existir un registro con `eventId = 'evt_test_123456'`.

4. **Verificar que la suscripción fue prorrogada:**
   ```sql
   SELECT "currentPeriodEnd" FROM "Subscription" 
   WHERE "stripeSubscriptionId" = 'sub_test_123';
   ```
   ✅ **Verificar:** `currentPeriodEnd` debe haber sido prorrogado 30 días.

5. **Enviar el MISMO webhook segunda vez (mismo event.id):**
   ```bash
   POST http://localhost:3000/billing/webhooks/stripe
   Content-Type: application/json
   Stripe-Signature: whsec_...
   {
     "id": "evt_test_123456",  // MISMO event.id
     "type": "invoice.paid",
     ...
   }
   ```

   **Resultado esperado:**
   ✅ **200 OK** con `{ "received": true }`
   ⚠️ **PERO:** El evento NO debe procesarse de nuevo (idempotente).

6. **Verificar en logs:**
   ```
   Evento Stripe evt_test_123456 (invoice.paid) ya fue procesado, ignorando (idempotencia)
   ```

7. **Verificar que la suscripción NO fue prorrogada de nuevo:**
   ```sql
   SELECT "currentPeriodEnd" FROM "Subscription" 
   WHERE "stripeSubscriptionId" = 'sub_test_123';
   ```
   ✅ **Verificar:** `currentPeriodEnd` debe ser el MISMO que después del paso 4 (no prorrogado de nuevo).

---

## Prueba 5: PermissionsGuard en endpoints críticos

### 5.1 POST /cash/sessions — Requiere cash:create

**Preparación:**
- Crear un usuario con rol USER pero SIN permiso `cash:create`.

**Pasos:**

1. **Login como usuario sin permiso:**
   ```bash
   POST http://localhost:3000/auth/login
   {
     "email": "user-sin-permiso@test.com",
     "password": "password123"
   }
   ```
   Guardar el token como `TOKEN_USER`.

2. **Intentar abrir sesión de caja:**
   ```bash
   POST http://localhost:3000/cash/sessions
   Authorization: Bearer TOKEN_USER
   {
     "openingAmount": 1000
   }
   ```

   **Resultado esperado:**
   ❌ **403 Forbidden**
   ```json
   {
     "statusCode": 403,
     "message": "No tienes permiso para realizar esta acción"
   }
   ```

   ✅ **Verificar:** Debe devolver 403.

3. **Login como usuario CON permiso (admin):**
   ```bash
   POST http://localhost:3000/auth/login
   {
     "email": "admin-a@test.com",
     "password": "password123"
   }
   ```

4. **Intentar abrir sesión de caja:**
   ```bash
   POST http://localhost:3000/cash/sessions
   Authorization: Bearer TOKEN_A
   {
     "openingAmount": 1000
   }
   ```

   **Resultado esperado:**
   ✅ **201 Created** con la sesión creada.

---

### 5.2 POST /cash/sessions/:id/close — Requiere cash:update

**Pasos:**

1. **Con usuario sin permiso `cash:update`:**
   ```bash
   POST http://localhost:3000/cash/sessions/{sessionId}/close
   Authorization: Bearer TOKEN_USER
   {
     "closingAmount": 1500
   }
   ```

   **Resultado esperado:**
   ❌ **403 Forbidden**

2. **Con usuario CON permiso:**
   ```bash
   POST http://localhost:3000/cash/sessions/{sessionId}/close
   Authorization: Bearer TOKEN_A
   {
     "closingAmount": 1500
   }
   ```

   **Resultado esperado:**
   ✅ **200 OK**

---

### 5.3 POST /sales — Requiere sales:create

**Pasos:**

1. **Con usuario sin permiso `sales:create`:**
   ```bash
   POST http://localhost:3000/sales
   Authorization: Bearer TOKEN_USER
   {
     "customerId": "...",
     "items": [...]
   }
   ```

   **Resultado esperado:**
   ❌ **403 Forbidden**

2. **Con usuario CON permiso:**
   ```bash
   POST http://localhost:3000/sales
   Authorization: Bearer TOKEN_A
   {
     "customerId": "...",
     "items": [...]
   }
   ```

   **Resultado esperado:**
   ✅ **201 Created**

---

### 5.4 PATCH /sales/invoices/:id/void — Requiere sales:update

**Pasos:**

1. **Con usuario sin permiso `sales:update`:**
   ```bash
   PATCH http://localhost:3000/sales/invoices/{invoiceId}/void
   Authorization: Bearer TOKEN_USER
   ```

   **Resultado esperado:**
   ❌ **403 Forbidden**

2. **Con usuario CON permiso:**
   ```bash
   PATCH http://localhost:3000/sales/invoices/{invoiceId}/void
   Authorization: Bearer TOKEN_A
   ```

   **Resultado esperado:**
   ✅ **200 OK**

---

### 5.5 POST /expenses — Requiere expenses:create

**Pasos:**

1. **Con usuario sin permiso `expenses:create`:**
   ```bash
   POST http://localhost:3000/expenses
   Authorization: Bearer TOKEN_USER
   {
     "amount": 500,
     "description": "Gasto de prueba"
   }
   ```

   **Resultado esperado:**
   ❌ **403 Forbidden**

2. **Con usuario CON permiso:**
   ```bash
   POST http://localhost:3000/expenses
   Authorization: Bearer TOKEN_A
   {
     "amount": 500,
     "description": "Gasto de prueba"
   }
   ```

   **Resultado esperado:**
   ✅ **201 Created**

---

### 5.6 DELETE /expenses/:id — Requiere expenses:delete

**Pasos:**

1. **Con usuario sin permiso `expenses:delete`:**
   ```bash
   DELETE http://localhost:3000/expenses/{expenseId}?reason=Error
   Authorization: Bearer TOKEN_USER
   ```

   **Resultado esperado:**
   ❌ **403 Forbidden**

2. **Con usuario CON permiso:**
   ```bash
   DELETE http://localhost:3000/expenses/{expenseId}?reason=Error
   Authorization: Bearer TOKEN_A
   ```

   **Resultado esperado:**
   ✅ **200 OK**

---

## Checklist de validación

### Multi-tenant
- [ ] GET /stats filtra por tenantId (cada tenant ve solo sus datos)
- [ ] GET /reports/dashboard filtra por tenantId
- [ ] GET /reports/operational-state filtra por tenantId
- [ ] GET /reports/sales filtra por tenantId
- [ ] GET /reports/inventory filtra por tenantId
- [ ] GET /reports/cash filtra por tenantId
- [ ] GET /reports/customers filtra por tenantId
- [ ] GET /reports/actionable-indicators filtra por tenantId
- [ ] GET /reports/customer-clusters filtra por tenantId
- [ ] GET /reports/trending-products filtra por tenantId
- [ ] GET /reports/dashboard-summary filtra por tenantId
- [ ] Platform admin puede especificar tenantId opcional en /stats

### Rate limiting
- [ ] POST /auth/login: 10 req/min por IP (request 11 devuelve 429)
- [ ] GET /reports/*: 30 req/min por usuario (request 31 devuelve 429)
- [ ] GET /reports/export: 10 req/min por usuario (request 11 devuelve 429)
- [ ] Rate limiting se resetea después del TTL

### CORS
- [ ] API no arranca en producción sin ALLOWED_ORIGINS
- [ ] API arranca correctamente con ALLOWED_ORIGINS configurado
- [ ] Requests desde orígenes no permitidos son bloqueados

### Idempotencia Stripe
- [ ] Tabla StripeEvent existe en BD
- [ ] Primer webhook se procesa y guarda en BD
- [ ] Segundo webhook con mismo event.id se ignora (idempotente)
- [ ] Suscripción no se prorroga dos veces con mismo evento

### PermissionsGuard
- [ ] POST /cash/sessions requiere cash:create (403 sin permiso)
- [ ] POST /cash/sessions/:id/close requiere cash:update (403 sin permiso)
- [ ] POST /sales requiere sales:create (403 sin permiso)
- [ ] PATCH /sales/invoices/:id/void requiere sales:update (403 sin permiso)
- [ ] POST /expenses requiere expenses:create (403 sin permiso)
- [ ] DELETE /expenses/:id requiere expenses:delete (403 sin permiso)
- [ ] Usuarios con permisos pueden realizar las acciones (200/201)

---

## Herramientas recomendadas

### Para pruebas de API:
- **Postman** o **Insomnia** — Para requests HTTP
- **curl** — Para pruebas desde terminal
- **Swagger UI** — `http://localhost:3000/api-docs` (si está habilitado)

### Para pruebas de BD:
- **pgAdmin** o **DBeaver** — Para consultas SQL
- **psql** — Cliente PostgreSQL desde terminal

### Para pruebas de rate limiting:
- **Apache Bench (ab)** o **wrk** — Para hacer múltiples requests rápidamente:
  ```bash
  ab -n 11 -c 1 -H "Authorization: Bearer TOKEN" http://localhost:3000/auth/login
  ```

---

## Notas importantes

1. **Rate limiting solo funciona en producción:** En desarrollo (`NODE_ENV !== 'production'`), el rate limiting está desactivado. Para probarlo, configura `NODE_ENV=production` temporalmente.

2. **CORS en desarrollo:** En desarrollo, CORS permite cualquier origen. Solo en producción se valida `ALLOWED_ORIGINS`.

3. **Webhooks Stripe:** Para probar idempotencia, necesitas `STRIPE_WEBHOOK_SECRET` configurado y eventos válidos de Stripe. Puedes usar Stripe CLI para generar eventos de prueba.

4. **Permisos:** Asegúrate de que los usuarios de prueba tengan los permisos correctos asignados en la BD (tabla `RolePermission`).

---

**Última actualización:** Febrero 2026
