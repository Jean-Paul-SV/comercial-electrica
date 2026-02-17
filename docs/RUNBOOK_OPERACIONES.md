# 📘 Runbook de Operaciones

**Última actualización:** 2026-02-16  
**Propósito:** Guía rápida para operaciones comunes en producción.

---

## 🔍 Verificación de Salud del Sistema

### Health Check Básico

```bash
# Verificar que la API responde
curl https://tu-dominio.com/health

# Respuesta esperada:
# {
#   "status": "ok",
#   "services": {
#     "database": "connected",
#     "redis": "connected",
#     "queues": { "dian": {...}, "backup": {...}, "reports": {...} }
#   }
# }
```

**Si `status !== "ok"`:**
1. Revisar logs de la API (`GET /metrics` si está disponible)
2. Verificar conectividad a PostgreSQL y Redis
3. Comprobar estado del proveedor (Render, VPS, etc.)

---

## 🔄 Despliegue

### Checklist Pre-Despliegue

- [ ] Migraciones aplicadas (`npx prisma migrate status`)
- [ ] **Variables de entorno obligatorias** (la API no arranca si faltan):
  - [ ] `DATABASE_URL` — conexión a PostgreSQL
  - [ ] `JWT_ACCESS_SECRET` — firma de tokens
  - [ ] `STRIPE_WEBHOOK_SECRET` — si usas Stripe en producción (obligatorio cuando `STRIPE_SECRET_KEY` está definido)
- [ ] Resto de variables: `ALLOWED_ORIGINS`, Redis, DIAN, etc., según entorno
- [ ] Backup reciente verificado

### Comprobar variables antes de desplegar

La API valida al arranque que existan las variables críticas (`ConfigValidationModule`). Para comprobar en local o en el servidor:

```bash
# Debe existir
echo $DATABASE_URL
echo $JWT_ACCESS_SECRET

# Si usas Stripe en producción, también:
echo $STRIPE_WEBHOOK_SECRET
```

Si falta alguna obligatoria, la API falla al iniciar con un mensaje explícito (ej. "Falta variable de entorno requerida: DATABASE_URL").

### Pasos de Despliegue

1. **Aplicar migraciones:**
   ```bash
   cd apps/api
   npx prisma migrate deploy
   ```

2. **Verificar health check:**
   ```bash
   curl https://tu-dominio.com/health
   ```

3. **Verificar métricas (si está disponible):**
   ```bash
   curl -H "Authorization: Bearer <token>" https://tu-dominio.com/metrics
   ```

### Rollback

Si el despliegue falla:

1. **Revertir código** (git revert o redeploy versión anterior)
2. **Revertir migraciones** (si aplica):
   ```bash
   # Solo si la migración causó problemas
   npx prisma migrate resolve --rolled-back <migration_name>
   ```
3. **Verificar health check** después del rollback

---

## 💾 Backups y Restauración

### Crear Backup Manual

```bash
# Via API (requiere autenticación)
curl -X POST https://tu-dominio.com/backups \
  -H "Authorization: Bearer <token>"

# O directamente con pg_dump
pg_dump -h <host> -U <user> -d <database> -F c -f backup-$(date +%Y%m%d).dump
```

### Restaurar Backup

```bash
# Restaurar desde archivo .dump
pg_restore -h <host> -U <user> -d <database> -c backup-20260216.dump

# Verificar integridad
psql -h <host> -U <user> -d <database> -c "SELECT COUNT(*) FROM \"User\";"
```

### Verificar Backups

```bash
# Listar backups disponibles
curl -H "Authorization: Bearer <token>" https://tu-dominio.com/backups

# Verificar checksum de un backup
curl -H "Authorization: Bearer <token>" https://tu-dominio.com/backups/<id>/verify
```

---

## 🐛 Troubleshooting

### La API no responde (502/503)

1. **Verificar logs del servidor** (Render Dashboard, CloudWatch, etc.)
2. **Verificar health check:**
   ```bash
   curl https://tu-dominio.com/health
   ```
3. **Verificar recursos:**
   - Memoria disponible
   - CPU usage
   - Conexiones a BD (no exceder `connection_limit`)
4. **Reiniciar servicio** si es necesario

### Errores de Base de Datos

**Error: "too many connections"**
- Reducir `connection_limit` en `DATABASE_URL`
- Verificar que no hay conexiones huérfanas
- Escalar base de datos si es necesario

