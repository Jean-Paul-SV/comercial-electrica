# Guía de Testing - Cambios Febrero 2026

> Cómo probar los cambios implementados: caché en listados, summary en auditoría, mensajes de error mejorados y validaciones.

---

## 1. Caché en listados (Productos, Clientes, Ventas)

### 1.1 Verificar que funciona

**Requisitos:**
- Redis corriendo (`REDIS_URL` configurado en `.env`)
- API y web corriendo

**Pasos:**

1. **Productos:**
   ```bash
   # Primera llamada (sin caché)
   curl -H "Authorization: Bearer TOKEN" http://localhost:3000/products?page=1&limit=20
   # Anotar tiempo de respuesta
   
   # Segunda llamada inmediata (debe venir de caché, más rápida)
   curl -H "Authorization: Bearer TOKEN" http://localhost:3000/products?page=1&limit=20
   # Debe ser más rápida
   ```

2. **Clientes:**
   ```bash
   curl -H "Authorization: Bearer TOKEN" http://localhost:3000/customers?page=1&limit=20
   # Repetir inmediatamente para verificar caché
   ```

3. **Ventas:**
   ```bash
   curl -H "Authorization: Bearer TOKEN" http://localhost:3000/sales?page=1&limit=20
   # Repetir inmediatamente
   ```

**Verificación en Redis (opcional):**
```bash
redis-cli
KEYS cache:products:list:*
KEYS cache:customers:list:*
KEYS cache:sales:list:*
# Deberías ver las claves con TTL > 0
TTL cache:products:list:TENANT_ID:1:20
# Debe mostrar ~90 segundos (productos/clientes) o ~60 (ventas)
```

### 1.2 Verificar invalidación

1. **Crear un producto nuevo:**
   ```bash
   POST /products
   ```

2. **Listar productos inmediatamente:**
   ```bash
   GET /products?page=1&limit=20
   ```
   El nuevo producto debe aparecer (caché invalidado).

3. **Repetir con clientes y ventas:**
   - Crear cliente → listar (debe aparecer)
   - Crear venta → listar (debe aparecer)

### 1.3 Verificar que NO cachea con búsqueda/filtros

```bash
# Con búsqueda NO debe usar caché (siempre va a BD)
GET /products?page=1&limit=20&search=test
GET /products?page=1&limit=20&zeroStock=true
GET /products?page=1&limit=20&sortByStock=asc

# Página 2 tampoco cachea
GET /products?page=2&limit=20
```

---

## 2. Campo `summary` en auditoría

### 2.1 Verificar que se guarda

**Pasos:**

1. **Crear una venta:**
   ```bash
   POST /sales
   {
     "cashSessionId": "...",
     "items": [...]
   }
   ```

2. **Consultar auditoría:**
   ```bash
   GET /audit-logs?entity=sale&action=create
   ```

3. **Verificar en la respuesta:**
   - El log debe tener `summary` con formato: `"Venta #INV-001 por $150.000 (3 productos)"`
   - En el frontend (`/audit`), la columna "Detalles" debe mostrar el summary en lugar de solo el diff

### 2.2 Verificar summary en caja

1. **Abrir sesión de caja:**
   ```bash
   POST /cash/sessions
   { "openingAmount": 50000 }
   ```

2. **Consultar auditoría:**
   ```bash
   GET /audit-logs?entity=cashSession&action=create
   ```
   Summary esperado: `"Sesión de caja abierta con $50.000"`

3. **Cerrar sesión:**
   ```bash
   PATCH /cash/sessions/:id/close
   { "closingAmount": 150000 }
   ```

4. **Consultar auditoría:**
   ```bash
   GET /audit-logs?entity=cashSession&action=update
   ```
   Summary esperado: `"Sesión de caja cerrada con $150.000"`

### 2.3 Verificar summary por defecto

Para logs que no tienen summary explícito, debe generarse `"entity · action"`:

```bash
# Crear un proveedor
POST /suppliers
# Consultar auditoría
GET /audit-logs?entity=supplier&action=create
# Summary debe ser: "supplier · create"
```

---

## 3. Mensajes de error mejorados

### 3.1 Probar en frontend (Clientes)

