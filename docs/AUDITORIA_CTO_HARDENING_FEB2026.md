# Auditoría CTO — Hardening técnico SaaS multi-tenant (Feb 2026)

**Rol:** CTO externo / Auditor técnico senior / Arquitecto SaaS.  
**Criterio:** Producción con clientes pagos; checklist accionable, sin teoría genérica.  
**Base:** Revisión práctica del código y documentación existente (`HARDENING_TECNICO_PRODUCCION.md`, `QUE_FALTA_HASTA_LA_FECHA.md`, `QUE_FALTA_DESPUES_SPRINT1.md`).

---

# Resumen ejecutivo

| Nivel | Descripción |
|-------|-------------|
| **Actual** | **Early SaaS** (casi production-ready). |
| **Tras Sprint 1** | Aceptable para **cobrar dinero** si se cierran 2 fugas multi-tenant detectadas (Returns, Backups) y se verifica migración Stripe. |
| **Tras Sprint 2** | **Production-ready** con confiabilidad operativa (E2E SaaS, alertas, runbook). |
| **DIAN** | No vender como “facturación electrónica legal” hasta completar Sprint 3 (3–4 semanas). |

**Hallazgos nuevos en esta auditoría (no reflejados en el hardening anterior):**

- **Returns:** listado y detalle sin filtro por tenant; creación sin validar que la venta pertenezca al tenant del usuario → **fuga multi-tenant**.
- **Backups:** list/download sin filtro por tenant; un admin de un tenant puede listar y **descargar dumps completos de la BD** (todos los tenants) → **crítico**.

---

# 1️⃣ Sprint 1 — Cierre de riesgos críticos (obligatorio)

## 1.1 Aislamiento multi-tenant

### ✅ Ya implementado (verificado en código)

