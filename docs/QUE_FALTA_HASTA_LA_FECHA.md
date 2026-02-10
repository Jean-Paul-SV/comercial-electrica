# Qué falta hasta la fecha

> **Objetivo:** Lista actualizada de lo pendiente en el proyecto (Febrero 2026), teniendo en cuenta SaaS, panel del proveedor, suscripciones y última actividad ya implementados.  
> **Referencias:** `SAAS_MODELO_NEGOCIO_Y_OPERACION.md`, `QUE_FALTA_TODO_EL_SOFTWARE.md`, `QUE_HACE_FALTA.md`, `PARA_PRODUCCION_Y_VENTA_COMERCIAL.md`.

---

## Resumen ejecutivo

| Prioridad | Área | Qué falta (resumen) |
|-----------|------|---------------------|
| **Crítico** | DIAN (Colombia) | Envío real a API DIAN, PDF de factura, consulta estado real, CUFE según anexo |
| **~~Alta~~** | ~~SaaS / Panel proveedor~~ | ✅ **Hecho:** GET /provider/plans, selector de plan en Nueva empresa, PATCH tenant (cambiar plan + Subscription), seed crea Subscription para tenants sin una |
| **Media** | Frontend | Vistas de detalle por entidad; toasts y pulido UX donde falte |
| **~~Media~~** | ~~Operación~~ | ✅ **Hecho:** Runbook (`RUNBOOK_ALTA_CLIENTE.md`), política retención tenants suspendidos (`POLITICA_RETENCION_TENANTS_SUSPENDIDOS.md`) |
| **Baja** | Backend / DX | Más tests E2E; endpoint GET /plans (p. ej. para provider); caché/índices |
| **~~Opcional~~** | ~~Comercial~~ | ✅ **Hecho:** Integración Stripe (webhook, Plan.stripePriceId, suscripción al crear tenant, PATCH planes, página Planes, suspensión por 2º impago en 30 días). Guía de uso en `GUIA_USO_APLICACION.md`. |

---

## 1. Crítico: DIAN (facturación electrónica en Colombia) — por último

Si el producto se vende en **Colombia** y se ofrece facturación electrónica, es **obligatorio** completar la integración real con la DIAN. **Pasos ordenados:** ver **`DIAN_PASOS_IMPLEMENTACION.md`**.

| Tarea | Estado | Descripción |
|-------|--------|-------------|
| Envío a API DIAN | ❌ Simulado | Conectar `sendToDian()` con el Web Service real (habilitación/producción); softwareId/softwarePin; manejo ACEPTADO/RECHAZADO y reintentos. |
| PDF de factura | ❌ Placeholder | Implementar `generatePDF()`: plantilla estándar, QR, CUFE, guardar en disco o S3. |
| Consulta estado real | ❌ Local | Consumir Web Service de consulta DIAN y sincronizar estado en BD. |
| CUFE | ⚠️ Simulado | Calcular CUFE según Anexo Técnico DIAN e incluirlo en el XML. |

**Documentación:** `DIAN_INTEGRACION_ESTADO.md`, `QUE_FALTA_TODO_EL_SOFTWARE.md` §1.  
**Tiempo estimado:** 3–4 semanas.

Sin esto se puede vender el sistema como **gestión comercial** (ventas, inventario, reportes), pero **no** como solución de facturación electrónica legal en Colombia.

---

## 2. SaaS y panel del proveedor (mejoras)

Lo básico ya está: Tenant, Subscription, lastActivityAt/lastLoginAt, login bloqueado si tenant suspendido, API `/provider` y UI (listar, detalle, suspender/reactivar, crear tenant + admin).

| Estado | Descripción |
|--------|-------------|
| ✅ **Hecho** | **GET /provider/plans:** listado de planes activos. En “Nueva empresa” hay un **selector de plan** (dropdown) en lugar de UUID manual. |
| ✅ **Hecho** | **PATCH /provider/tenants/:id** con body `{ planId? }`: actualiza Tenant.planId y Subscription (o crea Subscription si no existía). En la página de detalle del tenant hay **“Cambiar plan”** con selector y botón Guardar. |
| ✅ **Hecho** | **Seed:** tras crear/actualizar el tenant por defecto, se crea `Subscription` para todos los tenants que no tengan una (backfill). |
| ✅ **Hecho** | **GET /provider/plans?activeOnly=true** para dropdowns; sin parámetro devuelve todos (gestión). **PATCH /provider/plans/:id** para actualizar plan (nombre, descripción, precios, stripePriceId, isActive). |
| ✅ **Hecho** | **Página Planes** (`/provider/plans`): listado y edición de planes (Stripe Price ID, activo/inactivo, precios). |

