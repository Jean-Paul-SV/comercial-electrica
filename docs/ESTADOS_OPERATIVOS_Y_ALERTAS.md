# Estados operativos y alertas del negocio

**Autor:** Product Engineer – Sistemas de gestión empresarial  
**Objetivo:** Que el sistema no solo registre datos, sino que **interprete el estado operativo** del negocio, detecte situaciones críticas y relevantes automáticamente, y **ayude a tomar decisiones** mediante indicadores, alertas y acciones sugeridas.

---

## 1. Definición de estados clave del negocio

Los estados operativos son **situaciones detectables** a partir de los datos ya existentes (caja, inventario, cotizaciones, ventas, productos). Cada estado tiene:

- **Código** único (para API y UI)
- **Descripción** para el usuario
- **Área** (caja, inventario, ventas, cotizaciones, compras, etc.)
- **Regla de detección** (qué consultar y con qué umbrales)
- **Severidad** (crítica, alta, media, baja, informativa)
- **Prioridad** (orden de aparición / atención)
- **Acciones sugeridas** (qué hacer cuando el estado está activo)

### 1.1 Catálogo de estados

| Código | Nombre | Área | Descripción breve |
|--------|--------|------|--------------------|
| `CASH_NO_SESSION` | Sin caja abierta | Caja | No hay ninguna sesión de caja abierta; no se pueden registrar ventas ni movimientos. |
| `CASH_SESSION_OPEN` | Caja abierta | Caja | Hay al menos una sesión de caja abierta (estado normal operativo). |
| `CASH_MULTIPLE_OPEN` | Múltiples cajas abiertas | Caja | Hay más de una sesión abierta; riesgo de confusión o error de cierre. |
| `CASH_SESSION_OLD` | Caja abierta hace mucho | Caja | La sesión abierta lleva más de N horas sin cerrar (ej. fin del día no cerrado). |
| `STOCK_LOW` | Stock bajo | Inventario | Productos con cantidad en mano ≤ umbral configurable. |
| `STOCK_ZERO` | Sin stock | Inventario | Productos activos con cantidad en mano = 0 (no se puede vender). |
| `STOCK_RESERVED_OVER` | Reserva mayor que stock | Inventario | qtyReserved > qtyOnHand en algún producto (inconsistencia). |
| `QUOTES_EXPIRED` | Cotizaciones vencidas | Cotizaciones | Cotizaciones en DRAFT o SENT con validUntil &lt; hoy. |
| `QUOTES_EXPIRING_SOON` | Cotizaciones por vencer | Cotizaciones | Cotizaciones vigentes que vencen en los próximos N días. |
| `QUOTES_PENDING` | Cotizaciones pendientes | Cotizaciones | Cantidad de cotizaciones vigentes (DRAFT/SENT, validUntil ≥ hoy). |
| `SALES_ANOMALY_LOW` | Ventas anómalas (bajas) | Ventas | Ventas del día muy por debajo del promedio reciente (ej. últimos 7 días). |
| `SALES_ANOMALY_ZERO` | Sin ventas hoy | Ventas | Cero ventas pagadas en el día (puede ser intencional o fallo). |
| `SALES_ANOMALY_HIGH` | Ventas anómalas (altas) | Ventas | Ventas del día muy por encima del promedio (posible dato atípico o evento especial). |
| `PRODUCTS_NO_ROTATION` | Productos sin rotación | Inventario/Ventas | Productos activos sin ventas en los últimos N días. |
| `INVOICES_OVERDUE` | Facturas proveedor vencidas | Compras | Facturas de proveedor en estado PENDING con dueDate &lt; hoy. |
| `INVOICES_DUE_SOON` | Facturas por vencer | Compras | Facturas PENDING que vencen en los próximos N días. |
| `PURCHASE_ORDERS_PENDING` | Órdenes de compra pendientes | Compras | Órdenes en DRAFT/SENT no recibidas o parcialmente recibidas. |

Estos estados se pueden ampliar (ej. alertas DIAN, backups, gastos desalineados con caja) sin cambiar la estructura.