**Pasos:**

1. **Abrir `/customers` en el navegador**

2. **Intentar crear cliente con datos inválidos:**
   - Email inválido: `"test@"`
   - Nombre muy corto: `"A"`
   - Dejar campos requeridos vacíos
   
   **Verificar:** El toast debe mostrar el mensaje de validación de la API, no un error genérico.

3. **Intentar crear cliente duplicado (mismo docType + docNumber):**
   - Crear cliente con CC `123456789`
   - Intentar crear otro con CC `123456789`
   
   **Verificar:** Toast con mensaje claro: `"Ya existe un cliente con este documento"` o similar.

4. **Simular error de red (opcional):**
   - Desconectar internet
   - Intentar crear cliente
   - **Verificar:** Mensaje de error de red claro

### 3.2 Probar códigos HTTP específicos

**En el navegador (DevTools → Network):**

1. **401 (No autenticado):**
   - Cerrar sesión
   - Intentar crear cliente
   - **Verificar:** Toast: `"Sesión expirada. Inicia sesión de nuevo."`

2. **403 (Sin permiso):**
   - Usar usuario sin permiso `customers:create`
   - Intentar crear cliente
   - **Verificar:** Toast: `"No tienes permiso para hacer esta acción."`

3. **404 (No encontrado):**
   - Intentar editar cliente con ID inexistente
   - **Verificar:** Toast: `"No se encontró el recurso."`

4. **500 (Error servidor):**
   - Simular error en backend (ej. desconectar BD)
   - **Verificar:** Toast: `"Error del servidor. Intenta más tarde."`

---

## 4. Validaciones de negocio

### 4.1 Cierre de caja con ventas pendientes

**Pasos:**

1. **Abrir sesión de caja:**
   ```bash
   POST /cash/sessions
   { "openingAmount": 100000 }
   ```

2. **Crear una venta (sin facturar aún):**
   ```bash
   POST /sales
   {
     "cashSessionId": "...",
     "items": [...],
     "status": "PENDING"  # Si el endpoint lo permite
   }
   ```

3. **Intentar cerrar la caja:**
   ```bash
   PATCH /cash/sessions/:id/close
   { "closingAmount": 150000 }
   ```

4. **Verificar error:**
   - Status: `400 Bad Request`
   - Mensaje: `"No se puede cerrar la sesión. Hay 1 venta(s) pendiente(s) de facturar. Factúrelas o anúlelas antes de cerrar la caja."`

### 4.2 Ventas: Stock insuficiente

**Pasos:**

1. **Crear producto con stock bajo:**
   ```bash
   POST /products
   {
     "internalCode": "TEST-STOCK",
     "name": "Producto Test",
     "price": 1000,
     "stock": { "qtyOnHand": 5 }
   }
   ```

2. **Intentar crear venta con cantidad mayor:**
   ```bash
   POST /sales
   {
     "cashSessionId": "...",
     "items": [
       { "productId": "...", "qty": 10 }  # Más que el stock disponible
     ]
   }
   ```

3. **Verificar error:**
   - Status: `400 Bad Request`
   - Mensaje: `"Stock insuficiente para \"Producto Test\". Disponible: 5, requerido: 10."`

### 4.3 Gastos: Fecha futura

**Pasos:**

1. **Intentar crear gasto con fecha futura:**
   ```bash
   POST /expenses
   {
     "amount": 10000,
     "description": "Test",
     "expenseDate": "2027-12-31"  # Fecha futura
   }
   ```

2. **Verificar error:**
   - Status: `400 Bad Request`
   - Mensaje: `"La fecha del gasto no puede ser futura."`

### 4.4 Facturas proveedor: Fecha vencimiento

**Pasos:**

1. **Intentar crear factura con fecha vencimiento anterior a fecha factura:**
   ```bash
   POST /supplier-invoices
   {
     "supplierId": "...",
     "invoiceDate": "2026-02-10",
     "dueDate": "2026-02-05",  # Anterior a invoiceDate
     "subtotal": 100000,
     "taxRate": 19
   }
   ```

2. **Verificar error:**
   - Status: `400 Bad Request`
   - Mensaje: `"La fecha de vencimiento debe ser posterior a la fecha de la factura."`