- **GET /stats:** Filtra por `tenantId` (o platform admin con `?tenantId=`). `AppService.getStats(tenantId)` y controller correctos.
- **GET /reports/*:** Todos los endpoints de reportes extraen `req.user.tenantId`, rechazan si falta (salvo platform admin donde aplique) y pasan `tenantId` al servicio. ReportsService filtra por tenant en dashboard, operational-state, sales, inventory, cash, customers, export, actionable-indicators, customer-clusters, trending-products, dashboard-summary.
- **Auditoría:** Listado y GET por entidad filtrados por tenant (o query.tenantId para plataforma).
- **Resto de módulos:** customers, catalog, quotes, sales, cash, expenses, suppliers, supplier-invoices, purchases, inventory, billing: reciben y usan `tenantId` del usuario.

### 🔴 Crítico — C1: Devoluciones (Returns) sin filtro por tenant

**Hallazgo:**

- `ReturnsService.listReturns()`: `findMany` sin `where` → devuelve **todas** las devoluciones de **todos** los tenants.
- `ReturnsService.getReturnById(id)`: `findUnique({ where: { id } })` sin comprobar tenant → un usuario puede ver una devolución de otro tenant si conoce el UUID.
- `ReturnsService.createReturn(dto, userId)`: Busca la venta por `dto.saleId` pero **no valida** que `sale.tenantId === req.user.tenantId` → un usuario puede crear devoluciones sobre ventas de otro tenant.

**Archivos:** `apps/api/src/returns/returns.controller.ts`, `apps/api/src/returns/returns.service.ts`.

**Acciones:**

1. **listReturns:** Añadir parámetro `tenantId: string` al servicio. En controller, extraer `tenantId = req.user?.tenantId`; si no hay, `ForbiddenException`. En servicio, filtrar por `sale: { tenantId }` (SaleReturn → Sale tiene tenantId).
2. **getReturnById:** Recibir `tenantId` en el servicio. Tras `findUnique` por id, comprobar `saleReturn.sale.tenantId === tenantId`; si no, `NotFoundException` (no revelar que existe).
3. **createReturn:** Recibir `tenantId` en el servicio. Tras encontrar la venta, comprobar `sale.tenantId === tenantId`; si no, `NotFoundException`.

**Tiempo estimado:** 1,5–2 h. **Prioridad:** Bloquea producción multi-tenant.

---

### 🔴 Crítico — C2: Backups list/download accesibles por tenant (fuga de todos los datos)

**Hallazgo:**

- `BackupsController` usa `JwtAuthGuard`, `PermissionsGuard`, `RequirePermission('backups:manage')`, `RequireModule('backups')` pero **no** `PlatformAdminGuard`.
- Cualquier usuario de **cualquier tenant** con permiso `backups:manage` puede:
  - `GET /backups` → listar **todos** los BackupRun (todos los tenants).
  - `GET /backups/:id/download` → descargar el archivo de backup, que es un **pg_dump de la base de datos completa** (todos los tenants, datos sensibles).

**Impacto:** Fuga de datos de todos los clientes con un solo usuario comprometido o mal configurado.

**Acción:**

1. Restringir backups a **solo administradores de plataforma**: añadir `PlatformAdminGuard` al `BackupsController` (junto a los guards actuales). Así solo usuarios con `tenantId === null` pueden listar, crear y descargar backups.
2. Documentar en runbook que los backups son a nivel plataforma (BD completa) y solo el equipo operativo (platform admin) debe tener acceso.

**Alternativa (si en el futuro quieres backups por tenant):** Mantener backups como exportaciones por tenant (no pg_dump completo) y filtrar `listBackups` / `getBackup` / `getBackupDownload` por `req.user.tenantId`; eso implica un diseño distinto de backup (por ejemplo export por entidades por tenant). No recomendado para el estado actual.

**Tiempo estimado:** 30–45 min. **Prioridad:** Crítico.

---

## 1.2 Seguridad de acceso

### ✅ Ya implementado

- **Rate limiting:** `ThrottleAuthGuard` en producción: login 10 req/min por IP, forgot-password 3/15 min por email, GET reports/* 30 req/min por usuario. Configuración en `app.module.ts` (login, forgot, reports).
- **CORS:** En producción, `ALLOWED_ORIGINS` obligatorio; si está vacío, la app lanza error al arrancar. `main.ts` verificado.
- **Validación backend:** PermissionsGuard + `@RequirePermission` en cash, sales, expenses y otros módulos críticos; RBAC aplicado en API.

---

## 1.3 Stripe y pagos

### ✅ Ya implementado

- **Idempotencia:** `BillingService.handleStripeEvent` comprueba `StripeEvent` por `event.id` antes de procesar; si ya existe, retorna sin procesar. Persistencia en tabla `StripeEvent`.
- **Reintentos:** Stripe reenvía eventos; el comportamiento idempotente evita duplicados.

### 🟠 Alto — A1: Verificar migración StripeEvent en todos los entornos

**Acción:** En cada entorno (local, staging, producción) ejecutar:

```bash
cd apps/api && npx prisma migrate status
```

Si hay migraciones pendientes (incl. `StripeEvent`), aplicar con `npx prisma migrate deploy` (o `migrate dev` en local). Sin esta migración, la idempotencia del webhook no funciona.

**Tiempo:** 5 min por entorno. **Prioridad:** Alta.

---

## Sprint 1 — Orden de implementación y validación

| Orden | Acción | Tiempo |
|-------|--------|--------|
| 1 | Cerrar fuga **Returns** (listReturns, getReturnById, createReturn con tenantId) | 1,5–2 h |
| 2 | Restringir **Backups** a platform admin (`PlatformAdminGuard`) | 30–45 min |
| 3 | Verificar **migración StripeEvent** en todos los entornos | 5 min × entornos |
| 4 | Ejecutar suite E2E (incl. multi-tenant y stats) y añadir E2E de Returns con tenant | ~1 h |

**Criterio de “seguro para cobrar dinero”:** Sin fugas multi-tenant en Returns ni en Backups; migración Stripe aplicada; suite E2E en verde.

---

# 2️⃣ Sprint 2 — Robustez SaaS y operación

## 2.1 Flujos SaaS end-to-end

**Estado:** Crear tenant + admin, cambio de plan, renovación, suspensión por impago y Stripe (webhook, stripeSubscriptionId, lastPaymentFailedAt) están implementados en código y documentación.

**Pendiente (no bloqueante para cobrar, sí para confiabilidad):**

### 🟠 Alto — A2: Tests E2E de flujos SaaS

**Faltan E2E que cubran:**

- Crear tenant + admin + suscripción (POST /provider/tenants con planId).
- Cambiar plan (PATCH /provider/tenants/:id con planId).
- Renovar suscripción (PATCH /provider/tenants/:id/subscription/renew).
- Suspensión automática por impago (webhook invoice.payment_failed 2.º en 30 días).
- Idempotencia webhook (mismo event.id dos veces → procesado una vez).

**Acción:** Añadir `provider.e2e-spec.ts` (o ampliar existentes) para provider, y tests de webhook Stripe (ya existe `stripe-idempotency.e2e-spec.ts`; verificar que cubra invoice.paid, payment_failed, subscription.deleted y suspensión).

**Tiempo estimado:** 1–2 días. **Prioridad:** Alta para confiabilidad.

---

## 2.2 Operación

### 🟠 Alto — A3: Alertas mínimas

**Hallazgo:** Existe `GET /health` pero no hay integración con sistema de alertas.

**Acciones:**

1. Monitor externo (UptimeRobot, Pingdom o del orquestador) que haga GET /health cada 1–2 min y alerte si status != ok, timeout o latencia alta (p. ej. > 5 s).
2. Alertas mínimas recomendadas: 5xx rate > 1% (ventana corta), health check failed, colas con jobs failed > umbral si aplica.

**Tiempo:** 4–6 h. **Prioridad:** Alta antes de escalar.

### 🟡 Medio — M1: Rotación de secretos

**Acción:** Documentar en runbook: rotación de `JWT_ACCESS_SECRET`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL` (pasos, reinicio, verificación con health).

**Tiempo:** ~1 h.

### 🟡 Medio — M2: Pruebas de restore de backups

**Acción:** Calendarizar prueba de restore mensual en staging y documentarla en runbook.

**Tiempo:** 2 h (primera vez; luego mantenimiento).

---

## Sprint 2 — Checklist de validación

- [ ] E2E provider: crear tenant, cambiar plan, renovar suscripción.
- [ ] E2E webhooks Stripe: invoice.paid, payment_failed (2.º → suspensión), subscription.deleted; idempotencia.
- [ ] Monitor externo GET /health configurado.
- [ ] Alertas: 5xx, health failed (y colas si aplica).
- [ ] Runbook: rotación de secretos.
- [ ] Runbook: prueba de restore de backup calendarizada.

**Nivel de confiabilidad:** Operación consciente de fallos y capacidad de reacción; listo para escalar a más clientes.

---

# 3️⃣ Sprint 3 — Evaluación DIAN (alcance legal Colombia)

## 3.1 Gestión comercial vs facturación electrónica legal

| Aspecto | Gestión comercial | Facturación electrónica legal |
|---------|-------------------|--------------------------------|
| Ventas, caja, clientes, reportes | ✅ | ✅ |
| Facturas internas (número, totales) | ✅ | ✅ |
| Envío real a DIAN | ❌ | ✅ Obligatorio |
| CUFE según Anexo Técnico | ❌ (simulado) | ✅ Obligatorio |
| PDF con QR/CUFE | ❌ (placeholder) | ✅ Obligatorio |
| Consulta estado DIAN | ❌ | ✅ Recomendado |
| Venta del producto | “Gestión comercial” | “Facturación electrónica” |

## 3.2 Qué falta exactamente

1. **Envío real:** Conectar con Web Service DIAN (habilitación/producción), credenciales, manejo ACEPTADO/RECHAZADO y reintentos. **Tiempo:** ~1 semana.
2. **CUFE:** Cálculo según Anexo Técnico FE 1.9 (SHA-256, 96 caracteres hex), incluido en XML. **Tiempo:** 3–5 días.
3. **PDF + QR:** Plantilla estándar, QR con CUFE/datos, guardar en disco/S3. **Tiempo:** 3–4 días.
4. **Consulta estado:** Web Service consulta DIAN y sincronización de estados. **Tiempo:** 2–3 días.

**Roadmap realista:** 3–4 semanas (envío + CUFE + PDF + consulta + pruebas en habilitación).

## 3.3 Riesgos legales si se vende incompleto

- **Alto:** Vender como “facturación electrónica legal” sin envío real a DIAN → incumplimiento fiscal y posible demanda.
- **Recomendación:** Vender como **“gestión comercial”** hasta tener DIAN completo; o vender “con DIAN” con disclaimer claro y fecha de habilitación producción.

**Criterio para vender “con DIAN”:** Envío real en habilitación, CUFE según anexo, PDF con QR generado, pruebas exitosas en habilitación. Consulta estado recomendada pero no bloqueante para venta inicial.

---

# 4️⃣ Evaluación global del producto

## 4.1 Nivel real del sistema

- **MVP:** Superado; hay multi-tenant, planes, suscripciones, Stripe, panel proveedor, auditoría, RBAC.
- **Early SaaS, casi production-ready:** Sí. Con Sprint 1 cerrado (Returns + Backups + Stripe migración), es **aceptable para clientes pagos** con responsabilidad operativa.
- **Production-ready para escalar:** Tras Sprint 2 (E2E SaaS, alertas, runbook de secretos y restore).

## 4.2 Qué NO necesitas ahora

- Microservicios, Kubernetes avanzado, service mesh, tracing distribuido, multi-región.
- Refactor grande de ReportsService (deuda manejable a 3–6 meses).
- Más módulos de negocio antes de estabilizar operación y DIAN (si aplica).

## 4.3 Qué SÍ hacer antes de escalar clientes

**Obligatorio (Sprint 1):**

1. Cerrar fuga multi-tenant en **Returns** (list, get, create por tenantId).
2. Restringir **Backups** a platform admin.
3. Verificar migración **StripeEvent** en todos los entornos.

**Recomendado (Sprint 2):**

4. E2E de flujos SaaS (provider + webhooks).
5. Monitor + alertas (health, 5xx).
6. Runbook: rotación de secretos y prueba de restore.

## 4.4 Riesgos técnicos a 3–6 meses

- **Datos:** Crecimiento de auditoría y reportes sin política de retención/archivado → definir retención (p. ej. 12 meses) y archivado.
- **Dependencias:** Mantener `npm audit` y actualizaciones de seguridad (Prisma, NestJS, etc.).
- **Deuda:** ReportsService muy concentrado; refactor por dominio cuando haya capacidad, sin ser urgente.

---

# 5️⃣ Resumen de hallazgos por prioridad

## 🔴 Críticos

| ID | Hallazgo | Acción |
|----|----------|--------|
| C1 | Returns: list/get/create sin aislamiento por tenant | Añadir tenantId a controller y servicio; filtrar list por sale.tenantId; validar tenant en get y create. |
| C2 | Backups: list/download accesibles por tenant; dump completo de BD | Añadir PlatformAdminGuard a BackupsController. |

## 🟠 Altos

| ID | Hallazgo | Acción |
|----|----------|--------|
| A1 | Migración StripeEvent no verificada en todos los entornos | Ejecutar `prisma migrate status` y `migrate deploy` donde haga falta. |
| A2 | Faltan E2E de flujos SaaS (provider, webhooks, suspensión) | Añadir provider.e2e y ampliar tests de webhook Stripe. |
| A3 | No hay alertas operativas (health, 5xx) | Configurar monitor externo y alertas mínimas. |

## 🟡 Medios

| ID | Hallazgo | Acción |
|----|----------|--------|
| M1 | Rotación de secretos no documentada | Documentar en runbook JWT, Stripe webhook, DB. |
| M2 | Pruebas de restore de backup no calendarizadas | Calendarizar restore mensual en staging; documentar. |

## 🟢 Bajos

| ID | Hallazgo | Acción |
|----|----------|--------|
| B1 | Logs sin correlation ID en todos los flujos | Opcional: inyectar requestId en logger. |
| B2 | Métricas solo en memoria | Opcional: exportar a Prometheus/sistema persistente. |

---

# Checklist final pre-producción (actualizado)

## Multi-tenant

- [x] GET /stats, GET /reports/* filtran por tenantId (o platform admin).
- [x] Módulos de negocio (sales, cash, catalog, customers, quotes, etc.) usan tenantId.
- [ ] **Returns:** list/get/create filtrados y validados por tenantId.
- [ ] **Backups:** solo platform admin (list, create, download).

## Seguridad

- [x] Rate limit login, forgot-password, reports.
- [x] CORS estricto en producción (ALLOWED_ORIGINS).
- [x] PermissionsGuard y @RequirePermission en endpoints críticos.

## Stripe

- [x] Idempotencia por event.id (StripeEvent).
- [ ] Migración StripeEvent aplicada en todos los entornos.

## Operación

- [ ] Monitor + alertas (health, 5xx).
- [ ] Runbook: rotación de secretos y restore de backup.

---

**Documento generado:** Febrero 2026.  
**Próxima revisión:** Tras implementar C1, C2 y A1; y opcionalmente Sprint 2.