---

## 2. Reglas para detectar cada estado

Cada regla se expresa como **condición(es) sobre los datos** y, cuando aplica, **umbrales configurables** (por tenant o globales).

### 2.1 Caja

| Estado | Regla | Parámetros |
|--------|-------|------------|
| `CASH_NO_SESSION` | `count(CashSession WHERE closedAt IS NULL) = 0` | — |
| `CASH_SESSION_OPEN` | `count(CashSession WHERE closedAt IS NULL) = 1` | — |
| `CASH_MULTIPLE_OPEN` | `count(CashSession WHERE closedAt IS NULL) > 1` | — |
| `CASH_SESSION_OLD` | Existe sesión con `closedAt IS NULL` y `openedAt < now() - N hours` | `hoursThreshold` (ej. 12 o 24) |

**Consultas sugeridas (Prisma):**

- Sin caja: `prisma.cashSession.count({ where: { closedAt: null } }) === 0`
- Múltiples: `count > 1`
- Sesión antigua: `prisma.cashSession.findFirst({ where: { closedAt: null, openedAt: { lt: cutoff } } })`

### 2.2 Inventario

| Estado | Regla | Parámetros |
|--------|-------|------------|
| `STOCK_LOW` | Productos activos con `StockBalance.qtyOnHand <= threshold` | `lowStockThreshold` (ej. 10) |
| `STOCK_ZERO` | Productos activos con `qtyOnHand = 0` (o sin registro en StockBalance) | — |
| `STOCK_RESERVED_OVER` | `StockBalance` donde `qtyReserved > qtyOnHand` | — |

**Consultas:** Ya tienes lógica similar en `reports.service` (lowStock, inventory report). Para “sin stock” considerar también productos sin fila en `StockBalance` (qtyOnHand implícito 0).

### 2.3 Cotizaciones

| Estado | Regla | Parámetros |
|--------|-------|------------|
| `QUOTES_EXPIRED` | Cotizaciones con `status IN ('DRAFT','SENT')` y `validUntil < now()` | — |
| `QUOTES_EXPIRING_SOON` | `status IN ('DRAFT','SENT')`, `validUntil >= now()` y `validUntil <= now() + N days` | `daysAhead` (ej. 7) |
| `QUOTES_PENDING` | Count de cotizaciones vigentes (DRAFT/SENT, validUntil ≥ hoy) | — |

**Consultas:** Alineadas con `reports.service` (pendingQuotes, expiringQuotes). Opcional: job que actualice `status` a `EXPIRED` cuando `validUntil < now()` (ya lo tienes en `quotes.service`).

### 2.4 Ventas anómalas

| Estado | Regla | Parámetros |
|--------|-------|------------|
| `SALES_ANOMALY_ZERO` | Hoy no hay ventas con `status = 'PAID'` (count = 0). | — |
| `SALES_ANOMALY_LOW` | Total vendido hoy &lt; (promedio diario últimos N días) × factor_min | `lookbackDays` (ej. 7), `minFactor` (ej. 0.3) |
| `SALES_ANOMALY_HIGH` | Total vendido hoy &gt; (promedio diario últimos N días) × factor_max | `lookbackDays`, `maxFactor` (ej. 2.5) |

**Cálculo sugerido:**

- Promedio diario = suma(grandTotal, ventas PAID en los últimos `lookbackDays`) / días con al menos una venta (o / lookbackDays).
- Comparar total del día actual con ese promedio; si está por debajo de `minFactor` → LOW; si está por encima de `maxFactor` → HIGH.

### 2.5 Productos sin rotación

| Estado | Regla | Parámetros |
|--------|-------|------------|
| `PRODUCTS_NO_ROTATION` | Productos activos que no aparecen en ningún `SaleItem` de ventas PAID en los últimos N días | `rotationDays` (ej. 30, 60, 90) |

**Consulta sugerida:**  
Productos activos cuyo `id` no está en:

