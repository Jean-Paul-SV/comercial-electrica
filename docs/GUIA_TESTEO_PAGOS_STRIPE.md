# Guía de Testeo de Pagos en Stripe

Esta guía te ayudará a probar completamente el flujo de pagos y suscripciones con Stripe en modo de prueba.

---

## 📋 Prerequisitos

Antes de empezar a testear, asegúrate de tener:

- [ ] Cuenta de Stripe creada (modo **prueba** activado)
- [ ] `STRIPE_SECRET_KEY` configurada (debe empezar con `sk_test_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` configurado (opcional pero recomendado)
- [ ] Webhook configurado en Stripe Dashboard apuntando a tu API
- [ ] Productos y precios creados en Stripe
- [ ] Price IDs asignados a los planes en el Panel Proveedor

---

## 💳 Tarjetas de Prueba de Stripe

### Tarjeta de Éxito (Pago Exitoso)
```
Número: 4242 4242 4242 4242
CVC: Cualquier 3 dígitos (ej: 123)
Fecha de expiración: Cualquier fecha futura (ej: 12/34)
Código postal: Cualquier código válido (ej: 12345)
```

### Tarjetas para Diferentes Escenarios

| Escenario | Número de Tarjeta | Descripción |
|-----------|-------------------|-------------|
| **Pago exitoso** | `4242 4242 4242 4242` | Visa - Pago aprobado inmediatamente |
| **Pago rechazado (fondos insuficientes)** | `4000 0000 0000 9995` | Tarjeta rechazada por fondos insuficientes |
| **Pago rechazado genérico** | `4000 0000 0000 0002` | Tarjeta rechazada genérica |
| **Requiere 3D Secure** | `4000 0027 6000 3184` | Requiere autenticación 3D Secure |
| **Tarjeta expirada** | `4000 0000 0000 0069` | Tarjeta con fecha de expiración pasada |
| **CVC incorrecto** | `4000 0000 0000 0127` | Código CVC incorrecto |
| **Fraude detectado** | `4100 0000 0000 0019` | Tarjeta rechazada por fraude |
| **Colombia específica** | `4000 0017 0000 0003` | Visa para pruebas en Colombia |

**Notas importantes:**
- Usa cualquier CVC de 3 dígitos
- Usa cualquier fecha futura como expiración
- No se cobra dinero real en modo prueba
- Todas estas tarjetas son simuladas

---

## 🧪 Flujo de Prueba Completo

### Paso 1: Crear un Tenant y Asignar Plan

1. **Accede al Panel Proveedor** (como platform admin)
2. **Crea un nuevo tenant** o usa uno existente
3. **Asigna un plan** que tenga `stripePriceId` configurado
   - El plan debe tener un Price ID de Stripe asignado
   - Puedes verificar esto en: Panel Proveedor → Planes → Editar plan

**Resultado esperado:**
- Se crea un cliente en Stripe automáticamente
- Se crea una suscripción en Stripe con estado `incomplete`
- El tenant queda con estado `PENDING_PAYMENT`

**Verificación en Stripe Dashboard:**
- Ve a **Customers** → Busca el cliente por `metadata['tenantId']`
- Verifica que existe una suscripción asociada

---

### Paso 2: Probar el Portal de Pago

1. **Inicia sesión** como usuario del tenant creado
2. **Ve a Configuración → Facturación** (`/settings/billing`)
3. **Verifica que aparece:**
   - El nombre del plan asignado
   - El precio del plan (mensual o anual según corresponda)
   - Un mensaje de "Pago pendiente"
   - Un botón "Completar pago"

4. **Haz clic en "Completar pago"**
   - Deberías ser redirigido al portal de Stripe

**Resultado esperado:**
- Se abre el portal de Stripe Customer Portal
- Puedes ver el método de pago y el monto a pagar

---

### Paso 3: Agregar Método de Pago y Pagar

1. **En el portal de Stripe:**
   - Haz clic en "Agregar método de pago" o "Actualizar método de pago"
   - Ingresa los datos de una tarjeta de prueba:
     - **Para éxito:** `4242 4242 4242 4242`
     - **Para probar rechazo:** `4000 0000 0000 9995`
   - CVC: `123` (cualquier 3 dígitos)
   - Fecha: `12/34` (cualquier fecha futura)
   - Código postal: `12345`

2. **Confirma el pago**

**Resultado esperado (con tarjeta exitosa):**
- El pago se procesa exitosamente
- La suscripción cambia a estado `active` en Stripe
- El webhook `invoice.paid` se envía a tu API
- El tenant se desbloquea automáticamente

**Resultado esperado (con tarjeta rechazada):**
- El pago falla
- La suscripción permanece en `incomplete` o `past_due`
- El webhook `invoice.payment_failed` se envía a tu API
- El tenant permanece bloqueado

---

### Paso 4: Verificar que el Pago se Procesó

#### En tu Aplicación:

1. **Refresca la página de facturación**
   - El estado debería cambiar de "Pago pendiente" a "Activa"
   - Deberías poder acceder a todos los módulos

2. **Verifica los logs del servidor:**
   ```bash
   # Busca en los logs:
   - "invoice.paid" procesado
   - Suscripción actualizada a ACTIVE
   - Tenant desbloqueado
   ```

#### En Stripe Dashboard:

1. **Ve a Customers → [Tu cliente]**
   - Verifica que la suscripción está en estado `active`
   - Verifica que hay una factura pagada

2. **Ve a Webhooks → [Tu endpoint] → Eventos**
   - Deberías ver eventos `invoice.paid` con estado `200 OK`
   - Si hay eventos fallidos (rojos), revisa los logs de tu API

3. **Ve a Payments**
   - Deberías ver el pago exitoso (en modo prueba aparece como "Test mode")

---

### Paso 5: Probar Cambio de Plan

1. **Como usuario del tenant**, ve a Configuración → Facturación
2. **Selecciona un plan diferente** (upgrade o downgrade)
3. **Confirma el cambio**

**Resultado esperado:**
- Si es upgrade: se aplica inmediatamente con prorrateo
- Si es downgrade: se programa para el final del ciclo actual
- La suscripción en Stripe se actualiza

**Verificación:**
- En Stripe Dashboard → Customers → [Tu cliente] → Suscripción
- Verifica que el precio cambió según el nuevo plan

---

### Paso 6: Probar Renovación Automática

Las suscripciones se renuevan automáticamente al final del período. Para probar esto:

1. **En Stripe Dashboard → Customers → [Tu cliente]**
2. **Haz clic en la suscripción**
3. **Usa la opción "Test clock"** (si está disponible) para avanzar el tiempo
   - O espera hasta el final del período de facturación

**Resultado esperado:**
- Se genera una nueva factura automáticamente
- Se procesa el pago con el método guardado
- El webhook `invoice.paid` se envía
- La suscripción se renueva por otro período

---

### Paso 7: Probar Cancelación

1. **En el portal de Stripe** (accesible desde tu app)
2. **Cancela la suscripción**

**Resultado esperado:**
- La suscripción cambia a `cancel_at_period_end` en Stripe
- El webhook `customer.subscription.updated` se envía
- El tenant mantiene acceso hasta el final del período
- Después del período, el tenant se bloquea

---

## 🔍 Verificación de Webhooks

### Verificar que los Webhooks Llegan

1. **En Stripe Dashboard → Webhooks → [Tu endpoint]**
2. **Ve a "Eventos recientes"**
3. **Verifica que los eventos tienen estado `200 OK`**

**Eventos importantes a verificar:**
- `invoice.paid` - Cuando se paga una factura
- `invoice.payment_failed` - Cuando falla un pago
- `customer.subscription.updated` - Cuando cambia la suscripción
- `customer.subscription.deleted` - Cuando se cancela la suscripción

### Si un Webhook Falla

1. **Haz clic en el evento fallido** (aparece en rojo)
2. **Revisa el mensaje de error**
3. **Revisa los logs de tu API** para ver qué falló
4. **Puedes reenviar el evento** haciendo clic en "Send again"

**Causas comunes de fallos:**
- URL del webhook incorrecta
- `STRIPE_WEBHOOK_SECRET` incorrecto o no configurado
- Error en el código del webhook handler
- Timeout del servidor

---

## 📊 Verificación en la Base de Datos

Puedes verificar el estado de las suscripciones directamente en la base de datos:

```sql
-- Ver todas las suscripciones
SELECT 
  id,
  "tenantId",
  status,
  "stripeSubscriptionId",
  "currentPeriodEnd",
  "currentPeriodStart"
FROM "Subscription";

-- Ver suscripciones con Stripe
SELECT 
  s.id,
  s.status,
  s."stripeSubscriptionId",
  t.name as tenant_name,
  p.name as plan_name
FROM "Subscription" s
JOIN "Tenant" t ON s."tenantId" = t.id
LEFT JOIN "Plan" p ON s."planId" = p.id
WHERE s."stripeSubscriptionId" IS NOT NULL;

-- Ver eventos de Stripe procesados (si tienes la tabla StripeEvent)
SELECT 
  "eventId",
  "eventType",
  processed,
  "createdAt"
FROM "StripeEvent"
ORDER BY "createdAt" DESC
LIMIT 10;
```

---

## 🐛 Solución de Problemas Comunes

### Problema: El portal de Stripe no se abre

**Síntomas:**
- Error 400 al intentar abrir el portal
- Mensaje: "No se pudo conectar con el servicio de facturación"

**Soluciones:**
1. Verifica que `STRIPE_SECRET_KEY` está configurada
2. Verifica que la clave es válida (empieza con `sk_test_...`)
3. Revisa los logs del servidor para el error específico
4. Verifica que el tenant tiene un cliente creado en Stripe

---

### Problema: El pago se procesa pero el tenant sigue bloqueado

**Síntomas:**
- El pago aparece en Stripe Dashboard
- Pero el tenant sigue con estado `PENDING_PAYMENT`

**Soluciones:**
1. Verifica que el webhook está configurado correctamente
2. Revisa los eventos del webhook en Stripe Dashboard
3. Si el webhook falló, reenvíalo manualmente
4. La app también sincroniza automáticamente al cargar la página de billing

---

### Problema: Los webhooks no llegan

**Síntomas:**
- No aparecen eventos en Stripe Dashboard → Webhooks → Eventos

**Soluciones:**
1. Verifica que la URL del webhook es correcta y accesible
2. Verifica que la URL es HTTPS (no HTTP)
3. Verifica que `STRIPE_WEBHOOK_SECRET` está configurado
4. Prueba hacer un pago de nuevo para generar un nuevo evento

---

### Problema: Error "Invalid API Key"

**Síntomas:**
- Error al crear suscripciones o abrir el portal
- Mensaje sobre API key inválida

**Soluciones:**
1. Verifica que estás usando la clave de prueba (`sk_test_...`) en desarrollo
2. Verifica que la clave no fue revocada en Stripe Dashboard
3. Genera una nueva clave si es necesario
4. Reinicia el servidor después de cambiar la clave

---

## ✅ Checklist de Verificación Final

Después de probar todos los flujos, verifica:

- [ ] Puedo crear un tenant y asignarle un plan
- [ ] El portal de Stripe se abre correctamente
- [ ] Puedo agregar un método de pago con tarjeta de prueba
- [ ] El pago se procesa exitosamente con tarjeta `4242 4242 4242 4242`
- [ ] El tenant se desbloquea después del pago
- [ ] Los webhooks llegan correctamente (estado 200)
- [ ] Puedo cambiar de plan (upgrade y downgrade)
- [ ] Puedo cancelar la suscripción
- [ ] El precio se muestra correctamente en la página de billing
- [ ] Los eventos aparecen en Stripe Dashboard

---

## 📚 Recursos Adicionales

- **Documentación oficial de Stripe Testing:** https://docs.stripe.com/testing
- **Lista completa de tarjetas de prueba:** https://stripe.com/docs/testing
- **Guía de webhooks:** https://stripe.com/docs/webhooks
- **Customer Portal:** https://stripe.com/docs/billing/subscriptions/integrating-customer-portal

---

## 💡 Tips para Testing

1. **Usa el modo prueba de Stripe** - Nunca uses claves de producción (`sk_live_...`) para testing
2. **Revisa los logs** - Los logs del servidor te darán información detallada sobre qué está pasando
3. **Usa diferentes tarjetas** - Prueba tanto escenarios exitosos como fallidos
4. **Verifica los webhooks** - Los webhooks son críticos para que todo funcione correctamente
5. **Prueba en diferentes navegadores** - Asegúrate de que el portal funciona en todos los navegadores

---

¡Con esta guía deberías poder probar completamente el flujo de pagos en Stripe! 🎉
