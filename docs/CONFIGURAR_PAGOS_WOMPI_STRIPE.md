# Configurar pagos (PayU y Stripe)

Para usar pagos en Orion necesitas crear cuentas y configurar las credenciales en el backend.

---

## 1. Stripe (suscripciones y facturación recurrente)

**Uso en Orion:** suscripciones por plan (panel proveedor), portal del cliente para actualizar método de pago.

**Importante:** Stripe **no permite crear cuentas desde Colombia**. Si tu negocio está en Colombia, al registrarte en Stripe debes usar un país soportado; lo más habitual es **Estados Unidos** (US). Para pagos de clientes en Colombia (PSE, Nequi, Daviplata, tarjetas) usa **PayU** (sección 2).

### Crear cuenta y obtener keys

1. Entra en **https://dashboard.stripe.com** y crea una cuenta (modo **prueba** para desarrollo). Si estás en Colombia, elige **Estados Unidos** como país de la cuenta.
2. **Clave secreta:** En *Developers → API keys* copia la **Secret key** (empieza por `sk_test_` en pruebas).
   - En el proyecto: `STRIPE_SECRET_KEY=sk_test_...` en el `.env` del **API** (raíz o `apps/api`).
3. **Webhook (opcional pero recomendado):** En *Developers → Webhooks* añade un endpoint:
   - URL: `https://tu-dominio.com/billing/stripe` (en local puedes usar ngrok para pruebas).
   - Eventos: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, etc. (según lo que use el `BillingService`).
   - Copia el **Signing secret** (empieza por `whsec_`).
   - En el proyecto: `STRIPE_WEBHOOK_SECRET=whsec_...` en el `.env` del API.

### Variables en `.env` (API)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Sin `STRIPE_SECRET_KEY` el módulo de facturación no creará suscripciones en Stripe. Sin `STRIPE_WEBHOOK_SECRET` los webhooks no se validarán (en producción deberías configurarlo).

---

## 2. PayU (Colombia – PSE, Nequi, Daviplata, tarjetas)

**Uso en Orion:** pagos únicos o módulos/add-ons por tenant. PayU acepta PSE, Nequi, Daviplata, tarjetas de crédito/débito y efectivo referenciado.

### Crear cuenta y obtener credenciales

1. Entra en **https://colombia.payu.com** y regístrate. Para pruebas usa el entorno **sandbox** (PayU te dará merchantId, accountId y apiKey de pruebas).
2. En el panel PayU (Configuración → Configuración técnica) obtienes:
   - **API Key (apiKey):** clave para firmar las transacciones.
   - **Merchant ID (merchantId):** identificador de tu tienda.
   - **Account ID (accountId):** ID de cuenta por país. Para Colombia pruebas suele ser `512321`.
3. **URL de confirmación:** Configura la URL a la que PayU enviará el POST cuando se confirme el pago:
   - Ejemplo: `https://tu-dominio.com/payu/webhook`
   - El endpoint está en `apps/api/src/payu/payu.controller.ts` (método POST `/payu/webhook`).
   - En local puedes usar ngrok y poner esa URL en `PAYU_CONFIRMATION_URL` y en el panel PayU.

### Variables en `.env` (API)

```env
PAYU_API_KEY=...
PAYU_MERCHANT_ID=...
PAYU_ACCOUNT_ID=512321
PAYU_TEST=true
PAYU_CONFIRMATION_URL=https://tu-dominio.com/payu/webhook
```

- Sin `PAYU_API_KEY`, `PAYU_MERCHANT_ID` y `PAYU_ACCOUNT_ID` el backend creará registros locales de pago pero no generará el formulario válido para redirigir a PayU.
- **Pruebas:** `PAYU_TEST=true` y usa credenciales sandbox. **Producción:** `PAYU_TEST=false` y credenciales reales.
- Documentación: **https://developers.payulatam.com/latam/es/docs/integrations/**.

---

## 3. Dónde se usan en el código

| Servicio | Archivo principal | Variables que lee |
|----------|-------------------|-------------------|
| Stripe   | `apps/api/src/billing/billing.service.ts` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayU     | `apps/api/src/payu/payu.service.ts`        | `PAYU_API_KEY`, `PAYU_MERCHANT_ID`, `PAYU_ACCOUNT_ID`, `PAYU_TEST`, `PAYU_CONFIRMATION_URL` |

Las keys **nunca** deben ir en el frontend ni en el repositorio. Usa `.env` local y en producción un gestor de secretos (Render Secrets, AWS Secrets Manager, etc.).

---

## 4. Resumen

1. **Stripe:** cuenta en dashboard.stripe.com (país US) → `STRIPE_SECRET_KEY` y opcionalmente `STRIPE_WEBHOOK_SECRET` en `.env` del API.
2. **PayU:** cuenta en colombia.payu.com → `PAYU_API_KEY`, `PAYU_MERCHANT_ID`, `PAYU_ACCOUNT_ID`, `PAYU_TEST` y `PAYU_CONFIRMATION_URL` en `.env` del API.
3. Coloca las variables en el archivo `.env` que use la API (raíz del proyecto o `apps/api`, según cómo levantes el servidor).
4. Reinicia la API tras cambiar las variables.
