# Configurar alertas por email (ahora)

**Tiempo:** ~15 minutos  
**Objetivo:** Recibir por correo las alertas críticas (y opcionalmente las warning) de la API: BD, Redis, certificados DIAN, pagos no reconocidos, etc.

---

## 1. Qué necesitas

- **SMTP:** Un servidor de correo para que la API envíe los emails. Opciones habituales:
  - **Gmail:** cuenta de Google + contraseña de aplicación (no la contraseña normal). [Crear contraseña de app](https://myaccount.google.com/apppasswords).
  - **Resend, SendGrid, Mailgun:** cuentas gratuitas limitadas; te dan host, usuario y contraseña/API key.
- **Un email** donde quieras recibir las alertas (ej. `admin@tudominio.com` o tu Gmail).

---

## 2. Variables en Render (servicio de la API)

En **Render** → tu servicio de API → **Environment** → añade o edita:

| Variable | Valor | Notas |
|----------|--------|--------|
| `ALERTS_ENABLED` | `true` | Activa el sistema de alertas. |
| `ALERT_EMAIL` | `tu@email.com` | Email donde recibir alertas críticas. |
| `SMTP_HOST` | Ver tabla abajo según proveedor | Gmail, Resend, SendGrid, Outlook, etc. |
| `SMTP_PORT` | `587` (o `465` para SSL) | Para Gmail/Outlook suele ser 587. |
| `SMTP_USER` | Tu email o usuario API | Cuenta que envía (o API key como usuario en algunos proveedores). |
| `SMTP_PASS` | Contraseña de app o API key | Gmail: contraseña de aplicación; Resend/SendGrid: API key. |
| `SMTP_FROM` | `Orion <noreply@tudominio.com>` | Nombre y correo que aparecen como remitente. |

**Proveedores SMTP habituales:**

| Proveedor | SMTP_HOST | SMTP_PORT | Notas |
|-----------|-----------|-----------|--------|
| **Gmail** | `smtp.gmail.com` | `587` | Usar [contraseña de aplicación](https://myaccount.google.com/apppasswords), no la contraseña normal. |
| **Outlook / Microsoft 365** | `smtp.office365.com` | `587` | Cuenta @outlook.com o @tuempresa.com (365). |
| **Resend** | `smtp.resend.com` | `465` o `587` | SMTP_USER = `resend`, SMTP_PASS = API key (dashboard Resend). |
| **SendGrid** | `smtp.sendgrid.net` | `587` | SMTP_USER = `apikey`, SMTP_PASS = tu API key. |
| **Mailgun** | `smtp.mailgun.org` | `587` | Usuario y contraseña en Mailgun → Sending → Domain credentials. |

**Opcional:**

| Variable | Valor |
|----------|--------|
| `ALERT_EMAILS` | `admin@x.com,soporte@x.com` | Varios destinatarios (sustituye a `ALERT_EMAIL`). |
| `ALERT_EMAIL_INCLUDE_WARNING` | `true` | Recibir también alertas de severidad "warning" por email (por defecto solo "critical"). |

Guarda los cambios. Render hará un **redeploy** automático; espera a que termine.

---

## 3. Ejemplo con Gmail

1. En tu cuenta Google: **Seguridad** → **Contraseñas de aplicaciones** (o [Crear contraseña de app](https://myaccount.google.com/apppasswords)).
2. Genera una contraseña para "Correo" / "Otro" y cópiala.
3. En Render, en el servicio de la API, define:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = tu Gmail
   - `SMTP_PASS` = la contraseña de aplicación (16 caracteres, sin espacios o con espacios según te la dé Google)
   - `SMTP_FROM` = `Orion <tu-gmail@gmail.com>`
   - `ALERTS_ENABLED` = `true`
   - `ALERT_EMAIL` = el email donde quieres recibir alertas (puede ser el mismo u otro)

---

## 4. Comportamiento

- **Críticas:** Siempre se envían por email (caída BD, Redis, certificado DIAN, pago no reconocido, etc.) si SMTP y `ALERT_EMAIL` (o `ALERT_EMAILS`) están configurados.
- **Warning:** Solo por email si `ALERT_EMAIL_INCLUDE_WARNING=true` (por defecto no).
- Si SMTP no está configurado o falta `ALERT_EMAIL`/`ALERT_EMAILS`, las alertas solo se registran en logs.

---

## 5. Cómo comprobar que funciona

### Opción A: Enviar alerta de prueba por email (recomendado)

La API tiene un endpoint que envía una alerta de prueba. Para que **llegue por correo**, hay que llamarlo con `severity=critical` (las alertas "info" no se envían por email).

1. **Obtener un token JWT** de un usuario que tenga permiso `metrics:read` (por ejemplo un admin o platform admin). Inicia sesión en tu app o usa `POST /auth/login` y copia el `accessToken`.
2. **Llamar al endpoint de prueba** (sustituye `TU-API` y `TU_TOKEN`):

   ```bash
   curl -X POST "https://TU-API.onrender.com/metrics/alerts/test?severity=critical" \
     -H "Authorization: Bearer TU_TOKEN" \
     -H "Content-Type: application/json"
   ```

   Si todo está bien, la respuesta será algo como `{"message":"Alerta de prueba enviada","severity":"critical","emailSent":true}` y en unos segundos deberías recibir un correo en `ALERT_EMAIL` con asunto tipo "Alerta de Prueba".
3. **Spam:** Revisa la carpeta de spam la primera vez y marca como "No es spam" si aplica.

### Opción B: Sin endpoint (esperar una alerta real)

- **Logs:** Si se dispara una alerta crítica (BD, Redis, DIAN, etc.), en los logs de Render verás algo relacionado con el envío por email.
- **Prueba real:** Cuando ocurra un evento crítico, recibirás el correo en la bandeja de `ALERT_EMAIL`.

---

## 6. Resumen

| Qué | Dónde |
|-----|--------|
| Activar alertas | `ALERTS_ENABLED=true` |
| Destinatario(s) | `ALERT_EMAIL=tu@email.com` o `ALERT_EMAILS=email1,email2` |
| Envío (SMTP) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` en Render |
| Opcional: warnings por email | `ALERT_EMAIL_INCLUDE_WARNING=true` |

Guía detallada (Slack, webhook, tipos de alertas): `docs/ALERTAS_CONFIGURACION.md`.