✅ **Hecho:** Al crear tenant (o suscripción en seed) se setean **currentPeriodStart** = ahora y **currentPeriodEnd** = ahora + 30 días. **PATCH /provider/tenants/:id/subscription/renew** (body: `extendDays`, default 30) prorroga el periodo; en la UI de detalle del tenant hay botón “Renovar 30 días”. Si el plan tiene **stripePriceId**, al crear tenant se crea la suscripción en Stripe y se guarda **Subscription.stripeSubscriptionId**.

---

## 3. Frontend (mejoras no bloqueantes)

| Pendiente | Descripción | Prioridad |
|-----------|-------------|-----------|
| **Vistas de detalle** | Páginas por ID donde falten: producto, venta, cliente, cotización, etc. (ver detalle de un registro, editar desde ahí si aplica). | Media |
| **Toasts en mutaciones** | Feedback visual al crear/editar en formularios que aún no lo tengan (cotizaciones, compras, facturas proveedor, etc.). | Baja |
| **Pulido UX** | Mensajes de error más claros, estados de carga consistentes, responsive y accesibilidad donde falte. | Baja |

No hay un “frontend por hacer desde cero”; el sistema es usable con lo actual.

---

## 4. Operación y documentación

| Estado | Descripción |
|--------|-------------|
| ✅ **Hecho** | **Runbook de alta de cliente:** `docs/RUNBOOK_ALTA_CLIENTE.md` — checklist (antes del alta, alta en plataforma, entrega de credenciales, incidencias). |
| ✅ **Hecho** | **Política de retención (tenants suspendidos):** `docs/POLITICA_RETENCION_TENANTS_SUSPENDIDOS.md` — plazo recomendado 12 meses, acciones al final (archivar/eliminar), proceso manual o con jobs. |
| ✅ **Hecho** | **Documentación de uso para el cliente final:** `docs/GUIA_USO_APLICACION.md` — guía para el usuario del negocio: cómo crear usuarios, ventas, cotizaciones, reportes, caja. Puede adaptarse desde `GUIA_LEVANTAR_PROYECTO.md` a “cómo usar la app”. |

---

## 5. Backend y calidad (opcional)

| Pendiente | Estado |
|-----------|--------|
| **Tests E2E** | ✅ E2E existentes: app, backups, cash, inventory, quotes (flujo completo), reports (dashboard, sales, inventory, operational-state), sales, suppliers-purchases-payables. |
| **Caché e índices** | ✅ Caché en listados: productos (p.1 sin búsqueda/filtros, 90 s), clientes (idem, 90 s), ventas (idem, 60 s). Invalidación al crear/actualizar/eliminar. |
| **Validaciones de negocio** | ✅ Documentado en `VALIDACIONES_NEGOCIO.md`. Cierre de caja con ventas pendientes, stock en ventas, fechas en gastos, etc., ya implementados. |

Nada de esto bloquea un cierre “de negocio”; son mejoras de robustez y rendimiento.

---

## 6. Comercial y producto (opcional)

| Aspecto | Estado |
|---------|--------|
| **Facturación del servicio** | ✅ **Implementado:** Webhook Stripe (`POST /billing/webhooks/stripe`), Plan.stripePriceId, creación de suscripción Stripe al crear tenant, página Planes para editar stripePriceId, **invoice.paid** → prorrogar 30 días, **invoice.payment_failed** → tras 2º fallo en 30 días se suspende suscripción y tenant, **customer.subscription.deleted** → CANCELLED. Ver `INTEGRACION_FACTURACION_SAAS.md`. |
| **Onboarding del cliente** | El sistema tiene onboarding en la app; opcional: guía o videollamada inicial para el primer uso. |
| **Soporte** | Definir canal (email, chat, teléfono) y tiempos de respuesta. |

---

## 7. Ya implementado (referencia rápida)

- **Multi-tenant:** Tenant, User.tenantId, aislamiento por tenant.
- **SaaS modular:** Plan, PlanFeature, TenantModule, AddOn; ModulesGuard; navegación por módulos; página “Plan requerido”.
- **Suscripción y actividad:** Modelo Subscription; Tenant.lastActivityAt; User.lastLoginAt; actualización en login; bloqueo de login si tenant suspendido.
- **Panel del proveedor:** API `/provider` (listar tenants, detalle, suspender/reactivar, crear tenant + admin, listar/actualizar planes); UI (Empresas, Nueva empresa, Planes, detalle por ID); solo usuarios sin tenant (platform admin).
- **Auth y seguridad:** JWT, bootstrap-admin, usuarios, invitación, “olvidé contraseña”, cambio obligatorio de contraseña, RBAC, permisos en GET /auth/me, isPlatformAdmin.
- **Backend:** Módulos de negocio (ventas, caja, inventario, proveedores, compras, reportes, auditoría, backups, DIAN estructura), rate limiting, validación, CORS, health, auditoría, backups (pg_dump + S3).
- **Frontend:** Login, dashboard, listados principales, reportes, auditoría, usuarios, onboarding, plan-required, panel proveedor (empresas, nueva empresa, detalle).

---

## 8. Orden sugerido para cerrar brechas

