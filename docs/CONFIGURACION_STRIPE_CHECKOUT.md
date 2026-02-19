# Configuración de Stripe para Checkout Sessions

## Flujo actual (tipo Spotify)

Cuando un usuario **no tiene plan** y elige uno, al hacer clic en **"Completar compra"** se le redirige a **Stripe Checkout**: una página donde introduce tarjeta, revisa el resumen y completa el pago. Al pagar, el webhook `checkout.session.completed` activa el plan en la app. No se usa Customer Portal para la primera compra.

## Qué debes configurar

Para que los usuarios puedan completar el pago de suscripciones nuevas, necesitas configurar Checkout Sessions en Stripe.

### Paso 1: Verificar que los Productos y Precios estén creados

1. Ve a **Stripe Dashboard** → **Products**
2. Verifica que todos tus planes tienen productos creados
3. Cada producto debe tener al menos un precio (mensual o anual)
4. Copia los **Price IDs** (empiezan con `price_...`)

### Paso 2: Asignar Price IDs a los Planes

1. Ve al **Panel Proveedor** en tu aplicación
2. Edita cada plan y asigna:
   - `stripePriceId`: Price ID del precio mensual
   - `stripePriceIdYearly`: Price ID del precio anual (si aplica)

### Paso 3: Configurar Customer Portal (Opcional pero Recomendado)

El Customer Portal se usa para gestionar métodos de pago y facturas de suscripciones activas.

1. Ve a **Stripe Dashboard** → **Settings** → **Billing** → **Customer portal**
2. Configura las siguientes opciones:
   - **Allow customers to update payment methods**: ✅ Activado
   - **Allow customers to cancel subscriptions**: Configura según tu política
   - **Allow customers to switch plans**: Desactivado (manejamos esto desde la app)

### Paso 4: Verificar Webhook Configuration

1. Ve a **Stripe Dashboard** → **Developers** → **Webhooks**
2. Verifica que tienes un webhook apuntando a tu API: `https://tu-api.com/billing/webhooks/stripe`
3. Los eventos que debe escuchar (obligatorio para compra tipo Spotify):
   - `checkout.session.completed` — al completar la compra en Checkout, se activa el plan en la app
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

### Paso 5: Probar el Flujo Completo

1. **Crea un nuevo tenant** sin plan asignado
2. **Selecciona un plan** desde la página de facturación
3. **Deberías ser redirigido a Checkout** (no al Customer Portal)
4. **Ingresa los datos de la tarjeta de prueba**: `4242 4242 4242 4242`
5. **Completa el pago**
6. **Verifica que la suscripción se activa** automáticamente

## Tarjetas de Prueba

- **Pago exitoso**: `4242 4242 4242 4242`
- **CVC**: Cualquier 3 dígitos (ej: `123`)
- **Fecha**: Cualquier fecha futura (ej: `12/34`)
- **Código postal**: Cualquier código válido

## Troubleshooting

### Problema: "Me redirige al Customer Portal en lugar de Checkout"

**Causa**: La suscripción no está en estado `incomplete` o no tiene un `payment_intent` pendiente.

**Solución**: 
1. Verifica en Stripe Dashboard que la suscripción tiene estado `incomplete`
2. Verifica que la factura tiene un `payment_intent` con estado `requires_payment_method`
3. Revisa los logs del backend para ver qué está pasando

### Problema: "No puedo completar el pago en Checkout"

**Causa**: El `payment_intent` puede estar en un estado incorrecto o expirado.

**Solución**:
1. Ve a Stripe Dashboard → **Subscriptions**
2. Busca la suscripción incompleta
3. Ve a la factura pendiente
4. Si el `payment_intent` está expirado, cancela la suscripción y crea una nueva

### Problema: "El precio no coincide"

**Causa**: El `stripePriceId` o `stripePriceIdYearly` no está configurado correctamente en el plan.

**Solución**:
1. Ve al Panel Proveedor → Planes
2. Edita el plan y verifica que los Price IDs son correctos
3. Los Price IDs deben empezar con `price_...`

## Notas Importantes

- **Modo Prueba**: Asegúrate de estar usando las claves de prueba (`sk_test_...` y `pk_test_...`)
- **Moneda**: Los precios deben estar en la misma moneda que configuraste en Stripe (probablemente COP)
- **Tax Rates**: Si usas impuestos automáticos, asegúrate de tener Stripe Tax configurado o un Tax Rate manual
