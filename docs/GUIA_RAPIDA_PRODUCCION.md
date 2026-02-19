# ⚡ Guía Rápida para Producción

**Para cuando necesites desplegar o resolver problemas rápidamente.**

---

## 🚀 Desplegar (5 minutos)

### 1. Verificar Pre-Despliegue
```bash
node scripts/verificar-pre-despliegue.js
```

### 2. Desplegar
- **Render:** Push a `main` → Despliegue automático
- **Railway:** Push a `main` → Despliegue automático
- **VPS:** `git pull && npm run build && pm2 restart`

### 3. Verificar
```bash
curl https://tu-api.com/health
# Debe devolver: {"status":"ok",...}
```

---

## 🔍 Verificar Estado del Sistema

```bash
# Health check
curl https://tu-api.com/health

# Ver logs (Render)
render logs --service tu-api

# Ver logs (Railway)
railway logs

# Ver logs (VPS)
pm2 logs tu-api
```

---

## 🚨 Problemas Comunes (Soluciones Rápidas)

### API no responde
1. Verificar health check: `curl https://tu-api.com/health`
2. Revisar logs: Buscar errores recientes
3. Verificar BD: `psql $DATABASE_URL -c "SELECT 1;"`
4. Si falla: Rollback inmediato

### Base de datos desconectada
1. Verificar `DATABASE_URL` en variables de entorno
2. Verificar credenciales
3. Verificar que la BD está corriendo (Render/Railway dashboard)
4. Reiniciar API

### Backups fallando
1. Verificar espacio en disco: `df -h`
2. Verificar permisos del directorio `BACKUP_DIR`
3. Ver logs: `grep -i "backup" logs.txt`
4. Limpiar backups antiguos si falta espacio

### Stripe webhooks no funcionan
1. Verificar `STRIPE_WEBHOOK_SECRET` configurado
2. Verificar URL en Stripe Dashboard: `https://tu-api.com/billing/webhooks/stripe`
3. Ver eventos en Stripe Dashboard → Webhooks
4. Reenviar eventos fallidos

---

## 📧 Configurar Alertas (Una Vez)

### Variables de Entorno Requeridas

```env
# Habilitar alertas
ALERTS_ENABLED=true

# Email para alertas críticas
ALERT_EMAIL=admin@tudominio.com

# SMTP (ya debe estar configurado)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@tudominio.com
SMTP_PASS=tu-password
SMTP_FROM=Orion <noreply@tudominio.com>

# Slack (opcional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Webhook externo (opcional)
ALERT_WEBHOOK_URL=https://api.tu-sistema.com/webhooks/alerts
```

### Probar Alertas

```bash
# Endpoint de prueba (requiere JWT + metrics:read)
curl -H "Authorization: Bearer $TOKEN" \
  https://tu-api.com/metrics/test-alert
```

---

## 📚 Documentación Completa

- **Operaciones:** [`RUNBOOK_OPERACIONES_COMPLETO.md`](./RUNBOOK_OPERACIONES_COMPLETO.md)
- **Problemas:** [`TROUBLESHOOTING_COMPLETO.md`](./TROUBLESHOOTING_COMPLETO.md)
- **Despliegue:** [`PROCEDIMIENTO_DESPLIEGUE.md`](./PROCEDIMIENTO_DESPLIEGUE.md)
- **Resumen:** [`RESUMEN_IMPLEMENTACION_PRODUCCION.md`](./RESUMEN_IMPLEMENTACION_PRODUCCION.md)

---

## ✅ Checklist Diario (2 minutos)

- [ ] Health check OK: `curl https://tu-api.com/health`
- [ ] Sin alertas en email/Slack
- [ ] Sin errores 5xx en logs recientes
- [ ] Backups ejecutándose (verificar logs)

---

**Última actualización:** 2026-02-19
