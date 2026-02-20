# Variables que toca configurar: Alertas e IA

Resumen de las variables de entorno que debes configurar para **alertas** y para que el **Resumen del día (IA)** funcione.

---

## 1. Alertas

Para que la API envíe alertas (errores críticos, tenant cerca del límite de rate, backups, etc.):

| Variable | Obligatoria | Dónde | Ejemplo |
|----------|-------------|--------|---------|
| **ALERTS_ENABLED** | Sí (para activar) | `.env` o Render | `true` |
| **ALERT_EMAIL** | Recomendada | `.env` o Render | `tu-email@gmail.com` |

Opcionales (elegir al menos un canal o solo email):

| Variable | Uso |
|----------|-----|
| **SLACK_WEBHOOK_URL** | Envía alertas a un canal de Slack. Crear en [api.slack.com/apps](https://api.slack.com/apps) → Incoming Webhooks. |
| **ALERT_WEBHOOK_URL** | URL externa que recibe un POST JSON con la alerta. |
| **ALERT_WEBHOOK_SECRET** | Secret opcional para firmar/autenticar el webhook externo. |

Para que las alertas por **email** lleguen, además debes configurar SMTP:

| Variable | Ejemplo |
|----------|---------|
| SMTP_HOST | `smtp.gmail.com` |
| SMTP_PORT | `587` |
| SMTP_USER | `noreply@tudominio.com` |
| SMTP_PASS | Contraseña de aplicación (Gmail: cuenta → Seguridad → Contraseñas de aplicación) |
| SMTP_FROM | `Orion <noreply@tudominio.com>` |

**Resumen alertas:** Pon `ALERTS_ENABLED=true` y `ALERT_EMAIL=tu@email.com`. Si quieres recibir por correo, configura también SMTP. Si prefieres Slack, crea el webhook y pon `SLACK_WEBHOOK_URL=...`.

---

## 2. IA – Resumen del día (OpenAI)

El "Resumen del día" en el dashboard usa OpenAI solo si la API tiene configurada la clave.

| Variable | Dónde obtenerla | Dónde configurar |
|----------|-----------------|-------------------|
| **OPENAI_API_KEY** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → Create new secret key (empieza por `sk-...`) | `.env` en local; en Render: Environment → Add variable `OPENAI_API_KEY` = `sk-...` |

**Si la API key "no funciona":**

1. **Nombre correcto:** La variable debe ser exactamente `OPENAI_API_KEY` (en la API, no en el frontend).
2. **Sin espacios:** En `.env` no dejes espacios: `OPENAI_API_KEY=sk-...` (sin comillas si no hay espacios en el valor).
3. **Clave válida:** Debe ser una clave de API de OpenAI (sk-...) activa, con saldo o créditos si tu cuenta lo requiere.
4. **Redeploy:** En Render, después de añadir o cambiar la variable, guarda y haz **Redeploy** para que el proceso cargue el nuevo valor.
5. **Logs:** Si no está configurada, en los logs de la API verás: `OPENAI_API_KEY no configurada, usando resumen automático.` Si está configurada pero OpenAI falla, verás `OpenAI API error: ...` con el código de estado (401 = clave inválida, 429 = sin créditos, etc.).

Sin `OPENAI_API_KEY` el dashboard sigue funcionando: se muestra un "Resumen automático" con los primeros indicadores, sin LLM.

---

## 3. Lista rápida (copiar y rellenar)

**Mínimo para alertas:**

```env
ALERTS_ENABLED=true
ALERT_EMAIL=tu-email@ejemplo.com
```

**Para recibir alertas por email (SMTP):**

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=contraseña-de-aplicacion
SMTP_FROM=Orion <tu-correo@gmail.com>
```

**Para IA (Resumen del día):**

```env
OPENAI_API_KEY=sk-tu-clave-openai
```

**Opcional – Slack:**

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
```

Documentación detallada: [ALERTAS_CONFIGURACION.md](./ALERTAS_CONFIGURACION.md) y [OPENAI_API_CONFIG.md](./OPENAI_API_CONFIG.md).
