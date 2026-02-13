# Trazabilidad: qué falta por implementar

> **Objetivo:** Lista actualizada (Febrero 2026) de lo que **realmente** falta por implementar, con IDs, ubicación en código y referencias.  
> **Fuentes:** `DIAN_INTEGRACION_ESTADO.md`, `QUE_FALTA_HASTA_LA_FECHA.md`, `FLUJOS_QUE_FALTAN_INTEGRAR.md`, `TRAZABILIDAD_PENDIENTES.md`, `CONTINGENCIA_DIAN.md`.

---

## Resumen ejecutivo

| Prioridad   | Área                         | Qué falta (resumen) |
|------------|------------------------------|---------------------|
| **Media**  | Compras (flujo UI)           | Listado, crear pedido, “Recibir pedido” en `/purchases` |
| **Baja**   | Configuración / operación    | Límite de login configurable por env (`LOGIN_THROTTLE_LIMIT`) |
| **Opcional** | Contingencia DIAN         | Botón “Reintentar envíos pendientes” (reencolar DRAFT) |
| **Opcional** | UX / producto             | Toasts donde falten, pulido responsive/accesibilidad |

**DIAN (facturación electrónica):** Envío real, CUFE, PDF y consulta de estado están **implementados**. Ver `DIAN_INTEGRACION_ESTADO.md`. Falta solo **validar en ambiente de habilitación/producción** con certificado y credenciales reales.

---

## Índice por ID (pendientes)

| ID   | Título | Prioridad | Estado   | Doc / código |
|------|--------|-----------|----------|---------------|
| F-001 | Compras: listado + crear + recibir pedido | Media | Pendiente | § Detalle F-001 |
| F-002 | Límite de login configurable | Baja | Pendiente | § Detalle F-002 |
| F-003 | Reintentar envíos DIAN pendientes (UI) | Opcional | Pendiente | § Detalle F-003 |
| F-004 | Toasts / pulido UX donde falte | Opcional | Parcial | Según auditoría |

---

## Detalle por ítem

### F-001 — Compras: listado + crear + recibir pedido

| Campo | Valor |
|-------|--------|
| **Descripción** | Sustituir la página placeholder de Compras por listado de pedidos, formulario de creación y acción “Recibir pedido”. La API y los hooks ya existen. |
| **Ubicación API** | `apps/api/src/purchases/purchases.controller.ts` — `GET /purchases`, `GET /purchases/:id`, `POST /purchases`, `POST /purchases/:id/receive` |
| **Ubicación frontend** | `apps/web/src/app/(protected)/purchases/page.tsx` (hoy placeholder); `apps/web/src/features/purchases/` (api, hooks, types ya existen) |
| **Referencias** | `FLUJOS_QUE_FALTAN_INTEGRAR.md` § 3.1 |
| **Esfuerzo estimado** | 1–2 días |

---

### F-002 — Límite de login configurable

| Campo | Valor |
|-------|--------|
| **Descripción** | Hacer que el límite de intentos de login (actualmente fijo, p. ej. 20/min) sea configurable por variable de entorno (p. ej. `LOGIN_THROTTLE_LIMIT`). |
| **Ubicación** | `ThrottlerModule` y decorador `@Throttle` del endpoint `POST /auth/login` en `apps/api/src/auth/` |
| **Referencias** | `QUE_FALTA_HASTA_LA_FECHA.md` — “Pendiente para mañana” |
| **Esfuerzo estimado** | < 1 día |

---

### F-003 — Reintentar envíos DIAN pendientes (UI)

| Campo | Valor |
|-------|--------|
| **Descripción** | Botón “Reintentar envíos pendientes” en Facturación electrónica o listado de facturas que llame a un endpoint que reencole los documentos DIAN en estado DRAFT del tenant. |
| **Ubicación API** | Nuevo endpoint (p. ej. `POST /dian/documents/retry-pending` o similar) que busque `DianDocument` con `status = DRAFT` del tenant y reencole jobs. |
| **Ubicación frontend** | Página de facturación electrónica o listado de facturas DIAN. |
| **Referencias** | `CONTINGENCIA_DIAN.md` — “Futuro: Botón Reintentar envíos pendientes” |
| **Esfuerzo estimado** | 0,5–1 día |

---

### F-004 — Toasts y pulido UX

| Campo | Valor |
|-------|--------|
| **Descripción** | Revisar formularios que aún no muestren toast en éxito/error; mensajes de error claros; responsive y accesibilidad donde falte. |
| **Ubicación** | Diversas páginas en `apps/web/src/app/(protected)/` |
| **Referencias** | `QUE_FALTA_HASTA_LA_FECHA.md` § 3, `RECOMENDACIONES_FRONTEND_SENIOR.md` |
| **Prioridad** | Baja / opcional |

---

## Ya implementado (referencia rápida)

- **DIAN:** XML UBL 2.1, firma digital, envío real (SOAP ReceiveInvoice), CUFE (SHA384 en XML), PDF (pdfkit + QR), consulta estado (GetStatus + sincronización). Ver `DIAN_INTEGRACION_ESTADO.md`.
- **Flujos UI:** Estado operativo en Dashboard, Export CSV reportes, vistas detalle (proveedores, facturas proveedor, devoluciones, gastos), pantalla Backups. Ver historial en `TRAZABILIDAD_PENDIENTES.md`.
- **SaaS / panel proveedor:** Planes, selector en Nueva empresa, PATCH tenant/plan, Stripe (webhook, suspensión por impago). Ver `QUE_FALTA_HASTA_LA_FECHA.md` § 2 y § 7.
- **Optimización móvil:** PWA (manifest, viewport), barra de navegación inferior en móvil, tablas con scroll táctil, área táctil mínima en botones icon.

---

## Orden sugerido

1. **F-001** — Compras (si se quiere el flujo completo pedido → recepción → inventario).
2. **F-002** — Límite de login configurable (rápido, útil para producción).
3. **F-003** — Reintentar DIAN (útil cuando se use facturación electrónica en producción).
4. **F-004** — Según necesidad (auditoría página a página).

---

## Documentos de referencia

| Documento | Contenido |
|-----------|-----------|
| **`DIAN_INTEGRACION_ESTADO.md`** | Estado por componente DIAN (envío, PDF, CUFE, consulta); variables de entorno. |
| **`QUE_FALTA_HASTA_LA_FECHA.md`** | Resumen ejecutivo pendientes; SaaS/Stripe/panel ya hechos. |
| **`FLUJOS_QUE_FALTAN_INTEGRAR.md`** | Flujos API ↔ frontend; Compras como único flujo pendiente. |
| **`TRAZABILIDAD_PENDIENTES.md`** | IDs P-001…P-012 (histórico); muchos ítems ya cerrados. |
| **`CONTINGENCIA_DIAN.md`** | Reintentar pendientes, alertas, runbook. |
| **`RECUENTO_PENDIENTES.md`** | Lista extensa; sección DIAN desactualizada (CUFE/PDF/consulta ya implementados). |

---

**Última actualización:** Febrero 2026
