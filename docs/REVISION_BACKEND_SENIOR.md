# Revisión del backend (visión senior)

Revisión de la lógica, seguridad, consistencia y posibles mejoras del backend (API NestJS) hasta la fecha.

---

## 1. Arquitectura y estructura

- **Módulos**: Separación clara por dominio (auth, catalog, sales, cash, customers, suppliers, purchases, supplier-invoices, quotes, inventory, reports, dian, audit, backups, metrics).
- **Patrón**: Controllers → Services → Prisma; DTOs con class-validator; filtro global de excepciones; guards JWT + Roles.
- **Compartido**: `ValidationLimitsService`, `AuditService`, `CacheService`, `createPaginatedResponse`, filtro Prisma→HTTP.

**Conclusión**: Estructura coherente y mantenible.

---

## 2. Autenticación y autorización

- **JWT**: Payload incluye `sub`, `email`, `role`; el strategy devuelve el payload → `req.user` tiene `role`.
- **RolesGuard**: Si el handler/clase tiene `@Roles(RoleName.ADMIN)`, se exige ese rol; si no hay `@Roles`, cualquier usuario autenticado puede acceder.
- **Catalog**: Solo `DELETE products/:id` (desactivar producto) está restringido a ADMIN; crear/actualizar productos y categorías está abierto a USER.
- **Sales, Cash, Quotes, Customers, Inventory**: Sin restricción por rol (solo JWT).
- **Purchases, SupplierInvoices, Reports**: Sin `@Roles` en controllers; si el front oculta rutas por rol, la API no impide acceso directo a USER (decisión de producto: reforzar con `@Roles(RoleName.ADMIN)` si se desea).

**Conclusión**: Auth bien encadenada (JWT → role). Roles solo donde se definió (catalog delete). Si se quiere “solo ADMIN en compras/facturas proveedor/reportes”, añadir `@Roles(RoleName.ADMIN)` en esos controllers.

---

## 3. Lógica de negocio por dominio

### 3.1 Ventas (`sales.service.ts`)

- Validación: items no vacíos, límites de cantidad/items, sesión de caja existente y abierta, cliente opcional existente.
- Transacción: productos existentes → cálculo de totales → comprobación de stock → descuento de stock → creación Sale + SaleItems → CashMovement → Invoice → DianDocument → AuditLog.
- Stock: se comprueba `qtyOnHand >= qty` y se actualiza dentro de la misma transacción (Serializable).
- DIAN: encolado después del commit (`.then()`), correcto.
- Caché: `deletePattern('cache:sales:*')` en `.then()` después del commit, correcto.

**Posible mejora**: El endpoint devuelve `{ sale, invoice, dianDocument }`. La venta no incluye `customer` ni `invoices` en el `include`; si el cliente quiere mostrar la venta recién creada con esos datos, habría que ampliar el `include` o documentar la forma actual.

### 3.2 Caja (`cash.service.ts`)

- Abrir: validación de monto (límites), creación de sesión, auditoría.
- Cerrar: sesión existe, no ya cerrada, sin ventas “pendientes” (status !== PAID), validación de monto, actualización `closedAt` y `closingAmount`.
- Listado de sesiones y movimientos: paginado correcto.

**Conclusión**: Lógica coherente con el modelo (una sesión abierta, ventas asociadas a movimientos de caja).

### 3.3 Catálogo (`catalog.service.ts`)

- Productos: list/get con caché; create con `internalCode` único (si se repite, Prisma P2002 → filtro devuelve 409).
- Create product: crea también `stock: { create: {} }` (StockBalance), correcto.
- Update: campos opcionales; no se valida duplicado de `internalCode` en update (si se cambia a uno ya usado, Prisma lanzará P2002).
- Desactivar: comprueba que no haya SaleItems; no pasa `deactivatedByUserId` desde el controller (auditoría sin actor).

**Mejora recomendada**: En el controller, llamar `deactivateProduct(id, req.user?.sub)` para registrar quién desactivó.

### 3.4 Inventario (`inventory.service.ts`)

- Tipos: IN (suma), OUT (resta), ADJUST: en el código `ADJUST` usa `sign = 1`, es decir, **siempre suma** stock. Para bajar stock se usa OUT con qty positiva.
- Validación: items no vacíos, proveedor solo en IN, límites de cantidad, productos existentes.
- Transacción: creación movimiento + actualización StockBalance por ítem; si algún saldo quedaría negativo, BadRequest.

**Conclusión**: Consistente. ADJUST = “ajuste positivo”; para negativos usar OUT.

### 3.5 Compras (`purchases.service.ts`)

- Crear pedido: proveedor existe y activo, productos existentes, totales calculados, número de orden único (`generateOrderNumber`), transacción correcta.
- **Problema**: Dentro de la transacción se llama `await this.cache.deletePattern('cache:purchaseOrders:*')`. Si la transacción hace rollback, el caché ya se invalidó (inconsistencia). La invalidación debe hacerse en `.then()` después del commit.
- Recibir pedido: validación de ítems y cantidades recibidas, actualización `receivedQty`, estado COMPLETED/PARTIALLY_RECEIVED, creación InventoryMovement + actualización stock. Misma observación: invalidación de caché dentro de la transacción; debe moverse fuera.