1. **Para venta en Colombia con facturación electrónica:** Completar DIAN (envío, PDF, consulta, CUFE).
2. **Para operar el SaaS con más comodidad:** GET /plans (o /provider/plans) + selector de plan en “Nueva empresa”; actualizar Subscription al cambiar plan o al renovar.
3. **Para una experiencia más pulida:** Vistas de detalle donde falten; toasts en mutaciones (la mayoría de formularios ya los tienen); runbook, política de retención y guía de uso para el cliente ya documentados.
4. **Opcional:** Más E2E, caché/índices, integración con pasarela de pagos, documentación de uso para el cliente final.

**Opcionales implementados (feb 2026):** Caché en listados de productos, clientes y ventas (primera página, TTL 60–90 s); documento `VALIDACIONES_NEGOCIO.md`; utilidad frontend `getErrorMessage()` para mensajes de error claros en toasts (ej. clientes); E2E ya cubren reportes (incl. operational-state) y cotizaciones completas.

**Implementado (feb 2026):** Vista de detalle de compra (`/purchases/[id]`); mensaje explícito al cerrar caja con ventas pendientes de facturar; índices compuestos para listados de cotizaciones; test unitario para validación de cierre de caja; guía de integración facturación SaaS; **Stripe:** webhook (`invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`), Subscription.stripeSubscriptionId y lastPaymentFailedAt, Plan.stripePriceId, creación de suscripción Stripe al crear tenant, suspensión automática tras 2º pago fallido en 30 días; **Panel proveedor:** PATCH /provider/plans/:id, GET /provider/plans?activeOnly=, página Planes (`/provider/plans`) para listar y editar planes. **Auditoría/trazabilidad:** tenantId en contexto y en AuditLog, listado y GET por entidad filtrados por tenant; campo `summary` en AuditLog (descripción corta en listados, generado por defecto `entity · action`); summary descriptivo en logs críticos (ventas, caja); métodos `logCreate`, `logUpdate`, `logDelete` aceptan contexto opcional con `summary`.

---

**Documentos de referencia (operación y uso):**

- `DIAN_PASOS_IMPLEMENTACION.md` — **Pasos ordenados para implementar DIAN** (envío, CUFE, PDF, consulta) cuando se aborde al final.
- `RUNBOOK_ALTA_CLIENTE.md` — Alta de cliente (tenant + admin).
- `POLITICA_RETENCION_TENANTS_SUSPENDIDOS.md` — Retención de datos de cuentas suspendidas.
- `GUIA_USO_APLICACION.md` — Guía de uso para el cliente final (acceso, ventas, caja, productos, reportes, etc.).
- `INTEGRACION_FACTURACION_SAAS.md` — Integración con Stripe u otra pasarela para cobro recurrente y renovación/suspensión.
- `VALIDACIONES_NEGOCIO.md` — Validaciones de negocio implementadas (caja, ventas, gastos, facturas proveedor, etc.).
- `GUIA_TESTING_CAMBIOS_FEB2026.md` — Guía práctica para probar los cambios implementados (caché, summary, mensajes de error, validaciones).
- `GUIA_PRUEBAS_MANUALES_SPRINT1.md` — **Guía completa de pruebas manuales para Sprint 1:** pasos detallados para probar todas las correcciones críticas (multi-tenant, rate limiting, CORS, idempotencia Stripe, PermissionsGuard). Incluye preparación del entorno, casos de prueba paso a paso, resultados esperados y checklist de validación.
- `QUE_FALTA_DESPUES_SPRINT1.md` — **Qué falta después del Sprint 1:** fugas multi-tenant pendientes (reports inventory, cash, customers, export), isPlatformAdmin en JWT para GET /stats, revisión de otros reportes, frontend ante 403, migración StripeEvent, E2E y documentación. Prioridades y orden sugerido.
- `AUDITORIA_TECNICA_SAAS.md` — Auditoría técnica completa (backend, API, BD, frontend, tests, observabilidad, seguridad, hallazgos priorizados y mejoras).
- `HARDENING_TECNICO_PRODUCCION.md` — **Hardening técnico para producción:** evaluación práctica de riesgos críticos (multi-tenant, seguridad, Stripe), robustez SaaS, evaluación DIAN, y checklist pre-producción. Hallazgos clasificados por criticidad (🔴🟠🟡🟢) con acciones concretas y tiempos estimados.
- `AUDITORIA_TESTEO_EXTREMO.md` — **Auditoría de testeo extremo:** evaluación completa del sistema como si mañana entraran clientes pagos. Incluye testeo de backend (seguridad multi-tenant, auth, Stripe), frontend (flujos, errores, UX), Swagger/OpenAPI, base de datos (modelo, queries, rendimiento), performance y carga, y operación/resiliencia. Tests automatizados propuestos, hallazgos concretos con código, y checklist de validación pre-producción.

---

**Última actualización:** Febrero 2026
