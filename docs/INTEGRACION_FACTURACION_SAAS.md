# Integración de facturación SaaS (Stripe / pasarelas)

> **Objetivo:** Guía para conectar el cobro recurrente (suscripciones) con una pasarela de pagos (Stripe, Mercado Pago, etc.) y opcionalmente enlazar renovación/suspensión por impago con el modelo `Subscription` y el estado del tenant.

---

## 1. Estado actual del sistema

- **Plan**, **Subscription** (por tenant), **currentPeriodStart** / **currentPeriodEnd** y **status** (ACTIVE, SUSPENDED, CANCELLED) ya existen.
- **Subscription.stripeSubscriptionId** (opcional): enlace con la suscripción en Stripe.
- El panel proveedor permite **Renovar 30 días** (prorrogar el periodo) y **suspender/reactivar** tenant de forma manual.
- **Implementado:** Webhook Stripe `POST /billing/webhooks/stripe` (verificación de firma, `invoice.paid` → prorrogar 30 días y limpiar lastPaymentFailedAt, `invoice.payment_failed` → registrar fallo; si ya hubo uno en los últimos 30 días, suspender suscripción y tenant, `customer.subscription.deleted` → marcar Subscription CANCELLED). Sin `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` el webhook responde 400 a eventos no verificados.

---

## 2. Qué falta para cobro recurrente automático

| Componente | Descripción |
|------------|-------------|
| **Pasarela** | Elegir proveedor (Stripe, Mercado Pago, etc.) y crear cuenta/API keys. |
| **Productos/precios en la pasarela** | Crear en Stripe (o similar) un producto por cada Plan (o un precio recurrente mensual/anual) y guardar el `priceId` en Plan o en configuración. |
| **Checkout o portal** | Flujo para que el cliente (tenant) pague: enlace de pago (Stripe Checkout), portal de cliente, o botón “Actualizar método de pago” en la app. |
| **Webhooks** | Endpoint en la API que reciba eventos de la pasarela (pago exitoso, pago fallido, suscripción cancelada). |
| **Lógica de negocio** | Al recibir “pago recurrente exitoso”: actualizar `Subscription.currentPeriodEnd` (o crear renovación). Al recibir “pago fallido” o “impago”: opcionalmente marcar Subscription como SUSPENDED y/o Tenant como inactivo tras X reintentos. |
| **Campo opcional en BD** | `Subscription.stripeSubscriptionId` (o `externalSubscriptionId`) para relacionar con la suscripción en la pasarela. |

---

## 3. Ejemplo con Stripe

