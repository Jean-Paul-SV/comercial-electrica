# Banner "Total a pagar" – Monto consistente con Stripe

## Problema

El banner mostraba un valor incorrecto (ej. 126.998.079 COP) que no coincidía con el monto que Stripe muestra al hacer clic en "Completar pago".

## Causa del error

La lógica anterior usaba **dos orígenes** distintos según el estado:

1. **Cuando `requiresPayment` (PENDING_PAYMENT):** se usaba `stripe.invoices.retrieveUpcoming({ subscription })` y se tomaba `upcoming.amount_due`.  
   - La "upcoming invoice" es una **previsualización** del próximo cobro (prorrateos, siguiente periodo, etc.), no la factura real pendiente de pago.  
   - Puede incluir líneas o montos que aún no están en una factura `open` y no coincide con lo que el usuario paga en Checkout/Portal.

2. **Cuando suscripción ACTIVE:** se listaban facturas por `subscription` con `status: 'open'` y se usaba la primera.  
   - Listar por `subscription` puede no ser equivalente a "la factura que el cliente debe pagar ahora" si hay varias suscripciones o facturas abiertas.  
   - Además, si antes se había rellenado `pendingInvoiceAmount` con la upcoming (en otro flujo), se podían mezclar orígenes.

Nunca se usó explícitamente `customer.balance`, `amount_remaining` acumulado ni `subscription.total_spent`, pero el uso de **upcoming** y la posible mezcla de fuentes hacían que el monto del banner no coincidiera con el `amount_due` de la factura abierta que Stripe muestra al pagar.

## Solución implementada

- **Una sola fuente de verdad:** la factura con `status: 'open'` más reciente del **customer** en Stripe.
- **API usada:**
  1. Obtener el Stripe Customer ID desde la suscripción: `stripe.subscriptions.retrieve(subscriptionId)` → `subscription.customer`.
  2. Listar facturas: `stripe.invoices.list({ customer: customerId, status: 'open', limit: 1 })`.  
     Stripe devuelve la lista en orden **created desc**, así que el primer elemento es la más reciente.
- **Monto mostrado:** solo `invoice.amount_due` de esa única factura (en COP, zero-decimal, ya en pesos).
- **Si no hay factura `open`:** no se muestra monto en el banner (`pendingInvoiceAmount = null`) y, si corresponde, no se considera "factura pendiente" (`hasUnpaidInvoice = false`).

## Código backend (resumen)

- **Archivo:** `apps/api/src/billing/billing.service.ts`, método `getSubscriptionForTenant`.
- Lógica:
  - Recuperar suscripción Stripe → obtener `customerId`.
  - `stripe.invoices.list({ customer: customerId, status: 'open', limit: 1 })`.
  - Si hay resultado y `inv.status === 'open'` y `inv.amount_due >= 0` → `hasUnpaidInvoice = true`, `pendingInvoiceAmount = inv.amount_due`.
  - En cualquier otro caso no se asigna monto ni bandera de factura pendiente.

## Qué no se usa

- `customer.balance`
- `invoices.retrieveUpcoming`
- Suma de varias facturas abiertas
- `amount_remaining` acumulado
- `subscription.total_spent`
- Facturas con `status: 'void'` o `'uncollectible'` (no se listan al filtrar `status: 'open'`).

## Edge cases

- **Varias facturas abiertas:** solo se usa la más reciente (`limit: 1`, orden por defecto por `created` desc).
- **Factura void / uncollectible:** no aparecen con `status: 'open'`, no se muestran en el banner.
- **Factura en proceso de pago:** sigue en `open` hasta que pase a `paid`; `amount_due` sigue siendo el monto a pagar hasta entonces.

## Frontend

- El banner muestra "Total a pagar: $XXX" solo cuando el backend envía `pendingInvoiceAmount != null`.
- Se usa `formatPrice(pendingInvoiceAmount)` con moneda COP (ya en pesos).
- No se requirieron cambios en el frontend; la corrección es solo en el backend.

## Validación con Stripe Dashboard

1. En Stripe Dashboard → Customers → [cliente] → Invoices.
2. Filtrar por Status = **Open**.
3. La factura más reciente (created) debe tener un **Amount due** en COP.
4. Ese valor debe coincidir con el que muestra el banner en la app y con el monto que ve el usuario al entrar a "Completar pago" (Checkout/Portal).