```ts
// Ventas PAID en los últimos rotationDays
saleIds = Sale.where(status PAID, soldAt >= now - rotationDays).pluck(:id)
productIdsSold = SaleItem.where(saleId in saleIds).distinct(:productId)
// Productos activos que NO están en productIdsSold
Product.where(isActive: true).where.not(id: productIdsSold)
```

En Prisma: subquery o dos pasos (ids de productos vendidos en el periodo, luego productos activos cuyo id no está en esa lista).

### 2.6 Facturas proveedor

| Estado | Regla | Parámetros |
|--------|-------|------------|
| `INVOICES_OVERDUE` | `SupplierInvoice` con `status = 'PENDING'` y `dueDate < today` | — |
| `INVOICES_DUE_SOON` | `status = 'PENDING'` y `dueDate` entre hoy y hoy + N días | `daysAhead` (ej. 7) |

---

## 3. Cómo representarlos en el sistema

### 3.1 Modelo de representación: alertas e indicadores

- **Indicador (KPI/estado):** valor actual de una métrica (ej. “3 sesiones abiertas”, “5 productos con stock bajo”). Se usa para paneles y resúmenes.
- **Alerta:** un estado operativo **activado** en un momento dado, con severidad y prioridad, opcionalmente con **acción sugerida** y enlace a la entidad afectada.

Se recomienda un **endpoint único** que devuelva tanto indicadores como alertas, para que el frontend construya el dashboard y el centro de alertas.

### 3.2 Estructura de datos sugerida (API)

**Indicadores (resumen por área):**

```ts
// GET /reports/operational-state o GET /reports/dashboard (extender el actual)
{
  "indicators": {
    "cash": {
      "openSessionsCount": 1,
      "hasOpenSession": true,
      "oldestOpenAt": "2026-01-29T08:00:00Z"
    },
    "inventory": {
      "lowStockCount": 5,
      "zeroStockCount": 2,
      "noRotationCount": 12
    },
    "quotes": {
      "pendingCount": 4,
      "expiringSoonCount": 2,
      "expiredCount": 3
    },
    "sales": {
      "todayCount": 7,
      "todayTotal": 1250000,
      "avgDailyTotalLast7": 980000
    },
    "supplierInvoices": {
      "overdueCount": 1,
      "dueSoonCount": 2
    }
  },
  "alerts": [
    {
      "code": "STOCK_ZERO",
      "severity": "high",
      "priority": 2,
      "title": "Productos sin stock",
      "message": "2 productos activos tienen 0 unidades. No se pueden vender.",
      "area": "inventory",
      "count": 2,
      "actionLabel": "Ver productos",
      "actionHref": "/products?filter=zeroStock",
      "entityIds": ["uuid-1", "uuid-2"],
      "detectedAt": "2026-01-29T14:00:00Z"
    },
    {
      "code": "QUOTES_EXPIRED",
      "severity": "medium",
      "priority": 3,
      "title": "Cotizaciones vencidas",
      "message": "3 cotizaciones vencieron sin convertirse. Considera actualizar vigencia o cancelar.",
      "area": "quotes",
      "count": 3,
      "actionLabel": "Ver cotizaciones vencidas",
      "actionHref": "/quotes?status=EXPIRED",
      "entityIds": [],
      "detectedAt": "2026-01-29T14:00:00Z"
    }
  ]
}
```

### 3.3 Severidad y prioridad

- **Severidad:** impacto del estado (crítica → informativa). Define color e intensidad en UI.
- **Prioridad:** orden de presentación (1 = primero). Permite ordenar la lista de alertas.

| Severidad | Uso típico | Color sugerido (ej.) |
|-----------|------------|----------------------|
| `critical` | Bloquea operación o riesgo alto (ej. sin caja abierta para vender) | Rojo |
| `high` | Requiere atención pronto (stock cero, facturas vencidas) | Naranja |
| `medium` | Importante pero no urgente (cotizaciones vencidas, stock bajo) | Amarillo |
| `low` | Informativo (cotizaciones por vencer, ventas anómalas altas) | Azul |
| `info` | Solo contexto (caja abierta, cantidad de pendientes) | Gris |

