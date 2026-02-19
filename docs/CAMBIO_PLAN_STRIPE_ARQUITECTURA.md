# Arquitectura: Cambio de plan tipo Spotify (Stripe)

Lógica de upgrade/downgrade para un SaaS contable con planes mensuales/anuales, límites de usuarios, módulos (reportes, DIAN, proveedores, auditoría, backups) y costo único de activación DIAN.

---

## 1. Reglas de negocio

### 1.1 Upgrade (plan más costoso)

- **Ejemplos:** Básico → Premium, Sin DIAN → Con DIAN, Premium → Enterprise.
- **Aplicación:** Inmediata.
- **Facturación:** Stripe prorratea; se cobra solo la diferencia proporcional hasta la próxima renovación.
- **Stripe:** `subscription.update` con `proration_behavior: 'create_prorations'`.
- **DIAN:** Si el nuevo plan incluye DIAN y aún no está activado, se inicia el flujo de activación (cobro único separado, no reembolsable).

### 1.2 Downgrade (plan más económico)

- **Ejemplos:** Premium → Básico, Con DIAN → Sin DIAN, Enterprise → Premium.
- **Aplicación:** No inmediata. El plan actual se mantiene hasta el **final del ciclo de facturación**.
- **Facturación:** Sin reembolso; el cambio se aplica en la **próxima renovación**.
- **Stripe:** No se modifica la suscripción en el momento del pedido. Un proceso automático (cron) aplica el nuevo precio cuando llega `scheduledChangeAt` (igual a `currentPeriodEnd`).
- **Persistencia:** Se guarda `scheduledPlanId` y `scheduledChangeAt` en la tabla `Subscription`.

### 1.3 Validaciones obligatorias antes de downgrade

- **Límite de usuarios:** Si los usuarios activos exceden el `maxUsers` del nuevo plan → bloquear hasta que ajusten.
- **Funcionalidades en uso:** Si usa módulos que perdería (reportes, compras, DIAN, auditoría, backups) → advertir o bloquear según política.
- **DIAN activa:** Si tiene facturación electrónica activa y el nuevo plan no incluye DIAN → advertir riesgo fiscal y bloquear o requerir confirmación explícita.

---

## 2. Arquitectura recomendada (Stripe + backend)

```
┌─────────────────┐     PATCH /billing/plan      ┌──────────────────┐
│  Frontend       │ ────────────────────────────►│  BillingController│
│  (settings/     │     { planId }                │                  │
│   billing)     │                               └────────┬─────────┘
└────────┬────────┘                                       │
         │                                                 ▼
         │ GET /billing/subscription            ┌──────────────────┐
         │◄─────────────────────────────────────│  BillingService   │
         │     plan, subscription,              │  - changeTenant   │
         │     scheduledPlan, scheduledChangeAt │  - validateDown   │
         └──────────────────────────────────────│  - applyScheduled │
                                                └────────┬─────────┘
                                                         │
                    ┌────────────────────────────────────┼────────────────────────────────────┐
                    │                                    │                                    │
                    ▼                                    ▼                                    ▼
           ┌───────────────┐                   ┌───────────────┐                   ┌───────────────┐
           │  Prisma      │                   │  Stripe API   │                   │  Cron (1h)    │
           │  Tenant      │                   │  subscription │                   │  applyScheduled│
           │  Subscription│                   │  .update()    │                   │  PlanChanges  │
           │  Plan        │                   │  proration_   │                   │               │
           └───────────────┘                   │  behavior     │                   └───────┬───────┘
                                              └───────────────┘                           │
                                                    ▲                                     │
                                                    │                                     │
                                    Webhooks: invoice.paid, payment_failed,                │
                                    subscription.deleted, subscription.updated           │
                                                    │                                     ▼
                                              ┌─────┴─────┐                     subscription.update
                                              │  Stripe   │                     (nuevo price, none)
                                              │  Webhook  │                     + BD planId
                                              └───────────┘
```

---

## 3. Flujo técnico paso a paso

### 3.1 Upgrade