---

## 5. Testing completo con frontend

### 5.1 Flujo completo: Crear venta → Ver auditoría

1. **Abrir sesión de caja** (`/cash`)
2. **Crear venta** (`/sales`)
   - Seleccionar productos
   - Confirmar
   - **Verificar:** Toast de éxito
3. **Ir a Auditoría** (`/audit`)
   - Filtrar por entidad: `sale`, acción: `create`
   - **Verificar:** 
     - Aparece el log con `summary` descriptivo
     - En la columna "Detalles" se muestra el summary
     - Al hacer clic en "Ver detalles", el modal muestra el summary en la sección "Resumen"

### 5.2 Flujo completo: Listados con caché

1. **Ir a Productos** (`/products`)
   - **Primera carga:** Anotar tiempo (puede ser lento si hay muchos productos)
   - **Recargar página inmediatamente:** Debe ser más rápida (caché)
   - **Buscar algo:** Debe seguir funcionando (no usa caché)
   - **Crear producto nuevo:** 
     - Volver al listado
     - **Verificar:** El nuevo producto aparece (caché invalidado)

2. **Repetir con Clientes** (`/customers`) y **Ventas** (`/sales`)

---

## 6. Verificación en base de datos (opcional)

### 6.1 Verificar summary en AuditLog

```sql
-- Ver los últimos logs con summary
SELECT 
  entity, 
  action, 
  summary, 
  "createdAt"
FROM "AuditLog"
WHERE summary IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 20;

-- Verificar que los logs nuevos tienen summary
SELECT 
  COUNT(*) FILTER (WHERE summary IS NOT NULL) as con_summary,
  COUNT(*) FILTER (WHERE summary IS NULL) as sin_summary,
  COUNT(*) as total
FROM "AuditLog"
WHERE "createdAt" > NOW() - INTERVAL '1 day';
```

### 6.2 Verificar tenantId en AuditLog

```sql
-- Verificar que los logs nuevos tienen tenantId
SELECT 
  COUNT(*) FILTER (WHERE "tenantId" IS NOT NULL) as con_tenant,
  COUNT(*) FILTER (WHERE "tenantId" IS NULL) as sin_tenant
FROM "AuditLog"
WHERE "createdAt" > NOW() - INTERVAL '1 day';
```

---

## 7. Checklist rápido

- [ ] Caché funciona en productos (primera página, sin búsqueda)
- [ ] Caché funciona en clientes (primera página, sin búsqueda)
- [ ] Caché funciona en ventas (primera página, sin búsqueda)
- [ ] Caché se invalida al crear/actualizar producto
- [ ] Caché se invalida al crear/actualizar cliente
- [ ] Caché se invalida al crear venta
- [ ] Summary aparece en logs de ventas
- [ ] Summary aparece en logs de caja (abrir/cerrar)
- [ ] Summary por defecto (`entity · action`) funciona
- [ ] Mensajes de error claros en frontend (clientes)
- [ ] Validación: No cerrar caja con ventas pendientes
- [ ] Validación: Stock insuficiente en ventas
- [ ] Validación: Fecha futura en gastos
- [ ] Validación: Fecha vencimiento en facturas proveedor

---

## 8. Troubleshooting

### Caché no funciona

- **Verificar Redis:** `redis-cli ping` debe responder `PONG`
- **Verificar variables de entorno:** `REDIS_URL` en `.env`
- **Ver logs de API:** Buscar `Redis connected` o warnings de conexión

### Summary no aparece

- **Verificar migración:** `npx prisma migrate deploy` en `apps/api`
- **Verificar que el log es nuevo:** Los logs antiguos no tienen summary
- **Verificar código:** El servicio debe pasar `summary` en el contexto de `logCreate`/`logUpdate`

### Mensajes de error genéricos

- **Verificar que se importa `getErrorMessage`:** `import { getErrorMessage } from '@shared/utils/errors'`
- **Verificar uso:** `onError: (e) => toast.error(getErrorMessage(e, 'fallback'))`
- **Verificar que la API devuelve `message`:** Revisar respuesta en DevTools → Network

---

**Última actualización:** Febrero 2026
