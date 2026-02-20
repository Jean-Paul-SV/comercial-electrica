# Guía: Configuración de Monitoreo Externo

**Prioridad:** 🔴 **CRÍTICO**  
**Tiempo estimado:** 15 minutos  
**Objetivo:** Detectar caídas del sistema antes de que los clientes las noten

---

## ⚠️ Por qué es crítico

El health check interno (`/health`) solo funciona si el servidor está corriendo. Si Render suspende el servicio o hay un problema de red, **no recibirás alertas**.

**Monitoreo externo** verifica desde fuera de tu infraestructura y te alerta inmediatamente si algo falla.

**Impacto:** Sin monitoreo externo, puedes perder horas de uptime sin saberlo, causando churn de clientes.

---

## 🎯 Opciones de Monitoreo

### Recomendado: UptimeRobot (Gratis)

- ✅ Gratis hasta 50 monitores
- ✅ Alertas por email, SMS, Slack, webhook
- ✅ Checks cada 5 minutos (gratis)
- ✅ Historial de uptime
- ✅ Fácil configuración

**Alternativas:**
- **Pingdom** (pago, más features)
- **StatusCake** (gratis limitado)
- **Better Uptime** (pago, mejor UX)

---

## 📋 Configuración con UptimeRobot

### Paso 1: Crear Cuenta

1. Ve a [https://uptimerobot.com](https://uptimerobot.com)
2. Crea cuenta gratuita (no requiere tarjeta)
3. Verifica email

---

### Paso 2: Crear Monitor

1. En el dashboard, haz clic en **"+ Add New Monitor"**
2. Configura:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `Orion API - Health Check`
   - **URL:** `https://TU-API.onrender.com/health`
   - **Monitoring Interval:** 5 minutes (gratis)
   - **Alert Contacts:** Selecciona tu email

3. Haz clic en **"Create Monitor"**

---

### Paso 3: Configurar Alertas

1. Ve a **Alert Contacts** en el menú
2. Añade contactos:
   - **Email:** Tu email principal
   - **SMS:** Tu número (opcional, requiere créditos)
   - **Slack:** Webhook de Slack (opcional)

3. Configura qué alertas recibir:
   - ✅ **Down:** Cuando el servicio cae
   - ✅ **Up:** Cuando el servicio se recupera
   - ⚠️ **Paused:** Cuando el monitor se pausa (opcional)

---

### Paso 4: Verificar Funcionamiento

1. Espera 5-10 minutos para el primer check
2. Verifica que el monitor muestra **"Up"** (verde)
3. Prueba manualmente:

```bash
curl https://TU-API.onrender.com/health
```

Debe devolver `{"status":"ok"}`

---

## 🔔 Configuración de Alertas Avanzadas

### Slack Webhook

1. En Slack, crea un **Incoming Webhook**:
   - Ve a tu workspace → **Apps** → **Incoming Webhooks**
   - Crea nuevo webhook
   - Copia la URL

2. En UptimeRobot:
   - Ve a **Alert Contacts** → **Add Alert Contact**
   - Selecciona **Slack**
   - Pega la URL del webhook
   - Guarda

3. Asigna el contacto al monitor

---

### SMS (Opcional)

1. En UptimeRobot, ve a **Account Settings** → **SMS Credits**
2. Compra créditos (mínimo $5)
3. Añade número de teléfono en **Alert Contacts**
4. Asigna al monitor

**Nota:** SMS cuesta créditos, email es gratis.

---

## 📊 Monitoreo de Múltiples Endpoints

### Health Check Principal

```
URL: https://TU-API.onrender.com/health
Interval: 5 minutes
Alert: Down/Up
```

### Health Check Detallado (Opcional)

```
URL: https://TU-API.onrender.com/metrics
Interval: 15 minutes
Alert: Solo Down (métricas pueden variar)
```

### Frontend (Si está desplegado)

```
URL: https://TU-FRONTEND.vercel.app
Interval: 5 minutes
Alert: Down/Up
```

---

## ✅ Checklist de Configuración

- [ ] Cuenta UptimeRobot creada
- [ ] Monitor creado para `/health`
- [ ] Email configurado como contacto de alerta
- [ ] Monitor muestra estado "Up"
- [ ] Prueba manual de `/health` funciona
- [ ] Alertas configuradas (Down/Up)
- [ ] Slack webhook configurado (opcional)
- [ ] SMS configurado (opcional)

---

## 🚨 Qué Hacer Cuando Recibes una Alerta

### Alerta: "Service is DOWN"

1. **Inmediato (0-5 min):**
   - Verifica en Render Dashboard si el servicio está corriendo
   - Revisa logs en Render para errores
   - Verifica que la BD está accesible

2. **Si el servicio está suspendido:**
   - Ve a Render Dashboard → Servicio
   - Haz clic en **"Manual Deploy"** o **"Restart"**
   - Espera 2-3 minutos

3. **Si hay error en código:**
   - Revisa logs para identificar el error
   - Si es crítico, haz rollback a versión anterior
   - Documenta el incidente

4. **Comunicación:**
   - Si hay clientes afectados, comunica el problema
   - Actualiza status page (si tienes uno)
   - Post-mortem después de resolver

---

### Alerta: "Service is UP"

**Acción:** Verifica que todo funciona correctamente:
- Health check devuelve OK
- No hay errores en logs
- Clientes pueden acceder

---

## 📈 Métricas de Monitoreo

### Uptime Target

- **Objetivo:** >99.5% uptime mensual
- **Aceptable:** >99.0% uptime mensual
- **Crítico:** <99.0% uptime mensual (requiere acción inmediata)

### Tiempo de Respuesta

- **Objetivo:** <500ms p95
- **Aceptable:** <1000ms p95
- **Crítico:** >2000ms p95 (degradación de performance)

---

## 🔧 Troubleshooting

### Monitor muestra "Down" pero el servicio funciona

**Causas posibles:**
1. **Timeout:** El health check tarda >30 segundos
2. **SSL:** Problema con certificado SSL
3. **Firewall:** UptimeRobot bloqueado

**Solución:**
1. Verifica tiempo de respuesta del health check
2. Prueba con `curl` manualmente
3. Revisa logs de Render para errores

---

### No recibo alertas

**Causas posibles:**
1. Email en spam
2. Contacto no asignado al monitor
3. Alertas deshabilitadas

**Solución:**
1. Revisa carpeta de spam
2. Verifica que el contacto está asignado al monitor
3. Verifica configuración de alertas en UptimeRobot

---

## 🎯 Próximos Pasos

Después de configurar monitoreo externo:

1. **Configurar status page** (opcional) - Para comunicar estado a clientes
2. **Documentar procedimientos de respuesta** - Ver `docs/RUNBOOK_OPERACIONES_COMPLETO.md`
3. **Configurar alertas adicionales** - Para métricas específicas (BD, Redis, etc.)

---

## 📚 Referencias

- [UptimeRobot Documentation](https://uptimerobot.com/api/)
- [Render Status Page](https://status.render.com/)
- [Health Check Endpoint](../apps/api/src/app.controller.ts)

---

**Última actualización:** Febrero 2026  
**Tiempo total:** 15 minutos  
**Dificultad:** Baja