1. Usuario elige un plan con precio efectivo **mayor** al actual.
2. Backend compara precios (mensual o anual según `tenant.billingInterval`).
3. Si incluye DIAN y no está activado: opcionalmente crear/actualizar `DianConfig` en PENDING y notificar a soporte (flujo existente).
4. En una transacción: actualizar `Tenant.planId` y `Subscription.planId` al nuevo plan. Limpiar `scheduledPlanId`/`scheduledChangeAt` si existían.
5. Llamar a Stripe: `subscription.update(subscriptionId, { items: [{ id: itemId, price: newPriceId }], proration_behavior: 'create_prorations' })`.
6. Stripe genera prorrateo en la siguiente factura; el usuario ve el cargo en "próxima factura" o en el portal.
7. Respuesta 200; frontend muestra "El nuevo plan se aplica hoy".

### 3.2 Downgrade

1. Usuario elige un plan con precio efectivo **menor** al actual.
2. Backend ejecuta **validaciones**:
   - Usuarios activos ≤ `maxUsers` del nuevo plan.
   - Módulos que perdería: si usa reportes/compras/DIAN/auditoría/backups y el nuevo plan no los incluye → error con lista de bloqueos.
   - Si tiene DIAN activa y el nuevo plan no incluye DIAN → error (riesgo fiscal).
3. Si alguna validación falla → `400 Bad Request` con `{ message, errors: string[], warnings?: string[] }`.
4. Si todo OK: **no** actualizar `Tenant.planId` ni Stripe. Solo guardar en `Subscription`: `scheduledPlanId = newPlanId`, `scheduledChangeAt = currentPeriodEnd`.
5. Respuesta 200; frontend muestra "Tu plan cambiará el {fecha}".

### 3.3 Aplicación del cambio programado (cron)

1. Cron ejecuta cada hora (o cada 15 min): `BillingService.applyScheduledPlanChanges()`.
2. Consulta: `Subscription` donde `scheduledPlanId IS NOT NULL AND scheduledChangeAt <= NOW()`.
3. Para cada fila:
   - Obtener el plan programado (precio Stripe mensual o anual).
   - Si hay `stripeSubscriptionId`: `subscription.update(subscriptionId, { items: [{ id, price: newPriceId }], proration_behavior: 'none' })`. Así el **siguiente** cobro será al nuevo precio; no hay crédito ni cargo inmediato.
   - En transacción: `Tenant.planId = scheduledPlanId`, `Subscription.planId = scheduledPlanId`, `Subscription.scheduledPlanId = null`, `Subscription.scheduledChangeAt = null`.
4. Log y métricas.

---

## 4. Manejo de webhooks Stripe

| Evento | Acción actual | Comentario |
|--------|----------------|------------|
| `invoice.paid` | Prorrogar `currentPeriodEnd` +30 días (o usar periodo de Stripe) | Mantener; opcionalmente sincronizar `currentPeriodEnd` desde `invoice.period_end`. |
| `invoice.payment_failed` | Registrar fallo; 2º fallo en 30 días → SUSPENDED | Sin cambio. |
| `customer.subscription.deleted` | Marcar suscripción CANCELLED | Sin cambio. |
| `customer.subscription.updated` | **Nuevo:** Sincronizar `currentPeriodStart` y `currentPeriodEnd` desde Stripe | Evita desfase si Stripe cambia el periodo (ej. cambio de plan con prorrateo). |

Para **downgrade**, el cambio en Stripe lo hace nuestro **cron** al llegar `scheduledChangeAt`, no el webhook. El webhook `subscription.updated` puede usarse solo para reflejar en BD las fechas de periodo que Stripe devuelve.

---

## 5. Manejo de errores y edge cases

- **Mismo plan:** Devolver 200 sin tocar Stripe ni BD.
- **Plan no encontrado / Tenant sin suscripción:** 404.
- **Downgrade bloqueado (usuarios/módulos/DIAN):** 400 con lista de errores para mostrar en UI.
- **Stripe no configurado:** Upgrade/downgrade solo en BD si no hay `stripeSubscriptionId`; si hay Stripe pero falla `subscription.update`, hacer rollback de la transacción de BD o marcar para reintento.
- **Cron falla al aplicar cambio programado:** Reintento en la siguiente ejecución; si `scheduledChangeAt` ya pasó, el cron seguirá encontrando el registro. Considerar alerta si un cambio programado tiene más de 24 h de retraso.
- **Usuario cancela suscripción antes de `scheduledChangeAt`:** Al cancelar, limpiar `scheduledPlanId`/`scheduledChangeAt` para no aplicar un cambio a una suscripción cancelada.
- **Cambio de intervalo (mensual ↔ anual) al cambiar de plan:** Usar el `billingInterval` actual del tenant para elegir `stripePriceId` o `stripePriceIdYearly`; si en el futuro se permite cambiar intervalo en el mismo flujo, tratarlo como un cambio de ítem en Stripe.

