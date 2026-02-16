# Qué falta después del Sprint 1

**Contexto:** Sprint 1 (correcciones críticas) está implementado: multi-tenant en stats/dashboard/operational-state/sales, rate limiting, CORS, idempotencia Stripe, PermissionsGuard en cash/sales/expenses.

**Este documento** resume lo que aún falta para cerrar riesgos y dejar el sistema listo para producción.

---

## Crítico (fugas multi-tenant) — ✅ IMPLEMENTADO

### 1. Más reportes sin filtro por tenantId — **Hecho**

Los siguientes endpoints **ahora filtran por tenantId**:

| Endpoint | Estado |
|----------|--------|
| GET /reports/inventory | ✅ Controller exige tenantId; servicio filtra `Product` por tenantId |
| GET /reports/cash | ✅ Controller exige tenantId; servicio filtra `CashSession` por tenantId |
| GET /reports/customers | ✅ Controller exige tenantId; servicio filtra ventas por tenantId |
| GET /reports/export | ✅ Controller exige tenantId; servicio filtra ventas y clientes por tenantId |

---

## Alto (GET /stats para platform admin) — ✅ IMPLEMENTADO

### 2. isPlatformAdmin en el JWT — **Hecho**

- `JwtPayload` incluye `isPlatformAdmin?: boolean`.
- En `login()` se añade `isPlatformAdmin: user.tenantId === null` al payload.
- GET /stats con `?tenantId=uuid` y token de platform admin funciona correctamente.

---

## Medio (robustez y consistencia)

### 3. Otros reportes que podrían no filtrar por tenant — ✅ IMPLEMENTADO

Los siguientes endpoints **ahora filtran por tenantId** (controller + servicio):

- GET /reports/actionable-indicators ✅
- GET /reports/customer-clusters ✅
- GET /reports/trending-products ✅
- GET /reports/dashboard-summary ✅ (usa getActionableIndicators con tenantId)

---

### 4. Frontend ante 403 y permisos — ✅ Implementado

- **Mensajes ante 403:** `getErrorMessage()` (`shared/utils/errors.ts`) prioriza el mensaje de la API y tiene fallback para 403: "No tienes permiso para hacer esta acción." Se usa en toasts de cash, sales, expenses y customers.
- **Ocultar acciones según permisos:** `useHasPermission(permission)` y permisos desde GET /auth/me. En **cash**: botones "Abrir sesión" y "Cerrar sesión" solo si `cash:create` / `cash:update`. En **sales**: "Nueva venta" solo si `sales:create`. En **expenses**: "Nuevo gasto" y eliminar solo si `expenses:create` / `expenses:delete`.
- Opcional: revisar anular factura (invoice) si existe esa acción y aplicar el mismo patrón.

---

### 5. Migración StripeEvent — ✅ Verificar en cada entorno

La migración `20260209150000_add_stripe_event_idempotency` crea la tabla `StripeEvent` (idempotencia del webhook Stripe).

**Comprobar si ya está aplicada:**

```bash
cd apps/api
npm run prisma:migrate:status
```

O desde la raíz del monorepo: `npm run prisma:migrate:status`.

Si dice **"Database schema is up to date!"**, las 33 migraciones (incl. StripeEvent) ya están aplicadas en ese entorno.

**Si hay migraciones pendientes**, aplicar con:

- **Desarrollo:** `npx prisma migrate dev`
- **Staging/Producción:** `npx prisma migrate deploy`

**Acción:** Ejecutar `migrate status` en local/staging/producción; si hay pendientes, ejecutar `migrate deploy` (o `migrate dev` en local).

---

## Bajo (mejoras posteriores)

### 6. Tests E2E para lo nuevo — ✅ Parcialmente hecho

- ✅ **Suite E2E unificada con multi-tenant:** `setupTestApp` crea un tenant de test, usuario con `tenantId`, y habilita todos los módulos; todos los E2E (reports, quotes, suppliers-purchases-payables, inventory, sales, cash, permissions, backups, app, stripe-idempotency, multi-tenant-reports) pasan (11 suites, 55 tests). Category/Product/Customer/CashSession/Sale usan `tenantId` y `where` compuesto (`tenantId_name`, `tenantId_internalCode`) según esquema Prisma.
- ✅ **multi-tenant-reports.e2e-spec.ts** y **reports.e2e-spec.ts** cubren GET /reports/dashboard y otros reportes filtrados por tenant.
- ✅ **stripe-idempotency.e2e-spec.ts** cubre idempotencia del webhook Stripe.
- ✅ **permissions.e2e-spec.ts** cubre permisos (403 cuando no se tiene el permiso).
- ✅ **stats.e2e-spec.ts:** E2E de GET /stats con usuario tenant (stats propias) y platform admin con `?tenantId=` (stats del tenant indicado).

**Tiempo estimado restante:** bajo (opcional).

---

### 7. Documentación y auditorías — ✅ Parcialmente hecho

- ✅ Actualizar `HARDENING_TECNICO_PRODUCCION.md` y `AUDITORIA_TESTEO_EXTREMO.md`: se añadió "Estado de implementación (feb 2026)" y se marcaron C1–C4, A1–A3 (y A1 idempotencia Stripe, A2 PermissionsGuard) como implementados/resueltos.
- Opcional: añadir a la guía de pruebas manuales casos explícitos para inventory, cash, customers y export con tenantId (los flujos ya están cubiertos por la guía actual).

---

## Resumen de prioridades

| Prioridad | Qué | Estado |
|-----------|-----|--------|
| ~~Crítico~~ | ~~Filtrar por tenantId en reports: inventory, cash, customers, export~~ | ✅ Hecho |
| ~~Alto~~ | ~~Añadir isPlatformAdmin al JWT para GET /stats con ?tenantId=~~ | ✅ Hecho |
| ~~Medio~~ | ~~Revisar actionable-indicators, customer-clusters, trending-products, dashboard-summary~~ | ✅ Hecho |
| ~~Medio~~ | ~~Frontend: 403 y permisos (mensajes y/o ocultar acciones)~~ | ✅ Hecho |
| Medio | Verificar migración StripeEvent aplicada (`prisma migrate status`; si pendiente, `migrate deploy`) | Verificar por entorno |
| ~~Bajo~~ | ~~E2E multi-tenant, idempotencia Stripe, permisos~~ | ✅ Hecho (suite 11/11, 55 tests) |
| ~~Bajo~~ | ~~Actualizar docs (HARDENING, AUDITORIA_TESTEO)~~ | ✅ Hecho |

---

## Orden sugerido (pendientes)

1. **Migración:** En cada entorno (local, staging, producción) ejecutar `npx prisma migrate status`. Si no está "up to date", ejecutar `npx prisma migrate deploy` (o `migrate dev` en local). Con "up to date" el único ítem obligatorio del Sprint 1 queda cubierto.
2. **Opcional:** Añadir a la guía de pruebas manuales casos explícitos por módulo (inventory, cash, customers, export) si se desea más detalle.

Con lo ya implementado, el sistema queda sin fugas multi-tenant conocidas en reportes y con GET /stats usable por platform admin.

---

**Última actualización:** Febrero 2026