### 3.6 Facturas de proveedor (`supplier-invoices.service.ts`)

- Crear factura: proveedor existe y activo, pedido opcional existe, fechas (dueDate > invoiceDate), número único, totales.
- **Problema**: `deletePattern('cache:supplierInvoices:*')` dentro de la transacción; debe moverse a `.then()`.
- Crear pago: factura existe, no cancelada, nuevo paidAmount ≤ grandTotal, actualización estado (PENDING/PARTIALLY_PAID/PAID/OVERDUE). Misma observación: invalidación de caché dentro de la transacción.

### 3.7 Cotizaciones (`quotes.service.ts`)

- Crear/actualizar: productos existentes, totales, validUntil, cliente opcional; transacción y caché en `.then()` correctos.
- Convertir a venta: sesión de caja abierta, stock suficiente, creación Sale + CashMovement + Invoice + DianDocument, actualización quote a CONVERTED, encolado DIAN en `.then()`.
- Expiración: cron diario para pasar DRAFT/SENT con `validUntil < now` a EXPIRED.
- Transiciones de estado validadas en `updateQuoteStatus`.

**Conclusión**: Lógica sólida; caché ya fuera de la transacción donde corresponde.

### 3.8 Clientes (`customers.service.ts`)

- Crear: único (docType, docNumber); si se repite, Prisma P2002 → 409.
- Eliminar: solo se comprueba que no tenga **ventas** (`sales`). No se comprueba **cotizaciones** ni **facturas** (Invoice tiene customerId). Si el cliente tiene quotes o invoices, el delete fallará por FK (Prisma) con un error genérico.

**Mejora recomendada**: Antes de eliminar, comprobar también `quotes` (y opcionalmente invoices) y devolver BadRequest con mensaje claro (“No se puede eliminar: tiene cotizaciones/facturas asociadas”).

### 3.9 Reportes (`reports.service.ts`)

- Ventas, inventario, caja, clientes: filtros y rangos de fecha (máx. 1 año), límites, agregaciones correctas.
- Dashboard: ventas del día, stock bajo, sesiones abiertas, cotizaciones pendientes y por vencer; caché 1 minuto.

**Conclusión**: Sin errores de lógica detectados.

---

## 4. Validación y DTOs

- Uso de class-validator (IsUUID, IsEnum, Min, ArrayMinSize, ValidateNested, etc.) y ValidationPipe global.
- Límites de negocio en `ValidationLimitsService` (cantidades, montos, ítems por venta/cotización/pedido).
- Filtro global traduce Prisma (P2002, P2025, P2003, etc.) a códigos HTTP y mensajes claros.

**Conclusión**: Validación y manejo de errores bien alineados.

---

## 5. Caché (Redis)

- Claves: `cache:entity:id` o `cache:entity:list:page:limit`; invalidación por patrón `cache:entity:*` con SCAN (evita KEYS en producción).
- **Regla**: No invalidar caché dentro de una transacción de base de datos; hacerlo en `.then()` después del commit para no invalidar si hay rollback.
- **Ajustes necesarios**: Purchases (create + receive) y SupplierInvoices (create + createPayment) tienen invalidación dentro de la transacción; debe moverse a `.then()`.

---

## 6. Auditoría

- `AuditService`: logCreate, logUpdate, logDelete, logAuth; en test/CI no escribe (evita FK).
- Quién actúa: se pasa `req.user?.sub` en la mayoría de endpoints; en `deactivateProduct` el controller no pasa el usuario (ver mejora en catálogo).

---

## 7. Resumen de acciones recomendadas

| Prioridad | Acción |
|----------|--------|
| Alta | Mover invalidación de caché fuera de la transacción en `purchases.service` (createPurchaseOrder, receivePurchaseOrder) y `supplier-invoices.service` (createSupplierInvoice, createPayment). |
| Media | En `customers.service.delete`, comprobar también cotizaciones (y opcionalmente facturas) y devolver BadRequest con mensaje claro antes de intentar el delete. |
| Media | En `catalog.controller`, pasar `req.user?.sub` a `deactivateProduct(id, req.user?.sub)` para auditoría. |
| Baja | Valorar `@Roles(RoleName.ADMIN)` en controllers de Purchases, SupplierInvoices y Reports si se desea que solo ADMIN acceda por API. |
| Baja | Documentar o ampliar el response de `POST /sales` (incluir customer/invoices en sale si el cliente lo necesita). |

---

## 8. Conclusión general

El backend está bien estructurado, con transacciones donde importa (ventas, inventario, compras, facturas proveedor, cotizaciones), validaciones y límites de negocio, y manejo de errores unificado. Los puntos críticos a corregir son la invalidación de caché dentro de transacciones en Purchases y SupplierInvoices; el resto son mejoras de consistencia (cliente con cotizaciones/facturas, auditoría en desactivar producto) y opciones de producto (roles en reportes/compras/facturas proveedor).
