# Flujos: qué falta por integrar

> **Fecha:** Febrero 2026  
> **Objetivo:** Lista verificada contra el código de flujos API ↔ frontend.  
> **Excluido:** Integración DIAN e IA (dashboard-summary).  
> **Fuente:** Revisión de `apps/api/src/**/*.controller.ts` y `apps/web/src/app/(protected)/**`.

---

## Resumen ejecutivo

| Tipo | Cantidad | Ejemplos |
|------|----------|----------|
| **Flujo completo** | Mayoría | Ventas, cotizaciones (incl. convertir a factura), caja (abrir/cerrar sesión), inventario, clientes, productos, facturas (incl. anular), usuarios, auditoría |
| **Parcial – falta vista detalle** | 0 | — (todas implementadas) |
| **Parcial – falta flujo en UI** | 3 | Compras (página placeholder), Export CSV reportes, Estado operativo (hook sin uso en UI) |
| **Solo API (sin UI)** | 0 | — (pantalla Backups implementada) |

---

## 1. Flujos completos (API + frontend alineados)

Estos flujos tienen endpoints en la API y pantallas/acciones equivalentes en el frontend:

- **Auth:** login, cambio de contraseña, invitación y aceptar invitación (`/accept-invite`).
- **Dashboard:** KPIs, indicadores accionables, resumen (IA/fallback), enlaces a reportes.
- **Reportes:** pestañas con ventas por empleado, productos sin rotación, clusters de clientes (K-means); uso de `useDashboard`, `useActionableIndicators`, `useCustomerClusters`, `useSalesReport`, `useCashReport`, etc.
- **Caja:** sesiones abiertas/cerradas, movimientos; abrir/cerrar sesión integrado en `/cash`.
- **Inventario:** listado y movimientos.
- **Productos:** listado + detalle `/products/[id]`.
- **Clientes:** listado + detalle `/customers/[id]`.
- **Ventas:** listado + detalle `/sales/[id]`.
- **Cotizaciones:** listado + detalle `/quotes/[id]` y **convertir a factura** (con sesión de caja y método de pago) en la página de cotizaciones.
- **Facturas (ventas):** listado + **anular** factura (botón + confirmación + toasts) en `/invoices`.
- **Gastos, Devoluciones, Proveedores, Facturas proveedor:** listados con filtros, búsqueda, crear/editar/abonos desde el listado (según módulo).
- **Usuarios:** listado y gestión.
- **Auditoría:** listado de logs con filtros.
- **Onboarding y plan-required:** pantallas existentes.

---

## 2. Parcial – falta vista de detalle por ID

La API expone `GET /:entity/:id` y el frontend tiene hooks (`useReturn`, `useExpense`), pero **no hay ruta** `/:entity/[id]` para ver un solo registro en:

| Entidad | API | Frontend listado | Vista detalle |
|---------|-----|------------------|----------------|
| **Proveedores** | `GET /suppliers/:id` | ✅ `/suppliers` | ✅ `suppliers/[id]` (implementado) |
| **Facturas proveedor** | `GET /supplier-invoices/:id` | ✅ `/supplier-invoices` | ✅ `supplier-invoices/[id]` (implementado) |
| **Devoluciones** | `GET /returns/:id` | ✅ `/returns` | ✅ `returns/[id]` (implementado) |
| **Gastos** | `GET /expenses/:id` | ✅ `/expenses` | ✅ `expenses/[id]` (implementado) |

---

## 3. Parcial – falta integrar el flujo en la UI

### 3.1 Compras (pedidos de compra)

- **API:** `GET /purchases`, `GET /purchases/:id`, `POST /purchases`, `POST /purchases/:id/receive`.
- **Frontend:** Hooks `usePurchasesList`, `usePurchase`, `useCreatePurchase`, `useReceivePurchaseOrder` en `features/purchases`.
- **UI:** La página `/purchases` es un **placeholder** (“Módulo deshabilitado”) con enlaces a Facturas proveedor y Dashboard. No hay listado, ni alta de pedido, ni “recibir pedido”.

**Qué falta:** Implementar en `/purchases` el listado, el formulario de creación y la acción “Recibir pedido” (o mantener el placeholder y documentar que el flujo operativo es vía facturas de proveedor).

---

### 3.2 Exportar reportes a CSV

- **API:** `GET /reports/export?entity=sales|customers&startDate&endDate&limit` devuelve un CSV descargable.
- **Frontend:** No existe función en `features/reports/api.ts` ni hook para export; ninguna pantalla llama a este endpoint.

**Qué falta:** Añadir en `features/reports` la llamada a `/reports/export` (por ejemplo con `entity`, fechas y límite) y un botón “Exportar CSV” en la página de reportes (o en las pestañas de ventas/clientes) que dispare la descarga.

---

### 3.3 Estado operativo (alertas y acciones recomendadas)

- **API:** `GET /reports/operational-state` devuelve indicadores por área y alertas con acción sugerida.
- **Frontend:** Existe `getOperationalState` y `useOperationalState` en `features/reports`, pero **ninguna página** los usa.

**Qué falta:** Usar `useOperationalState` en el Dashboard (o en una sección “Acciones recomendadas”) para mostrar alertas de caja, inventario, cotizaciones, facturas proveedor, etc., con enlaces `actionHref` cuando existan.

---

## 4. Solo API (sin pantalla en el frontend)

### 4.1 Backups

- **API:** Crear, listar, descargar, verificar y eliminar backups (con opción S3). Endpoints bajo módulo/permiso correspondiente.
- **Frontend:** Pantalla **Backups** en `/backups` (Administración): listado, botón Nuevo backup, descargar, verificar y eliminar. Visible con permiso `backups:manage` y módulo `backups`.

---

## 5. Resumen: prioridad sugerida para integrar

| Prioridad | Qué integrar | Esfuerzo aproximado |
|-----------|----------------|---------------------|
| **Alta** | Estado operativo en Dashboard (uso de `useOperationalState`) | ✅ Hecho |
| **Media** | Export CSV en reportes (llamada + botón descarga) | ✅ Hecho |
| **Media** | Vistas detalle: proveedores, facturas proveedor | ✅ Hecho |
| **Baja** | Vistas detalle: devoluciones, gastos | ✅ Hecho |
| **Baja** | Pantalla de Backups (opcional) | ✅ Hecho |
| **Último** | Compras: sustituir placeholder por listado + crear + recibir pedido | 1–2 días |

---

## 6. Documentos relacionados

| Documento | Contenido |
|-----------|------------|
| **`TRAZABILIDAD_PENDIENTES.md`** | **Trazabilidad de lo que falta:** IDs (P-001…P-012), ubicación en código, prioridad, referencias. |
| `QUE_FALTA_TODO_EL_SOFTWARE.md` | Visión general de todo lo que falta (DIAN, frontend, API, seguridad, despliegue). |
| `RECUENTO_PENDIENTES.md` | Lista extensa de tareas; incluye DIAN y otras áreas. |
| `COMO_PROBAR_INTEGRACION_DIAN.md` | Pruebas de la integración DIAN. |

---

**Última actualización:** Febrero 2026
