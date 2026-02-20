# ✅ Checklist Completo: Migración Render Free → Starter + Monitoreo

**Fecha:** 2026-02-18  
**Prioridad:** 🔴 **CRÍTICO** (E1: Render Free Plan)  
**Tiempo estimado:** 30-45 minutos  
**Costo:** ~$7-25/mes (dependiendo del plan)

---

## 🎯 Objetivo

Migrar de plan `free` a `starter` o superior en Render para:
- ✅ SLA garantizado (99.95%)
- ✅ Escalado automático
- ✅ Sin suspensiones por inactividad
- ✅ Mejor performance y recursos

Y configurar monitoreo externo para detectar downtime proactivamente.

---

## 📋 Checklist Pre-Migración

### 1. Preparación

- [ ] **Backup completo de base de datos**
  ```bash
  # Crear backup manual antes de migrar
  curl -X POST https://tu-api.com/backups \
    -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN" \
    -H "Content-Type: application/json"
  ```

- [ ] **Verificar estado actual**
  - [ ] Revisar logs recientes en Render Dashboard
  - [ ] Verificar que no hay errores críticos
  - [ ] Confirmar que health check `/health` responde OK

- [ ] **Documentar configuración actual**
  - [ ] Variables de entorno críticas
  - [ ] Configuración de base de datos
  - [ ] URLs de webhooks (Stripe, etc.)

---

## 🚀 Pasos de Migración

### Paso 1: Actualizar `render.yaml`

- [ ] Editar `render.yaml` en la raíz del proyecto
- [ ] Cambiar `plan: free` a `plan: starter` (o superior)
- [ ] Verificar que todas las configuraciones estén correctas

**Ejemplo:**
```yaml
services:
  - type: web
    name: comercial-electrica-api
    plan: starter  # ← Cambiar de 'free' a 'starter'
    # ... resto de configuración
```

- [ ] Commit y push a repositorio
  ```bash
  git add render.yaml
  git commit -m "chore: migrar plan Render de free a starter"
  git push origin main
  ```

### Paso 2: Aplicar Cambios en Render Dashboard