| Estado | Severidad | Prioridad (sugerida) |
|--------|-----------|------------------------|
| `CASH_NO_SESSION` | critical | 1 |
| `CASH_MULTIPLE_OPEN` | high | 2 |
| `CASH_SESSION_OLD` | medium | 3 |
| `STOCK_ZERO` | high | 2 |
| `STOCK_RESERVED_OVER` | high | 2 |
| `STOCK_LOW` | medium | 4 |
| `QUOTES_EXPIRED` | medium | 3 |
| `INVOICES_OVERDUE` | high | 2 |
| `QUOTES_EXPIRING_SOON` | low | 5 |
| `INVOICES_DUE_SOON` | low | 5 |
| `SALES_ANOMALY_ZERO` | medium | 4 |
| `SALES_ANOMALY_LOW` | low | 5 |
| `PRODUCTS_NO_ROTATION` | low | 6 |
| `CASH_SESSION_OPEN` | info | — (indicador, no alerta) |
| `QUOTES_PENDING` | info | — |

La prioridad puede ser configurable por negocio (orden de importancia).

### 3.4 Representación en UI

- **Dashboard / home:**  
  - Bloque de **indicadores** por área (caja, inventario, cotizaciones, ventas).  
  - Bloque de **alertas** ordenadas por prioridad (y luego por severidad), con título, mensaje, y botón de acción.

- **Barra superior o panel lateral:**  
  - Icono de “alertas” con badge con cantidad de alertas de severidad critical/high.  
  - Al hacer clic: lista compacta con enlace a “Ver todas” (ej. `/alerts` o sección en reportes).

- **Páginas de módulo:**  
  - Banner o card cuando el estado afecta a ese módulo (ej. en Caja: “No hay sesión abierta” con botón “Abrir caja”; en Productos: “5 productos con stock bajo” con enlace a filtro).

- **Acciones sugeridas:**  
  - Cada alerta puede llevar `actionLabel` y `actionHref` (o `actionRoute` + query params) para que “Ver productos”, “Abrir caja”, “Ver cotizaciones vencidas” lleven directamente a la pantalla adecuada.

Así el sistema **orienta la decisión**: no solo “hay 5 productos con stock bajo”, sino “revisa estos productos y repone o desactiva”.

---

## 4. Prioridad y severidad (resumen)

- **Severidad** = impacto: critical → high → medium → low → info.  
- **Prioridad** = orden de atención: 1, 2, 3… (configurable).  
- Estados que **bloquean** o implican **riesgo legal/operativo** (sin caja, facturas vencidas, stock cero) = critical o high.  
- Estados **informativos** (caja abierta, pendientes) = info o low, y pueden ser solo indicadores sin alerta intrusiva.

---

## 5. Ayudar a tomar decisiones (acciones sugeridas)

Para cada estado, el sistema puede devolver una **acción sugerida** que lleve al usuario a la pantalla o flujo correcto.

| Estado | Acción sugerida (ejemplo) |
|--------|---------------------------|
| `CASH_NO_SESSION` | “Abrir caja” → `/cash` con modal o botón destacado para abrir sesión. |
| `CASH_MULTIPLE_OPEN` | “Revisar sesiones de caja” → `/cash` listado de sesiones abiertas para cerrar las que sobran. |
| `CASH_SESSION_OLD` | “Cerrar caja o continuar” → `/cash` detalle de la sesión con botón Cerrar. |
| `STOCK_ZERO` | “Ver productos sin stock” → `/products?stock=zero` o filtro “Sin stock”. |
| `STOCK_LOW` | “Ver productos con stock bajo” → `/products` o reporte inventario con filtro lowStock. |
| `QUOTES_EXPIRED` | “Ver cotizaciones vencidas” → `/quotes?status=EXPIRED`; opción “Actualizar vigencia” o “Cancelar”. |
| `QUOTES_EXPIRING_SOON` | “Ver cotizaciones por vencer” → `/quotes` con filtro por fecha de vencimiento. |
| `SALES_ANOMALY_ZERO` | “Registrar ventas” o “Revisar caja” → según contexto (¿caja abierta?). |
| `INVOICES_OVERDUE` | “Ver facturas vencidas” → `/supplier-invoices?status=PENDING&overdue=true`. |
| `INVOICES_DUE_SOON` | “Ver facturas por vencer” → `/supplier-invoices` filtro por dueDate. |
| `PRODUCTS_NO_ROTATION` | “Ver productos sin rotación” → reporte o `/products` con filtro “Sin ventas en X días”. |