---

## 6. Recomendaciones para evitar inconsistencias financieras

- **Una fuente de verdad para el periodo:** Preferir leer `current_period_end` desde Stripe (webhook `subscription.updated` o al aplicar cambio) y guardarlo en `Subscription.currentPeriodEnd` para que el cron use la misma fecha que Stripe.
- **Idempotencia del cron:** Al aplicar un cambio programado, comprobar de nuevo que `scheduledChangeAt <= now` dentro de la transacción y que la suscripción sigue activa.
- **No reembolsar en downgrade:** No usar `proration_behavior` que genere crédito; aplicar el nuevo precio solo a partir del siguiente ciclo (`proration_behavior: 'none'`).
- **Auditoría:** Registrar en logs (o tabla de eventos) los cambios de plan (upgrade/downgrade programado y aplicación del programado).

---

## 7. Estrategia segura para DIAN en cambios de plan

- **Upgrade a plan con DIAN:** Crear o actualizar `DianConfig` con `activationStatus: PENDING`. El costo único de activación se cobra por separado (fuera del flujo de cambio de plan en Stripe). No reembolsable.
- **Downgrade de plan con DIAN a plan sin DIAN:** Validar que el usuario confirme que entiende que perderá la posibilidad de emitir a la DIAN; si `DianConfig.activationStatus === 'ACTIVATED'`, bloquear por defecto o exigir confirmación explícita (checkbox + posible flujo de soporte). No desactivar certificados de golpe; el cambio de plan solo quita el **módulo** a partir de `scheduledChangeAt`; la desactivación técnica del certificado puede ser posterior o manual.
- **Persistencia:** El estado "con DIAN" o "sin DIAN" viene del **plan** (módulo `electronic_invoicing`). Si el plan no incluye el módulo, el backend ya niega acceso a rutas DIAN (`@RequireModule('electronic_invoicing')`). No es necesario borrar `DianConfig` al bajar a plan sin DIAN; se puede mantener en solo lectura o oculto hasta que vuelva a un plan con DIAN.

---

## 8. Resumen de entregables implementados

- **Schema:** `Subscription.scheduledPlanId`, `Subscription.scheduledChangeAt`.
- **Backend:** `changeTenantPlan` con ramas upgrade/downgrade; `validateDowngrade`; `applyScheduledPlanChanges()`; cron cada hora (`BillingScheduler`).
- **API:** `GET /billing/subscription` incluye `scheduledPlan` y `scheduledChangeAt`. `PATCH /billing/plan` devuelve `scheduledChangeAt` cuando el cambio es diferido. `GET /billing/plan/validate-downgrade?planId=...` devuelve `{ allowed, errors, warnings }` para pre-validar downgrade (deshabilitar botón o mostrar avisos).
- **Frontend:** Modal que explica cambio inmediato vs al final del periodo; aviso "Tu plan cambiará el {fecha}"; mensajes de error con lista de bloqueos para downgrade; validación previa por plan para mostrar "No disponible" y el primer error cuando el downgrade no está permitido.

## 9. Pasos para aplicar en el proyecto

1. **Migración y Prisma:** Desde `apps/api` ejecutar:
   - `npx prisma migrate deploy` (o `prisma migrate dev` en desarrollo) para aplicar la migración `20260218100000_add_scheduled_plan_change`.
   - `npx prisma generate` para regenerar el cliente y que TypeScript reconozca `scheduledPlanId`, `scheduledChangeAt` y la relación `scheduledPlan`.
2. **Webhooks Stripe:** En el Dashboard de Stripe, añadir el evento `customer.subscription.updated` al endpoint de webhooks si quieres sincronizar fechas de periodo (opcional; el cron no depende de él).
3. **Producción:** El cron `applyScheduledPlanChanges` se ejecuta cada hora; asegurar que la API tenga ScheduleModule y que el proceso esté en marcha.
