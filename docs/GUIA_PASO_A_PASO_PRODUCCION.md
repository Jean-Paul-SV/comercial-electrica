# Guía paso a paso: preparar producción

Sigue estos pasos en orden. Marca cada uno cuando lo termines.

---

## Paso 0: Tener a mano

- [ ] Tu **URL de la API en producción** (ej: `https://comercial-electrica-api.onrender.com`)
- [ ] Tu **URL del frontend** (ej: `https://tu-app.vercel.app`)
- [ ] Cuenta en **Stripe** (dashboard.stripe.com)
- [ ] Cuenta en **Render** (o donde esté desplegada la API)
- [ ] Un **email** donde quieras recibir alertas (ej: tu correo personal o de negocio)

---

## Paso 1: Variables de entorno en producción (Render)

### 1.1 Entrar a Render

1. Entra a [https://dashboard.render.com](https://dashboard.render.com)
2. Abre tu **servicio de la API** (el que corresponde al backend, no al frontend).

### 1.2 Ir a Environment

1. En el menú del servicio, haz clic en **Environment**.
2. Ahí verás las variables que ya tienes.

### 1.3 Variables obligatorias (revisar que existan)

Comprueba que tengas **todas** estas. Si falta alguna, **Add Environment Variable** y rellena:

| Variable | Dónde la obtienes | Ejemplo (no uses estos valores reales) |
|---------|--------------------|----------------------------------------|
| `DATABASE_URL` | Render suele añadirla si la BD es de Render | `postgresql://user:pass@host/db` |
| `REDIS_URL` | Si usas Redis de Render, lo añades desde el dashboard | `redis://...` |
| `JWT_ACCESS_SECRET` | Inventar una cadena larga y aleatoria (mín. 32 caracteres) | Generar con: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `JWT_REFRESH_SECRET` | Otra cadena distinta, también larga | Igual que arriba, otro valor |
| `FRONTEND_URL` | URL de tu app web en producción | `https://tu-app.vercel.app` |
| `ALLOWED_ORIGINS` | Misma URL del frontend (o varias separadas por coma) | `https://tu-app.vercel.app` |

### 1.4 Variables de Stripe

| Variable | Dónde la obtienes |
|----------|-------------------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → **Secret key** (empieza por `sk_live_` en producción o `sk_test_` en pruebas) |
| `STRIPE_WEBHOOK_SECRET` | Lo configurarás en el **Paso 2** (empieza por `whsec_...`) |

Añade `STRIPE_SECRET_KEY` ya si tienes la clave. `STRIPE_WEBHOOK_SECRET` la añadirás después de crear el webhook.

### 1.5 Variables para alertas por email

Para que la API te avise cuando falle algo (BD, backups, etc.):

| Variable | Valor |
|----------|--------|
| `ALERTS_ENABLED` | `true` |
| `ALERT_EMAIL` | Tu email (ej: `tuemail@gmail.com`) |

Si quieres que también envíe correos (recuperar contraseña, alertas), configura SMTP:

| Variable | Dónde la obtienes |
|----------|-------------------|
| `SMTP_HOST` | Ej: `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Tu correo (ej: `noreply@tudominio.com`) |
| `SMTP_PASS` | Contraseña de aplicación (en Gmail: cuenta → Seguridad → Contraseñas de aplicación) |
| `SMTP_FROM` | Ej: `Orion <noreply@tudominio.com>` |

- [ ] He revisado/añadido todas las variables en Render.
- [ ] He guardado los cambios (Save Changes). Si Render pregunta, confirma **Redeploy** para que cargue las nuevas variables.

---

## Paso 2: Configurar el webhook de Stripe en producción

Sin este paso, cuando un cliente pague en Stripe tu API no se entera y el plan no se activa.

### 2.1 URL del webhook

Será:

```
https://TU-URL-API/billing/webhooks/stripe
```

Ejemplo: si tu API es `https://comercial-electrica-api.onrender.com`, la URL es:

```
https://comercial-electrica-api.onrender.com/billing/webhooks/stripe
```

Anótala: _________________________

### 2.2 Crear el endpoint en Stripe

1. Entra a [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Arriba a la derecha elige **Modo Prueba** o **Modo Live** según lo que uses.
3. Menú lateral: **Developers** → **Webhooks**.
4. Clic en **Add endpoint** (o “Añadir endpoint”).

### 2.3 Rellenar el formulario

1. **Endpoint URL:** pega la URL del paso 2.1 (la de tu API + `/billing/webhooks/stripe`).
2. En **Select events to listen to** elige **Select events** (no “Receive all”).
3. Marca estos eventos:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Clic en **Add endpoint**.

### 2.4 Copiar el Signing secret

1. Se abre la ficha del webhook que acabas de crear.
2. En **Signing secret** haz clic en **Reveal**.
3. Copia el valor (empieza por `whsec_...`).

### 2.5 Poner el secret en Render

1. Vuelve a **Render** → tu servicio API → **Environment**.
2. **Add Environment Variable** (o editar si ya existe):
   - **Key:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** el `whsec_...` que copiaste.
3. Guarda y, si Render lo ofrece, **Redeploy**.

### 2.6 Probar el webhook

1. En Stripe, en la misma página del webhook, busca **Send test webhook**.
2. Elige por ejemplo **checkout.session.completed**.
3. Clic en **Send test webhook**.
4. Debe aparecer respuesta **200**. Si sale 400 o 500, revisa:
   - Que la URL sea exactamente la de tu API + `/billing/webhooks/stripe`.
   - Que `STRIPE_WEBHOOK_SECRET` en Render sea el mismo que el “Signing secret” de ese endpoint en Stripe.

- [ ] Webhook creado en Stripe con la URL de producción.
- [ ] `STRIPE_WEBHOOK_SECRET` configurado en Render.
- [ ] Test webhook devuelve 200.

---

## Paso 3: Configurar un monitor externo (recomendado)

Así te avisan si tu API deja de responder (caída, error 500, etc.).

### Opción A: UptimeRobot (gratis)

1. Entra a [https://uptimerobot.com](https://uptimerobot.com) y crea cuenta o inicia sesión.
2. **Add New Monitor**.
3. Rellena:
   - **Monitor Type:** HTTP(s).
   - **Friendly Name:** ej. “Orion API”.
   - **URL:** `https://TU-URL-API/health` (ej: `https://comercial-electrica-api.onrender.com/health`).
   - **Monitoring Interval:** 5 minutes (o el mínimo que permita el plan).
4. En **Alert Contacts** añade tu email (o crea un contacto con tu email).
5. Guarda.

Cuando la URL no responda o devuelva algo distinto de 200, te enviarán un email.

- [ ] Monitor creado en UptimeRobot (o similar) apuntando a `https://TU-URL-API/health`.
- [ ] Alert contact con mi email.

### Opción B: Otra herramienta

Puedes usar Better Uptime, Pingdom, etc. Lo importante:

- **URL a vigilar:** `https://TU-URL-API/health`
- **Condición de alerta:** no responde en X minutos O código distinto de 200.

---

## Paso 4: Ejecutar el script de verificación (en tu PC)

Este script comprueba que el proyecto está listo para desplegar (build, tests, variables locales, etc.). Se ejecuta **en tu máquina**, en la carpeta del proyecto.

### 4.1 Abrir terminal en la raíz del proyecto

Abre PowerShell o CMD y ve a la carpeta del proyecto, por ejemplo:

```bash
cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica
```

### 4.2 Tener API y dependencias listas

Si no lo has hecho hoy:

```bash
cd apps/api
npm install
cd ../..
```

### 4.3 Ejecutar el script

Desde la **raíz** del proyecto (donde está la carpeta `scripts`):

```bash
node scripts/verificar-pre-despliegue.js
```

### 4.4 Qué esperar

- Si todo va bien: verás mensajes en verde y al final algo como “Todo listo para desplegar”.
- Si falta alguna variable de entorno **en tu .env local**, el script puede avisarte; en producción lo importante es que estén en Render (Paso 1).
- Si el **build** o los **tests** fallan, el script lo indicará; en ese caso corrige los errores antes de considerar el despliegue listo.

- [ ] He ejecutado `node scripts/verificar-pre-despliegue.js` desde la raíz del proyecto.
- [ ] Build y comprobaciones pasan (o he anotado qué falla para corregirlo).

---

## Paso 5: Comprobar que todo funciona en producción

### 5.1 Health check

En el navegador o con curl:

```
https://TU-URL-API/health
```

Deberías ver un JSON con `"status":"ok"` y `"database":"connected"` (o similar). Si ves `"status":"degraded"` o `"error"`, revisa los logs del servicio en Render.

- [ ] `GET /health` devuelve status OK.

### 5.2 Probar login en la app

1. Abre tu **frontend en producción** (la URL que pusiste en `FRONTEND_URL` y `ALLOWED_ORIGINS`).
2. Inicia sesión con un usuario que exista en la BD de producción.
3. Comprueba que puedes entrar al dashboard o a una pantalla principal.

- [ ] Puedo iniciar sesión en la app en producción.

### 5.3 (Opcional) Probar un pago de prueba

Si tienes Stripe en modo prueba:

1. En la app, ve a Planes / Facturación.
2. Elige un plan y “Completar compra”.
3. Usa la tarjeta de prueba de Stripe: `4242 4242 4242 4242`.
4. Completa el pago en Stripe Checkout.
5. Vuelve a la app y comprueba que el plan se activa (y que en Stripe aparece el evento y el webhook con 200).

- [ ] (Opcional) He probado un pago de prueba y el plan se activa correctamente.

---

## Resumen de lo que has hecho

- [ ] **Paso 1:** Variables de entorno en Render (BD, JWT, Stripe, FRONTEND_URL, ALLOWED_ORIGINS, alertas).
- [ ] **Paso 2:** Webhook de Stripe con la URL de tu API, eventos necesarios y `STRIPE_WEBHOOK_SECRET` en Render; test 200.
- [ ] **Paso 3:** Monitor externo (ej. UptimeRobot) apuntando a `https://TU-URL-API/health`.
- [ ] **Paso 4:** Script `node scripts/verificar-pre-despliegue.js` ejecutado y sin errores críticos.
- [ ] **Paso 5:** Health check OK y login en producción (y pago de prueba si aplica).

Si todos los pasos están marcados, tu configuración para producción está lista. Para operación diaria y resolver problemas, usa:

- **Operaciones y mantenimiento:** `docs/RUNBOOK_OPERACIONES_COMPLETO.md`
- **Errores frecuentes:** `docs/TROUBLESHOOTING_COMPLETO.md`
- **Despliegues seguros:** `docs/PROCEDIMIENTO_DESPLIEGUE.md`