En backend, cada alerta incluye `actionLabel` y `actionHref` (o `actionRoute` + params). En frontend, el botón de la alerta usa ese enlace para que **el siguiente paso sea claro**.

---

## 6. Implementación técnica sugerida

### 6.1 Backend

1. **Servicio de estados operativos** (ej. `OperationalStateService` o extender `ReportsService`):
   - Métodos por área: `getCashState()`, `getInventoryIndicators()`, `getQuotesIndicators()`, `getSalesAnomaly()`, `getSupplierInvoicesAlerts()`, `getNoRotationProducts()`.
   - Un método `getOperationalState(options?)` que ejecute todas las reglas (o las habilitadas), calcule indicadores y construya el array `alerts` con severidad, prioridad y acciones sugeridas.
   - Umbrales en configuración (env o tabla `TenantConfig` / `AlertConfig` si multi-tenant).

2. **Endpoint:**
   - `GET /reports/operational-state` o extender `GET /reports/dashboard` para incluir `indicators` y `alerts` con la estructura anterior.
   - Cache corto (ej. 1–2 minutos) para no sobrecargar; invalidar tras acciones relevantes (abrir/cerrar caja, venta, movimiento de stock) si se desea máxima frescura.

3. **Opcional – job programado:**
   - Marcar cotizaciones como EXPIRED cuando `validUntil < now()` (ya lo tienes); opcionalmente generar eventos de auditoría o notificaciones cuando se detecten alertas critical/high.

### 6.2 Frontend

1. **Hook o API:** `useOperationalState()` que llame a `GET /reports/operational-state` y exponga `indicators`, `alerts`, y quizá `criticalCount` / `highCount` para el badge.
2. **Dashboard:** sección “Estado del negocio” con indicadores por área y lista de alertas con botones de acción.
3. **Barra/header:** icono de campana o alertas con badge y dropdown con las primeras N alertas y “Ver todas”.
4. **Páginas de módulo:** uso opcional de la misma API para mostrar solo alertas de ese módulo (ej. en Caja solo `CASH_*`).

### 6.3 Configuración de umbrales

- Valores por defecto en código o env (ej. `LOW_STOCK_THRESHOLD=10`, `QUOTES_EXPIRING_DAYS=7`, `CASH_SESSION_OLD_HOURS=12`).
- Si hay multi-tenant, tabla `AlertConfig` o `TenantConfig` con clave/valor por negocio para poder cambiar umbrales sin desplegar.

---

## 7. Resumen de entregables

| Entregable | Contenido |
|------------|-----------|
| **Estados clave** | Catálogo de códigos (CASH_*, STOCK_*, QUOTES_*, SALES_ANOMALY_*, etc.) con descripción y área. |
| **Reglas de detección** | Condiciones y consultas (Prisma) por estado, con umbrales configurables. |
| **Representación** | Estructura API: `indicators` por área + `alerts[]` con code, severity, priority, title, message, actionLabel, actionHref, entityIds. |
| **Prioridad y severidad** | Tabla estado → severity/priority; criterios para elegir critical/high/medium/low/info. |
| **Decisiones** | Acciones sugeridas por estado y uso en UI (dashboard, barra de alertas, banners por módulo). |

Con esto el sistema pasa de **solo registrar** a **interpretar el estado operativo** y **guiar la toma de decisiones** mediante indicadores claros y alertas accionables.
