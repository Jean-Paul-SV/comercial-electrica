# Configurar pagos (Wompi, PayU y Stripe)

Para usar pagos en Orion necesitas crear cuentas y configurar las credenciales en el backend.

**Véase también:** [Facturación y planes](./FACTURACION_Y_PLANES.md) — cómo funcionan los planes, el cambio de plan, prorrateo y cobro mensual/anual.

---

## 1. Stripe (suscripciones y facturación recurrente)

**Uso en Orion:** suscripciones por plan (panel proveedor), portal del cliente para actualizar método de pago.

**Importante:** Stripe **no permite crear cuentas desde Colombia**. Si tu negocio está en Colombia, al registrarte en Stripe debes usar un país soportado; lo más habitual es **Estados Unidos** (US). Para pagos de clientes en Colombia (PSE, Nequi, Daviplata, tarjetas) usa **PayU** (sección 2).

### Crear cuenta y obtener keys

1. Entra en **https://dashboard.stripe.com** y crea una cuenta (modo **prueba** para desarrollo). Si estás en Colombia, elige **Estados Unidos** como país de la cuenta.
2. **Clave secreta:** En *Developers → API keys* copia la **Secret key** (empieza por `sk_test_` en pruebas).
   - En el proyecto: `STRIPE_SECRET_KEY=sk_test_...` en el `.env` del **API** (raíz o `apps/api`).
3. **Webhook (recomendado; en producción es casi obligatorio):** En *Developers → Webhooks* añade un endpoint:
   - **URL:** `https://tu-api.com/billing/webhooks/stripe` (reemplaza `tu-api.com` por el dominio de tu API, por ejemplo `tu-app.onrender.com`). En local usa ngrok y esa URL.
   - **Eventos a escuchar:** `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`.
   - Copia el **Signing secret** (empieza por `whsec_`).
   - En el proyecto: `STRIPE_WEBHOOK_SECRET=whsec_...` en el `.env` del API (y en producción en las variables de entorno del servicio).

### Variables en `.env` (API)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Sin `STRIPE_SECRET_KEY` el módulo de facturación no creará suscripciones en Stripe. Sin `STRIPE_WEBHOOK_SECRET` los webhooks no se validarán (en producción la API responde 500 si falta).

### Próximos pasos Stripe (checklist)

| Paso | Dónde | Qué hacer |
|------|--------|-----------|
| 1 | **Stripe Dashboard** → Developers → Webhooks | Añadir endpoint: URL = `https://TU-DOMINIO-API/billing/webhooks/stripe`. Seleccionar eventos: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`. Copiar el **Signing secret** (whsec_...). |
| 2 | **Producción (Render, etc.)** → Environment | Definir `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`. Sin el webhook secret, en producción el webhook responde 500. |
| 3 | **Panel proveedor** → Planes | Asignar **Stripe Price ID** a cada plan que quieras cobrar por Stripe (ej. `price_...` desde Stripe → Products → precios). |
| 4 | **Después del primer pago** | En Stripe → Webhooks → tu endpoint → "Eventos recientes": comprobar que los envíos devuelven **200**. Si hay 4xx/5xx, revisar logs de la API y que la URL y el secret sean correctos. |

**Nota:** Si el webhook falla o llega tarde, la app intenta igual desbloquear al usuario: al cargar la página de facturación se consulta el estado de la suscripción en Stripe y, si ya está activa, se actualiza la base de datos. Así el usuario no se queda bloqueado aunque el webhook falle una vez.

---

## 2. Wompi (Colombia – Nequi, PSE, tarjetas, Bancolombia)

**Uso en Orion:** pagar suscripciones desde Colombia con Nequi, PSE, tarjetas, transferencia Bancolombia, etc. La opción "Pagar con Wompi" aparece en la página de facturación cuando Wompi está configurado.

### Crear cuenta y obtener credenciales

1. Regístrate en **https://comercios.wompi.co** (dashboard de comercios).
2. En *Desarrolladores* obtienes:
   - **Llave pública** (`pub_test_...` en sandbox, `pub_prod_...` en producción).
   - **Llave privada** (`priv_test_...` / `priv_prod_...`).
   - **Secreto de integridad** (en "Secretos para integración técnica"): se usa para firmar cada transacción (SHA256).
3. Documentación: **https://docs.wompi.co/docs/colombia/** (transacciones, métodos de pago, tokens de aceptación).

### Variables en `.env` (API)

```env
WOMPI_PRIVATE_KEY=priv_test_...
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_INTEGRITY_SECRET=test_integrity_...
# Opcional: base URL (por defecto sandbox o producción según el prefijo de la llave)
# WOMPI_BASE_URL=https://sandbox.wompi.co/v1
# Para forzar producción aunque uses llave test: WOMPI_USE_PRODUCTION=false
```

- Sin las tres variables (`WOMPI_PRIVATE_KEY`, `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`) la opción Wompi no se muestra en la app.
- **Pruebas:** usa llaves con prefijo `pub_test_` / `priv_test_` y secreto de sandbox.
- **Producción:** llaves `pub_prod_` / `priv_prod_` y secreto de integridad de producción.
- En la página de facturación, el usuario puede elegir "Pagar con Wompi" → Nequi (teléfono), y próximamente PSE y tarjeta.

---

## 3. PayU (Colombia – PSE, Nequi, Daviplata, tarjetas)

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

## 4. Dónde se usan en el código

| Servicio | Archivo principal | Variables que lee |
|----------|-------------------|-------------------|
| Stripe   | `apps/api/src/billing/billing.service.ts` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Wompi    | `apps/api/src/billing/wompi/wompi.service.ts` | `WOMPI_PRIVATE_KEY`, `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_BASE_URL`, `FRONTEND_URL` |
| PayU     | `apps/api/src/payu/payu.service.ts`        | `PAYU_API_KEY`, `PAYU_MERCHANT_ID`, `PAYU_ACCOUNT_ID`, `PAYU_TEST`, `PAYU_CONFIRMATION_URL` |

Las keys **nunca** deben ir en el frontend ni en el repositorio. Usa `.env` local y en producción un gestor de secretos (Render Secrets, AWS Secrets Manager, etc.).

---

## 5. Resumen

1. **Stripe:** cuenta en dashboard.stripe.com (país US) → `STRIPE_SECRET_KEY` y opcionalmente `STRIPE_WEBHOOK_SECRET` en `.env` del API.
2. **Wompi:** cuenta en comercios.wompi.co → `WOMPI_PRIVATE_KEY`, `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` en `.env` del API. Ideal para Colombia (Nequi, PSE, tarjetas).
3. **PayU:** cuenta en colombia.payu.com → `PAYU_API_KEY`, `PAYU_MERCHANT_ID`, `PAYU_ACCOUNT_ID`, `PAYU_TEST` y `PAYU_CONFIRMATION_URL` en `.env` del API.
4. Coloca las variables en el archivo `.env` que use la API (raíz del proyecto o `apps/api`, según cómo levantes el servidor).
5. Reinicia la API tras cambiar las variables.
