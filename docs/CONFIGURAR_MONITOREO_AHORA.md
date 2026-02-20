# Configurar monitoreo externo (ahora)

**Tiempo:** ~10 minutos  
**Objetivo:** Que UptimeRobot haga GET a tu API cada 5 min y te avise por email si deja de responder.

---

## 1. Comprobar que `/health` responde

Antes de crear el monitor, verifica que tu API en Render responde:

```bash
# Sustituye TU-API por la URL real de tu servicio en Render (ej. comercial-electrica-api)
curl https://TU-API.onrender.com/health
```

Debes ver algo como:

```json
{"status":"ok","timestamp":"...","uptime":...,"environment":"production","services":{...}}
```

Si no tienes aún la URL de Render, despliega primero el servicio y copia la URL del dashboard (ej. `https://comercial-electrica-api.onrender.com`).

---

## 2. Crear cuenta en UptimeRobot

1. Entra en **[uptimerobot.com](https://uptimerobot.com)**.
2. **Sign Up Free** (email + contraseña).
3. Verifica el email si te lo piden.

---

## 3. Añadir contacto de alerta (tu email)

1. En UptimeRobot: **Alert Contacts** (menú izquierdo).
2. **Add Alert Contact**.
3. **Type:** Email.  
4. **Value:** tu email.  
5. **Friendly Name:** ej. `Mi email`.  
6. Guardar.

---

## 4. Crear el monitor

1. **Dashboard** → **"+ Add New Monitor"**.
2. Rellena:

| Campo | Valor |
|-------|--------|
| **Monitor Type** | HTTP(s) |
| **Friendly Name** | `Comercial Electrica API` |
| **URL (or IP)** | `https://TU-API.onrender.com/health` |
| **Monitoring Interval** | 5 minutes |
| **Alert Contacts** | Marca el contacto de email que creaste |

3. **Create Monitor**.

---

## 5. Verificar

- En 5–10 minutos el monitor debería pasar a **Up** (verde).
- Prueba opcional: en Render, detén el servicio unos minutos; deberías recibir un email “Monitor is Down”. Luego inicia de nuevo y deberías recibir “Monitor is Up”.

---

## Resumen

- **URL a monitorear:** `https://TU-API.onrender.com/health`
- **Intervalo:** 5 minutos
- **Alertas:** por email (Down y Up)

Guía detallada (Slack, SMS, varios endpoints): `docs/GUIA_MONITOREO_EXTERNO.md`.