### 3.1 Variables de entorno (API)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_BASIC=price_...   # opcional: precio mensual del plan "basic"
STRIPE_PRICE_ID_PRO=price_...    # opcional: precio del plan "pro"
# Para el Customer Portal (return_url por defecto): URL base del frontend (ej. https://app.ejemplo.com)
FRONTEND_URL=http://localhost:3001
```

### 3.2 Webhook en la API (implementado)

- **Ruta:** `POST /billing/webhooks/stripe`.
- **Implementado:** Verificación de firma con `STRIPE_WEBHOOK_SECRET`; manejo de:
  - `invoice.paid` → busca Subscription por `stripeSubscriptionId` (del invoice.subscription) y prorroga `currentPeriodEnd` +30 días y status ACTIVE.
  - `invoice.payment_failed` → solo log (política de reintentos/suspensión pendiente de configurar).
  - `customer.subscription.deleted` → marca Subscription como CANCELLED.
- El endpoint no usa JWT; solo valida la firma Stripe. Sin secret configurado, responde 400.

### 3.3 Enlace Plan ↔ Precio (implementado)

- **Plan.stripePriceId** (opcional): en la BD cada plan puede tener un `stripePriceId` (ID del precio recurrente en Stripe). GET /provider/plans lo devuelve.
- **Al crear tenant:** Si el plan seleccionado tiene `stripePriceId` y está configurado `STRIPE_SECRET_KEY`, el backend crea en Stripe un cliente (con email del admin) y una suscripción con ese precio, y guarda el `subscription.id` en `Subscription.stripeSubscriptionId`. La suscripción en Stripe se crea en estado “incompleta” hasta que el cliente pague (p. ej. con un enlace de pago que envíes por correo); cuando se pague, el webhook `invoice.paid` prorrogará el periodo.

### 3.4 Renovación manual vs automática

- **Manual (actual):** El proveedor usa “Renovar 30 días” en el panel; se actualiza `currentPeriodEnd` sin pasar por Stripe.
- **Automática (con Stripe):** El webhook `invoice.paid` actualiza `currentPeriodEnd` (o crea un nuevo periodo). La opción “Renovar 30 días” puede quedar para casos excepcionales o sin pasarela.

---

## 4. Suspensión por impago (implementado)

- **Política:** En cada `invoice.payment_failed` se actualiza `Subscription.lastPaymentFailedAt`. Si ya existía un fallo en los **últimos 30 días**, se marca la suscripción como SUSPENDED y el tenant como `isActive: false` (segundo fallo = suspensión automática). Al recibir `invoice.paid` se limpia `lastPaymentFailedAt`.
- El login ya bloquea a los tenants inactivos con el mensaje “Cuenta suspendida. Contacte a soporte o facturación.”
- Opcional: job que revise en Stripe suscripciones con pagos fallidos y sincronice estado en BD.

---

## 5. Orden sugerido de implementación

1. Crear cuenta Stripe (o otra pasarela) y obtener API keys y webhook secret.
2. Añadir `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` al `.env` y a la documentación de despliegue.
3. Añadir campo opcional `Subscription.stripeSubscriptionId` (migración).
4. Implementar `POST /billing/webhooks/stripe`: verificación de firma y respuesta 200 para todos los eventos (evitar reintentos innecesarios). Opcionalmente implementar solo `invoice.paid` para prorrogar periodo.
5. Crear productos/precios en Stripe y guardar `stripePriceId` en Plan (o en config).
6. Flujo de alta: al crear tenant con plan, crear suscripción en Stripe y guardar `stripeSubscriptionId` en Subscription.
7. Implementar lógica de `invoice.payment_failed` y suspensión según política.

---

## 6. Variables de entorno para el portal

Para que el **Customer Portal** funcione (botón "Gestionar método de pago y facturas" en la app):

- **STRIPE_SECRET_KEY** y **STRIPE_WEBHOOK_SECRET** (ya documentados).
- **FRONTEND_URL**: URL base del frontend (ej. `https://app.ejemplo.com` o `http://localhost:3001`). Se usa como `return_url` por defecto al crear la sesión del portal (`FRONTEND_URL/settings/billing`). Si el cliente envía `returnUrl` en el body de `POST /billing/portal-session`, se usa ese en su lugar.

---

## 7. Customer Portal (implementado)

Los usuarios de un tenant pueden ver su plan y suscripción y abrir el **Stripe Customer Portal** para:

- Actualizar el método de pago.
- Ver y descargar facturas.
- Gestionar la suscripción (según configuración del portal en Stripe).

### API

- **GET /billing/subscription** (JWT): Devuelve `plan`, `subscription` (status, currentPeriodEnd, currentPeriodStart) y `canManageBilling` (true si el tenant tiene suscripción en Stripe). Solo usuarios con tenant; los platform admins reciben 400.
- **POST /billing/portal-session** (JWT, body opcional `{ returnUrl }`): Crea una sesión del Stripe Billing Portal y devuelve `{ url }`. Redirigir al usuario a esa URL. Si no se envía `returnUrl`, se usa `FRONTEND_URL/settings/billing`.

### Frontend

- **Ruta:** `/settings/billing` (menú: Administración → Facturación).
- Muestra plan actual, estado de la suscripción y fecha de próxima renovación.
- Si `canManageBilling` es true, muestra el botón "Gestionar método de pago y facturas", que llama a `POST /billing/portal-session` y redirige a la URL devuelta.
- Los platform admins ven un mensaje indicando que deben usar el panel proveedor.

### Configuración en Stripe

En el [Dashboard de Stripe](https://dashboard.stripe.com/settings/billing/portal) se puede configurar qué opciones ve el cliente en el portal (actualizar pago, ver facturas, cancelar suscripción, etc.).

---

## 8. Referencias

- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- Modelo actual: `docs/SAAS_MODELO_NEGOCIO_Y_OPERACION.md`, `apps/api/prisma/schema.prisma` (Plan, Subscription, Tenant).
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)

---

**Última actualización:** Febrero 2026
