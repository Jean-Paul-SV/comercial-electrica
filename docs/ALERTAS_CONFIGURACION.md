# 🔔 Configuración de Sistema de Alertas

**Fecha:** 2026-02-16  
**Estado:** Guía de configuración y uso

---

## 📋 Índice

1. [Configuración Inicial](#configuración-inicial)
2. [Integración con Slack](#integración-con-slack)
3. [Integración con Email](#integración-con-email)
4. [Integración con Webhook](#integración-con-webhook)
5. [Tipos de Alertas](#tipos-de-alertas)
6. [Testing](#testing)

---

## ⚙️ Configuración Inicial

### Variables de Entorno

```bash
# Habilitar alertas automáticas
ALERTS_ENABLED=true

# Slack (opcional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Email (opcional, solo para alertas críticas)
ALERT_EMAIL=admin@tudominio.com

# Webhook externo (opcional)
ALERT_WEBHOOK_URL=https://api.tu-sistema.com/webhooks/alerts
ALERT_WEBHOOK_SECRET=tu-secret-opcional
```

---

## 💬 Integración con Slack

### 1. Crear Webhook en Slack

1. Ir a [Slack Apps](https://api.slack.com/apps)
2. Crear nueva app o usar existente
3. Ir a "Incoming Webhooks"
4. Activar "Activate Incoming Webhooks"
5. Click en "Add New Webhook to Workspace"
6. Seleccionar canal (ej: #alerts)
7. Copiar la URL del webhook

### 2. Configurar en `.env`

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/REEMPLAZAR_CON_TU_WEBHOOK_REAL
ALERTS_ENABLED=true
```

### 3. Ejemplo de Alerta en Slack

```
🚨 Tenant cerca de límite de rate

Mensaje: El tenant "Empresa ABC" está usando 85.5% de su límite de rate (85.5/100 req/min)

Tenant: Empresa ABC
Severidad: WARNING

tenantId: abc-123-def-456
currentUsage: 85.5
rateLimit: 100
usagePercent: 85.5
```

---

## 📧 Integración con Email

### 1. Configurar SMTP

```bash
# Ya debe estar configurado para otros emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@tudominio.com
SMTP_PASS=tu-password
SMTP_FROM=Orion <noreply@tudominio.com>

# Email para alertas críticas
ALERT_EMAIL=admin@tudominio.com
```

### 2. Comportamiento

- **Solo alertas críticas:** Las alertas con `severity='critical'` se envían por email
- **Formato HTML:** Incluye detalles completos y metadata
- **Fallback:** Si SMTP no está configurado, solo se registra en logs

---

## 🔗 Integración con Webhook

### 1. Configurar Webhook

```bash
ALERT_WEBHOOK_URL=https://api.tu-sistema.com/webhooks/alerts
ALERT_WEBHOOK_SECRET=mi-secret-seguro
```

### 2. Formato del Payload

El webhook recibe un POST con el siguiente formato:

```json
{
  "timestamp": "2026-02-16T10:30:00.000Z",
  "title": "Tenant cerca de límite de rate",
  "message": "El tenant \"Empresa ABC\" está usando 85.5% de su límite...",
  "severity": "warning",
  "tenantId": "abc-123-def-456",
  "tenantName": "Empresa ABC",
  "metadata": {
    "currentUsage": 85.5,
    "rateLimit": 100,
    "usagePercent": 85.5
  }
}
```

### 3. Headers

```
Content-Type: application/json
X-Webhook-Secret: mi-secret-seguro (si está configurado)
```

### 4. Ejemplo de Handler (Node.js)

```typescript
app.post('/webhooks/alerts', async (req, res) => {
  // Verificar secret
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.ALERT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const alert = req.body;
  
  // Procesar alerta
  console.log(`[${alert.severity}] ${alert.title}`);
  console.log(alert.message);
  
  // Guardar en BD, enviar a otro sistema, etc.
  await saveAlertToDatabase(alert);
  
  res.json({ received: true });
});
```

---

## 📊 Tipos de Alertas

### 1. Rate Limit Alerts

**Cuándo se dispara:**
- Tenant alcanza 80%+ de su límite de rate (configurable)

**Severidad:**
- `warning`: 80-95% del límite
- `critical`: >95% del límite

**Frecuencia:**
- Verificación cada hora

**Ejemplo:**
```typescript
{
  title: "Tenant cerca de límite de rate",
  message: "El tenant \"Empresa ABC\" está usando 85.5%...",
  severity: "warning",
  tenantId: "abc-123",
  tenantName: "Empresa ABC",
  metadata: {
    currentUsage: 85.5,
    rateLimit: 100,
    usagePercent: 85.5
  }
}
```

### 2. High Error Rate Alerts

**Cuándo se dispara:**
- Tasa de errores HTTP >10%

**Severidad:**
- `warning`: 10-20% de errores
- `critical`: >20% de errores

**Frecuencia:**
- Verificación cada 15 minutos

### 3. High Latency Alerts

**Cuándo se dispara:**
- Latencia promedio >2000ms

**Severidad:**
- `warning`: 2000-5000ms
- `critical`: >5000ms

**Frecuencia:**
- Verificación cada 15 minutos

---

## 🧪 Testing

### 1. Enviar Alerta de Prueba

```bash
curl -X POST https://api.tudominio.com/metrics/alerts/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Verificar Configuración

```bash
# Verificar que las alertas están habilitadas
curl https://api.tudominio.com/metrics/rate-limit-alerts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Logs

Las alertas se registran en los logs:

```
[MetricsAlertsScheduler] Ejecutando verificación de rate limits
[AlertService] Enviando alerta a Slack
[AlertService] Enviando alerta por email
```

---

## 🔧 Troubleshooting

### Problema: No se reciben alertas en Slack

**Solución:**
1. Verificar que `ALERTS_ENABLED=true`
2. Verificar que `SLACK_WEBHOOK_URL` está configurado correctamente
3. Probar webhook manualmente:
   ```bash
   curl -X POST $SLACK_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"text":"Test"}'
   ```
4. Revisar logs para errores

### Problema: No se reciben emails

**Solución:**
1. Verificar configuración SMTP
2. Verificar que `ALERT_EMAIL` está configurado
3. Solo se envían alertas `critical` por email
4. Verificar logs de MailerService

### Problema: Webhook no recibe datos

**Solución:**
1. Verificar que `ALERT_WEBHOOK_URL` está configurado
2. Verificar que el endpoint acepta POST
3. Verificar secret si está configurado
4. Revisar logs para errores de conexión

---

## 📚 Referencias

- Servicio de alertas: `apps/api/src/common/services/alert.service.ts`
- Servicio de métricas: `apps/api/src/metrics/metrics-alerts.service.ts`
- Scheduler: `apps/api/src/metrics/metrics-alerts.scheduler.ts`
- Endpoint de prueba: `POST /metrics/alerts/test`

---

**Última actualización:** 2026-02-16
