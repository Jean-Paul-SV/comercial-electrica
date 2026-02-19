# 📘 Runbook Operacional Completo

**Última actualización:** 2026-02-19  
**Propósito:** Guía completa para operar, mantener y resolver problemas del sistema en producción.

---

## 📋 Índice

1. [Monitoreo y Alertas](#monitoreo-y-alertas)
2. [Health Checks](#health-checks)
3. [Restaurar Backups](#restaurar-backups)
4. [Escalar Horizontalmente](#escalar-horizontalmente)
5. [Debuggear Errores 500](#debuggear-errores-500)
6. [Verificar Integridad Multi-Tenant](#verificar-integridad-multi-tenant)
7. [Procedimiento de Despliegue](#procedimiento-de-despliegue)
8. [Rollback](#rollback)
9. [Mantenimiento de Base de Datos](#mantenimiento-de-base-de-datos)
10. [Respuesta a Incidentes](#respuesta-a-incidentes)

---

## 🔔 Monitoreo y Alertas

### Endpoints de Monitoreo

| Endpoint | Propósito | Autenticación |
|----------|-----------|---------------|
| `GET /health` | Estado general del sistema | Público |
| `GET /metrics` | Métricas en JSON | JWT + `metrics:read` |
| `GET /metrics/prometheus` | Métricas Prometheus | JWT + `metrics:read` |

### Configuración de Alertas

El sistema envía alertas automáticas cuando:
- ✅ Base de datos desconectada (crítico)
- ✅ Redis desconectado (degradación)
- ✅ Colas desconectadas o con muchos fallos (degradación)
- ✅ Backups fallidos (crítico)
- ✅ Sistema recuperado después de degradación (info)

**Variables de entorno requeridas:**

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
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Webhook externo (opcional)
ALERT_WEBHOOK_URL=https://api.tu-sistema.com/webhooks/alerts
ALERT_WEBHOOK_SECRET=tu-secret-opcional
```

### Monitoreo Externo Recomendado

Configurar un monitor externo (UptimeRobot, Pingdom, BetterUptime) que:
- Haga petición a `GET /health` cada **1-2 minutos**
- Alerte si:
  - No responde (timeout > 10s)
  - Código ≠ 200
  - `status: "error"` o `status: "degraded"` en la respuesta

---

## 🏥 Health Checks

### Verificar Estado Manualmente

```bash
curl https://tu-api.com/health
```

**Respuesta esperada (OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-19T10:00:00.000Z",
  "uptime": 86400,
  "environment": "production",
  "services": {
    "database": "connected",
    "redis": "connected",
    "queues": {
      "dian": { "status": "connected", "waiting": 0, "active": 0, "failed": 0 },
      "backup": { "status": "connected", "waiting": 0, "active": 0, "failed": 0 },
      "reports": { "status": "connected", "waiting": 0, "active": 0, "failed": 0 }
    },
    "responseTime": "5ms"
  }
}
```

**Respuesta degradada:**
```json
{
  "status": "degraded",
  "services": {
    "database": "connected",
    "redis": "disconnected",  // ⚠️ Problema
    "queues": { ... }
  }
}
```

### Interpretación de Estados

| Estado | Significado | Acción |
|--------|-------------|--------|
| `ok` | Todo funcionando correctamente | Ninguna |
| `degraded` | Servicios auxiliares desconectados (Redis, colas) | Revisar logs, verificar conectividad |
| `error` | Base de datos desconectada | **CRÍTICO** - Verificar DB inmediatamente |

---

## 💾 Restaurar Backups

### Restaurar Backup de Plataforma (pg_dump)

**Requisitos:**
- Acceso SSH al servidor o contenedor Docker
- Archivo `.sql` del backup
- Credenciales de base de datos

**Pasos:**

1. **Conectar a la base de datos:**
```bash
# Obtener DATABASE_URL del entorno
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# O usar variables individuales
export PGHOST=host
export PGPORT=5432
export PGUSER=user
export PGPASSWORD=pass
export PGDATABASE=dbname
```

2. **Restaurar backup:**
```bash
# Si el backup es formato custom (-F c)
pg_restore -d $PGDATABASE -h $PGHOST -U $PGUSER backup-2026-02-19.sql

# Si el backup es formato plain (texto)
psql -d $PGDATABASE -h $PGHOST -U $PGUSER < backup-2026-02-19.sql
```

3. **Verificar restauración:**
```bash
# Verificar que hay datos
psql -d $PGDATABASE -h $PGHOST -U $PGUSER -c "SELECT COUNT(*) FROM \"Tenant\";"
```

### Restaurar Backup de Tenant (CSV)

Los backups de tenant son archivos ZIP con CSVs. No hay restauración automática; el tenant debe importar manualmente desde la UI o usar scripts personalizados.

**Ubicación de backups:**
- Variable `BACKUP_DIR` (default: `./backups` en el servidor)
- O S3 si está configurado (`BACKUP_S3_BUCKET`)

---

## 📈 Escalar Horizontalmente

### Escalar API (Render/Railway/VPS)

**Render:**
1. Ir a Dashboard → Tu servicio API
2. Settings → Plan → Cambiar a plan superior
3. O aumentar "Instance count" si está disponible

**Railway:**
1. Dashboard → Tu servicio
2. Settings → Scale → Aumentar recursos

**VPS propio:**
1. Aumentar recursos del servidor (CPU/RAM)
2. O agregar más instancias detrás de un load balancer
3. Configurar sesiones compartidas (Redis) si aplica

### Escalar Base de Datos

**PostgreSQL:**
- **Vertical:** Aumentar recursos del servidor/instancia
- **Horizontal:** Usar read replicas para queries de lectura

**Render PostgreSQL:**
1. Dashboard → Tu base de datos
2. Settings → Plan → Upgrade

**Verificar conexiones activas:**
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'tu_db';
```

---

## 🐛 Debuggear Errores 500

### 1. Revisar Logs

**Render:**
```bash
# Ver logs en tiempo real
render logs --service tu-api

# O desde el dashboard: Logs → Ver últimas líneas
```

**Railway:**
```bash
railway logs
```

**VPS propio:**
```bash
# Si usas PM2
pm2 logs tu-api

# Si usas systemd
journalctl -u tu-api -f

# Si usas Docker
docker logs -f tu-api-container
```

### 2. Buscar Errores Específicos

**Errores de base de datos:**
```bash
# Buscar en logs
grep -i "database\|prisma\|postgres" logs.txt

# Verificar conexión manualmente
psql $DATABASE_URL -c "SELECT 1;"
```

**Errores de Redis:**
```bash
# Buscar en logs
grep -i "redis\|cache" logs.txt

# Verificar conexión
redis-cli -u $REDIS_URL ping
```

**Errores de Stripe:**
```bash
# Buscar en logs
grep -i "stripe\|webhook" logs.txt

# Verificar webhook en Stripe Dashboard
# Dashboard → Developers → Webhooks → Ver eventos recientes
```

### 3. Verificar Variables de Entorno

```bash
# En el servidor/contenedor
env | grep -E "DATABASE_URL|REDIS_URL|STRIPE|JWT"
```

### 4. Probar Endpoints Críticos

```bash
# Health check
curl https://tu-api.com/health

# Endpoint protegido (con token)
curl -H "Authorization: Bearer $TOKEN" https://tu-api.com/auth/me
```

---

## 🔒 Verificar Integridad Multi-Tenant

### Verificar Aislamiento de Datos

**Query para verificar que no hay datos sin tenantId:**
```sql
-- Verificar usuarios sin tenant (solo platform admin debe estar sin tenant)
SELECT id, email, "tenantId" FROM "User" WHERE "tenantId" IS NULL;

-- Verificar ventas sin tenant (no debería haber)
SELECT COUNT(*) FROM "Sale" WHERE "tenantId" IS NULL;

-- Verificar productos sin tenant (no debería haber)
SELECT COUNT(*) FROM "Product" WHERE "tenantId" IS NULL;
```

### Verificar Permisos

**Verificar que los guards están activos:**
```bash
# Intentar acceder a endpoint protegido sin token
curl https://tu-api.com/sales
# Debe devolver 401

# Intentar acceder con token de otro tenant
curl -H "Authorization: Bearer $TOKEN_TENANT_A" https://tu-api.com/sales
# Luego intentar acceder a datos de Tenant B (debe fallar)
```

---

## 🚀 Procedimiento de Despliegue

### Checklist Pre-Despliegue

- [ ] Todos los tests pasan (`npm run test` en `apps/api`)
- [ ] Build exitoso (`npm run build` en `apps/api`)
- [ ] Migraciones de BD revisadas (`apps/api/prisma/migrations/`)
- [ ] Variables de entorno actualizadas en producción
- [ ] Backup de base de datos reciente
- [ ] Health check funcionando en staging

### Pasos de Despliegue

**Render:**
1. Push a `main` branch → Despliegue automático
2. O manual: Dashboard → Deploy → Deploy latest commit

**Railway:**
1. Push a `main` → Despliegue automático
2. O manual: Dashboard → Deployments → Redeploy

**VPS propio:**
```bash
# 1. Pull cambios
git pull origin main

# 2. Instalar dependencias
npm install

# 3. Aplicar migraciones
cd apps/api
npx prisma migrate deploy

# 4. Generar Prisma Client
npx prisma generate

# 5. Build
npm run build

# 6. Reiniciar servicio
pm2 restart tu-api
# O
systemctl restart tu-api
# O
docker-compose restart api
```

### Verificación Post-Despliegue

1. **Health check:**
```bash
curl https://tu-api.com/health
# Debe devolver status: "ok"
```

2. **Verificar logs:**
```bash
# Buscar errores en los primeros minutos
tail -f logs.txt | grep -i error
```

3. **Probar endpoint crítico:**
```bash
# Login
curl -X POST https://tu-api.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

---

## ⏪ Rollback

### Rollback en Render/Railway

**Render:**
1. Dashboard → Deployments
2. Encontrar deployment anterior que funcionaba
3. Click en "..." → Rollback to this deployment

**Railway:**
1. Dashboard → Deployments
2. Encontrar deployment anterior
3. Click en "Redeploy"

### Rollback Manual (VPS)

```bash
# 1. Revertir código
git revert HEAD
# O
git checkout <commit-anterior>

# 2. Revertir migraciones (si aplica)
cd apps/api
npx prisma migrate resolve --rolled-back <migration-name>

# 3. Rebuild y restart
npm run build
pm2 restart tu-api
```

### Rollback de Base de Datos

**Si la migración causó problemas:**
```bash
# Ver migraciones aplicadas
npx prisma migrate status

# Revertir última migración manualmente
# (solo si conoces el SQL exacto)
psql $DATABASE_URL < rollback-script.sql
```

---

## 🗄️ Mantenimiento de Base de Datos

### Vacuum y Análisis

```sql
-- Vacuum completo (liberar espacio)
VACUUM FULL;

-- Análisis de tablas (actualizar estadísticas)
ANALYZE;

-- Vacuum y análisis de tabla específica
VACUUM ANALYZE "Sale";
```

### Verificar Tamaño de Tablas

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### Limpiar Datos Antiguos

**Ejemplo: Limpiar logs de auditoría antiguos (>1 año):**
```sql
DELETE FROM "AuditLog" 
WHERE "createdAt" < NOW() - INTERVAL '1 year';
```

---

## 🚨 Respuesta a Incidentes

### Incidente: API Caída

1. **Verificar health check:**
```bash
curl https://tu-api.com/health
```

2. **Revisar logs de errores:**
```bash
# Buscar errores recientes
tail -100 logs.txt | grep -i error
```

3. **Verificar servicios:**
   - Base de datos: `psql $DATABASE_URL -c "SELECT 1;"`
   - Redis: `redis-cli -u $REDIS_URL ping`

4. **Acciones:**
   - Si DB desconectada: Verificar credenciales, reiniciar conexión
   - Si Redis desconectado: Reiniciar Redis o continuar sin caché
   - Si código roto: Rollback inmediato

### Incidente: Backups Fallando

1. **Verificar últimos backups:**
```bash
# Ver backups recientes
ls -lh backups/ | tail -10
```

2. **Revisar logs de backups:**
```bash
grep -i "backup" logs.txt | tail -20
```

3. **Verificar espacio en disco:**
```bash
df -h
```

4. **Acciones:**
   - Si falta espacio: Limpiar backups antiguos
   - Si pg_dump falla: Verificar permisos, credenciales DB
   - Si S3 falla: Verificar credenciales AWS

### Incidente: Stripe Webhooks Fallando

1. **Verificar eventos en Stripe Dashboard:**
   - Dashboard → Developers → Webhooks
   - Ver eventos recientes y respuestas

2. **Revisar logs del webhook:**
```bash
grep -i "stripe\|webhook" logs.txt | tail -20
```

3. **Verificar firma del webhook:**
   - Confirmar que `STRIPE_WEBHOOK_SECRET` está configurado correctamente

4. **Reenviar eventos fallidos:**
   - Stripe Dashboard → Webhooks → Eventos → Reenviar

---

## 📞 Contactos y Recursos

- **Documentación API:** `https://tu-api.com/api` (Swagger)
- **Logs:** Render Dashboard / Railway Dashboard / Servidor
- **Base de datos:** Render PostgreSQL / Railway PostgreSQL / Servidor propio
- **Stripe Dashboard:** https://dashboard.stripe.com

---

## ✅ Checklist de Operación Diaria

- [ ] Health check respondiendo OK
- [ ] Sin alertas críticas en email/Slack
- [ ] Backups ejecutándose correctamente
- [ ] Sin errores 5xx en logs recientes
- [ ] Espacio en disco suficiente (>20% libre)
- [ ] Conexiones a DB dentro de límites

---

**Última revisión:** 2026-02-19  
**Próxima revisión:** Mensual o después de cambios significativos