**Error: "relation does not exist"**
- Verificar que las migraciones están aplicadas: `npx prisma migrate status`
- Aplicar migraciones pendientes: `npx prisma migrate deploy`

### Errores de Redis

**Error: "Connection refused"**
- Verificar `REDIS_URL` en variables de entorno
- Verificar que Redis está corriendo (Upstash dashboard, etc.)
- Verificar firewall/red

### Webhooks Stripe No Procesados

1. **Verificar eventos en Stripe Dashboard:**
   - Ir a Stripe Dashboard → Developers → Events
   - Buscar eventos con estado "failed"

2. **Verificar cola de reintentos:**
   ```bash
   # Si tienes acceso a Redis/BullMQ dashboard
   # Ver jobs en cola 'stripe-webhooks'
   ```

3. **Reprocesar manualmente** (si es necesario):
   - Usar Stripe CLI para reenviar eventos
   - O esperar reintento automático (3 intentos con backoff)

### Facturas DIAN No Se Envían

1. **Verificar configuración DIAN del tenant:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://tu-dominio.com/dian/config-status
   ```

2. **Verificar certificado:**
   - Certificado no vencido
   - Certificado corresponde al NIT del tenant
   - Contraseña correcta

3. **Verificar cola DIAN:**
   - Ver jobs en cola 'dian' (BullMQ dashboard)
   - Revisar logs de errores

4. **Modo contingencia:**
   - Si `DIAN_CONTINGENCY_MODE=true`, los documentos no se envían
   - Desactivar para envío real

---

## 📊 Monitoreo

### Métricas Básicas

```bash
# Métricas en JSON
curl -H "Authorization: Bearer <token>" https://tu-dominio.com/metrics

# Métricas Prometheus
curl -H "Authorization: Bearer <token>" https://tu-dominio.com/metrics/prometheus
```

### Alertas Recomendadas

Configurar alertas para:

1. **Health check fallido** (> 1 min sin respuesta 200)
2. **Tasa de errores 5xx** (> 1% en 5 minutos)
3. **Latencia alta** (p95 > 2s sostenida)
4. **Colas con muchos fallos** (> 10 jobs failed sin reintento)
5. **Backup fallido** (si `AUTO_BACKUP_ENABLED=true`)

---

## 🔐 Seguridad

### Rotar Secretos

**JWT Secrets:**
1. Generar nuevos secrets:
   ```bash
   openssl rand -base64 32  # Para JWT_ACCESS_SECRET
   openssl rand -base64 32  # Para JWT_REFRESH_SECRET
   ```
2. Actualizar en variables de entorno
3. **Nota:** Los usuarios actuales necesitarán re-login (tokens antiguos invalidados)

**DIAN Certificado:**
- Rotar cuando expire (alertas automáticas a 30 días)
- Subir nuevo certificado en UI: Cuenta → Facturación electrónica

**Stripe Webhook Secret:**
- Rotar desde Stripe Dashboard → Developers → Webhooks
- Actualizar `STRIPE_WEBHOOK_SECRET` en variables de entorno

### Verificar Aislamiento Multi-Tenant

```sql
-- Verificar que no hay registros sin tenantId en tablas multi-tenant
SELECT COUNT(*) FROM "Product" WHERE "tenantId" IS NULL;
SELECT COUNT(*) FROM "Sale" WHERE "tenantId" IS NULL;
SELECT COUNT(*) FROM "Customer" WHERE "tenantId" IS NULL;
-- Debe ser 0 en producción
```

---

## 📈 Escalado

### Escalar Horizontalmente

1. **Configurar load balancer** apuntando a múltiples instancias
2. **Redis compartido** (todos los workers usan el mismo Redis)
3. **Base de datos compartida** (PostgreSQL con connection pooling)
4. **Verificar health checks** en todas las instancias

### Escalar Base de Datos

1. **Aumentar `connection_limit`** en `DATABASE_URL` según capacidad
2. **Monitorear conexiones activas:**
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'comercial_electrica';
   ```
3. **Escalar plan de BD** si es necesario (Render, RDS, etc.)

---

## 🆘 Contacto y Soporte

- **Logs:** Revisar logs del servidor (Render Dashboard, CloudWatch, etc.)
- **Métricas:** `GET /metrics` (requiere autenticación)
- **Health:** `GET /health` (público)

---

**Nota:** Este runbook es un punto de partida. Actualizar según experiencia operacional.
