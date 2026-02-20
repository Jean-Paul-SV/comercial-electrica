# Guía: Migración Plan Render (Free → Starter)

**Prioridad:** 🔴 **CRÍTICO**  
**Tiempo estimado:** 30 minutos  
**Riesgo:** Bajo (solo cambio de plan, sin migración de datos)

---

## ⚠️ Por qué es crítico

El plan **free** de Render tiene limitaciones que hacen inviable producción:

- ❌ **Sin SLA garantizado** (puede caer sin aviso)
- ❌ **Sin escalado automático** (no responde a carga)
- ❌ **Posible suspensión por inactividad** (pierdes clientes)
- ❌ **Sin redundancia** (single point of failure)

**Impacto:** Con 50+ clientes activos, una caída puede causar churn del 30-50%.

---

## 📋 Pasos de Migración

### Paso 1: Acceder a Render Dashboard

1. Entra a [https://dashboard.render.com](https://dashboard.render.com)
2. Inicia sesión con tu cuenta
3. Selecciona el servicio de la **API** (no el frontend ni la BD)

---

### Paso 2: Cambiar Plan

1. En el servicio de la API, ve a **Settings** (configuración)
2. Busca la sección **Plan**
3. Selecciona **Starter** ($7/mes)
4. Revisa los cambios:
   - **CPU:** 0.5 CPU compartido → 0.5 CPU dedicado
   - **RAM:** 512 MB → 512 MB (igual)
   - **SLA:** Sin garantía → 99.95% uptime
   - **Escalado:** Manual → Automático bajo carga
   - **Redundancia:** No → Sí (backup automático)

5. Confirma el cambio

---

### Paso 3: Verificar Migración

1. Render reiniciará el servicio automáticamente
2. Espera 2-3 minutos después del reinicio
3. Verifica que el servicio está funcionando:

```bash
curl https://TU-API.onrender.com/health
```

Debe devolver:
```json
{
  "status": "ok",
  "services": {
    "database": { "status": "connected" },
    "redis": { "status": "connected" }
  }
}
```

---

### Paso 4: Actualizar render.yaml (Opcional)

Si quieres que futuros deploys usen Starter por defecto:

```yaml
services:
  - type: web
    name: comercial-electrica-api
    plan: starter  # Cambiar de "free" a "starter"
    # ... resto de configuración
```

**Nota:** Esto solo afecta nuevos deploys. El cambio manual en Dashboard es suficiente.

---

## ✅ Verificación Post-Migración

### Checklist

- [ ] Plan cambiado a Starter en Dashboard
- [ ] Servicio reiniciado correctamente
- [ ] Health check devuelve OK
- [ ] Logs muestran inicio exitoso
- [ ] No hay errores en logs
- [ ] Monitoreo externo (si configurado) muestra servicio UP

---

## 💰 Costos

| Plan | Costo Mensual | Características |
|------|---------------|-----------------|
| **Free** | $0 | Sin SLA, sin escalado, riesgo de suspensión |
| **Starter** | $7 | SLA 99.95%, escalado automático, redundancia |

**ROI:** $7/mes es mínimo comparado con riesgo de perder clientes por caídas.

---

## 🚨 Troubleshooting

### Error: "Service not found"

**Causa:** Estás en el servicio incorrecto (frontend o BD en lugar de API).

**Solución:** Asegúrate de estar en el servicio **API** (web service).

---

### Error: "Payment method required"

**Causa:** Render requiere método de pago para planes de pago.

**Solución:**
1. Ve a **Account Settings** → **Billing**
2. Añade tarjeta de crédito o PayPal
3. Vuelve a intentar cambiar el plan

---

### Servicio no inicia después del cambio

**Causa:** Puede haber un error en el código o configuración.

**Solución:**
1. Revisa logs en Render Dashboard → Logs
2. Verifica que todas las variables de entorno están configuradas
3. Verifica que la BD está accesible
4. Si persiste, contacta soporte de Render

---

## 📊 Monitoreo Post-Migración

### Primera semana

- Revisa logs diariamente
- Verifica que no hay errores nuevos
- Monitorea tiempo de respuesta (debe mejorar)
- Verifica que escalado automático funciona (si hay carga)

### Métricas a observar

- **Uptime:** Debe ser >99.5%
- **Tiempo de respuesta:** Debe ser estable (<500ms p95)
- **Errores:** Debe ser <0.1%

---

## 🎯 Próximos Pasos

Después de migrar a Starter:

1. **Configurar monitoreo externo** (UptimeRobot) - Ver `docs/GUIA_MONITOREO_EXTERNO.md`
2. **Ejecutar pruebas de carga** - Ver `docs/GUIA_PRUEBAS_CARGA.md`
3. **Considerar plan Professional** cuando tengas 100+ clientes ($25/mes, mejor performance)

---

**Última actualización:** Febrero 2026  
**Tiempo total:** 30 minutos  
**Dificultad:** Baja