- [ ] Ir a [Render Dashboard](https://dashboard.render.com)
- [ ] Seleccionar el servicio de API
- [ ] Ir a **Settings** → **Plan**
- [ ] Seleccionar plan **Starter** (o superior)
- [ ] Confirmar cambios
- [ ] Render iniciará redeploy automáticamente

**Nota:** El redeploy puede tomar 2-5 minutos. El servicio seguirá funcionando durante la migración.

### Paso 3: Verificar Post-Migración

- [ ] **Esperar a que el redeploy complete**
  - Monitorear logs en Render Dashboard
  - Verificar que el servicio esté "Live"

- [ ] **Verificar health check**
  ```bash
  curl https://tu-api.onrender.com/health | jq
  ```
  - Debe retornar `status: "ok"`
  - Verificar métricas de conexiones BD

- [ ] **Probar endpoints críticos**
  ```bash
  # Login
  curl -X POST https://tu-api.onrender.com/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"..."}'
  
  # Health check con métricas
  curl https://tu-api.onrender.com/health | jq '.services.database.connections'
  ```

- [ ] **Verificar logs**
  - Revisar que no hay errores nuevos
  - Confirmar que las métricas de conexiones BD están funcionando

---

## 📊 Configuración de Monitoreo Externo

### Opción 1: UptimeRobot (Recomendado - Gratis)

#### Paso 1: Crear Cuenta

- [ ] Ir a [UptimeRobot](https://uptimerobot.com)
- [ ] Crear cuenta gratuita (50 monitores gratis)

#### Paso 2: Crear Monitor

- [ ] Click en **"Add New Monitor"**
- [ ] Configurar:
  - **Monitor Type:** HTTP(s)
  - **Friendly Name:** `Comercial Electrica API`
  - **URL:** `https://tu-api.onrender.com/health`
  - **Monitoring Interval:** 5 minutes
  - **Alert Contacts:** Agregar tu email

- [ ] Guardar monitor

#### Paso 3: Configurar Alertas

- [ ] Ir a **Alert Contacts**
- [ ] Agregar email para alertas
- [ ] Opcional: Configurar webhook para Slack/Discord

#### Paso 4: Verificar

- [ ] Esperar 5-10 minutos
- [ ] Verificar que el monitor muestre estado "Up"
- [ ] Probar alerta: Detener servicio temporalmente y verificar que recibes email

---

### Opción 2: Pingdom (Alternativa)

- [ ] Crear cuenta en [Pingdom](https://www.pingdom.com)
- [ ] Configurar monitor HTTP para `/health`
- [ ] Configurar alertas por email/SMS

---

### Opción 3: StatusCake (Alternativa)

- [ ] Crear cuenta en [StatusCake](https://www.statuscake.com)
- [ ] Configurar monitor HTTP para `/health`
- [ ] Configurar alertas

---

## ✅ Checklist Post-Migración

### Verificación Inmediata (Primeros 30 minutos)

- [ ] ✅ Servicio está "Live" en Render Dashboard
- [ ] ✅ Health check responde OK
- [ ] ✅ Endpoints críticos funcionan
- [ ] ✅ No hay errores en logs
- [ ] ✅ Métricas de conexiones BD visibles
- [ ] ✅ Monitoreo externo configurado y funcionando

### Verificación 24 Horas Después

- [ ] ✅ No hay downtime reportado
- [ ] ✅ Performance mejorada (verificar métricas)
- [ ] ✅ Alertas de monitoreo funcionando correctamente
- [ ] ✅ Revisar logs para detectar problemas

### Verificación Semanal

- [ ] ✅ Revisar métricas de uso de recursos
- [ ] ✅ Verificar que no hay suspensiones
- [ ] ✅ Confirmar que monitoreo sigue activo

---

## 🔧 Troubleshooting

### Problema: Servicio no inicia después de migración

**Solución:**
1. Revisar logs en Render Dashboard
2. Verificar variables de entorno
3. Verificar que `DATABASE_URL` sigue siendo válida
4. Si persiste, contactar soporte de Render

### Problema: Health check falla

**Solución:**
1. Verificar que `/health` endpoint está funcionando localmente
2. Revisar logs de la aplicación
3. Verificar conexión a base de datos
4. Verificar conexión a Redis

### Problema: Monitoreo no detecta downtime

**Solución:**
1. Verificar que la URL del monitor es correcta
2. Verificar que el intervalo de monitoreo está configurado
3. Probar manualmente deteniendo el servicio
4. Verificar spam folder si no recibes alertas

---

## 📝 Documentación a Actualizar

Después de la migración, actualizar:

- [ ] `docs/ESTADO_ACTUAL_DEL_PROYECTO.md` - Actualizar plan Render
- [ ] `docs/DEPLOY.md` - Documentar proceso de migración
- [ ] `docs/RUNBOOK_OPERACIONES.md` - Actualizar información de infraestructura

---

## 💰 Costos Esperados

| Plan | Precio/mes | Características |
|------|------------|-----------------|
| **Starter** | $7 | 512MB RAM, 0.5 CPU, SLA 99.95% |
| **Standard** | $25 | 2GB RAM, 1 CPU, Auto-scaling |
| **Pro** | $85 | 4GB RAM, 2 CPU, Auto-scaling avanzado |

**Recomendación:** Empezar con **Starter** y escalar según necesidad.

---

## 🎯 Métricas de Éxito

- ✅ **SLA:** 99.95% uptime garantizado
- ✅ **Downtime detectado:** < 5 minutos (via monitoreo externo)
- ✅ **Performance:** Sin degradación, idealmente mejorada
- ✅ **Alertas:** Funcionando correctamente

---

## 📞 Contactos de Emergencia

- **Render Support:** [support@render.com](mailto:support@render.com)
- **Documentación Render:** [render.com/docs](https://render.com/docs)
- **Status Page Render:** [status.render.com](https://status.render.com)

---

## ✅ Checklist Final

- [ ] Migración completada
- [ ] Monitoreo externo configurado
- [ ] Alertas funcionando
- [ ] Documentación actualizada
- [ ] Equipo notificado del cambio

---

**Estado:** ⏳ **Pendiente de ejecución**  
**Última actualización:** 2026-02-18
