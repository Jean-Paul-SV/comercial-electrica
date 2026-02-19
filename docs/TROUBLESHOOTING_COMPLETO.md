# 🔧 Guía Completa de Troubleshooting

**Última actualización:** 2026-02-19  
**Propósito:** Resolver problemas comunes del sistema rápidamente.

---

## 📋 Índice

1. [Errores Comunes](#errores-comunes)
2. [Problemas de Base de Datos](#problemas-de-base-de-datos)
3. [Problemas de Redis](#problemas-de-redis)
4. [Problemas de Stripe](#problemas-de-stripe)
5. [Problemas de Backups](#problemas-de-backups)
6. [Problemas de Autenticación](#problemas-de-autenticación)
7. [Problemas de Performance](#problemas-de-performance)
8. [Cómo Leer Logs](#cómo-leer-logs)

---

## ❌ Errores Comunes

### Error: "Database connection failed"

**Síntomas:**
- Health check devuelve `"database": "disconnected"`
- Errores 500 en endpoints que requieren BD
- Logs muestran: `PrismaClientInitializationError`

**Soluciones:**

1. **Verificar variables de entorno:**
```bash
echo $DATABASE_URL
# Debe ser: postgresql://user:pass@host:port/dbname
```

2. **Probar conexión manual:**
```bash
psql $DATABASE_URL -c "SELECT 1;"
```

3. **Verificar que la BD existe:**
```bash
psql $DATABASE_URL -c "\l" | grep tu_database
```

4. **Verificar credenciales:**
   - Usuario correcto
   - Contraseña correcta
   - Host y puerto correctos

5. **Verificar firewall/red:**
   - Si BD está en otro servidor, verificar que el puerto 5432 está abierto
   - Verificar grupos de seguridad (AWS) o firewall

**Si persiste:**
- Reiniciar la API
- Contactar al proveedor de BD (Render, Railway, etc.)

---

### Error: "Redis connection failed"

**Síntomas:**
- Health check devuelve `"redis": "disconnected"`
- Caché no funciona (pero la app sigue funcionando)
- Logs muestran errores de Redis

**Soluciones:**

1. **Verificar variables de entorno:**
```bash
echo $REDIS_URL
# Debe ser: redis://host:port o redis://:password@host:port
```

2. **Probar conexión manual:**
```bash
redis-cli -u $REDIS_URL ping
# Debe responder: PONG
```

3. **Verificar que Redis está corriendo:**
```bash
# Si Redis está en Docker
docker ps | grep redis

# Si Redis está en el servidor
redis-cli ping
```

4. **Si Redis no es crítico:**
   - La app puede funcionar sin Redis (solo sin caché)
   - Considerar continuar sin Redis temporalmente

**Si persiste:**
- Reiniciar Redis
- Verificar espacio en disco (Redis puede fallar si no hay espacio)

---

### Error: "JWT_SECRET not configured"

**Síntomas:**
- API no arranca
- Error al iniciar: `ConfigValidationError`

**Solución:**
```bash
# Agregar en .env o variables de entorno
JWT_ACCESS_SECRET=tu-secret-muy-seguro-minimo-32-caracteres
JWT_REFRESH_SECRET=otro-secret-diferente-minimo-32-caracteres
```

**Generar secrets seguros:**
```bash
# Opción 1: OpenSSL
openssl rand -base64 32

# Opción 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### Error: "Stripe webhook signature verification failed"

**Síntomas:**
- Webhooks de Stripe no se procesan
- Logs muestran: `Stripe signature verification failed`

**Soluciones:**

1. **Verificar `STRIPE_WEBHOOK_SECRET`:**
```bash
echo $STRIPE_WEBHOOK_SECRET
# Debe empezar con: whsec_
```

2. **Obtener secret correcto:**
   - Stripe Dashboard → Developers → Webhooks
   - Click en tu webhook endpoint
   - Copiar "Signing secret"

3. **Verificar que la URL del webhook es correcta:**
   - Debe ser: `https://tu-api.com/billing/webhooks/stripe`
   - Debe ser HTTPS (no HTTP)

4. **Verificar eventos configurados:**
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`

---

## 🗄️ Problemas de Base de Datos

### Error: "Migration failed"

**Síntomas:**
- `npx prisma migrate deploy` falla
- Errores de sintaxis SQL o columnas duplicadas

**Soluciones:**

1. **Ver estado de migraciones:**
```bash
cd apps/api
npx prisma migrate status
```

2. **Ver migraciones aplicadas:**
```sql
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 10;
```

3. **Si una migración falló a mitad:**
   - Revisar el SQL de la migración
   - Ejecutar manualmente las partes que faltan
   - Marcar como aplicada: `npx prisma migrate resolve --applied <migration-name>`

4. **Si necesitas revertir:**
   - Crear nueva migración que revierta los cambios
   - O restaurar desde backup

---

### Error: "Too many connections"

**Síntomas:**
- Errores: `too many connections`
- API lenta o no responde

**Soluciones:**

1. **Ver conexiones activas:**
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'tu_db';
```

2. **Ver conexiones por aplicación:**
```sql
SELECT application_name, count(*) 
FROM pg_stat_activity 
WHERE datname = 'tu_db'
GROUP BY application_name;
```

3. **Cerrar conexiones inactivas:**
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'tu_db'
  AND state = 'idle'
  AND state_change < NOW() - INTERVAL '5 minutes';
```

4. **Aumentar límite de conexiones:**
   - En Render/Railway: Upgrade plan de BD
   - En PostgreSQL propio: Editar `postgresql.conf`: `max_connections = 200`

5. **Optimizar pool de conexiones en Prisma:**
```env
# En DATABASE_URL agregar parámetros
DATABASE_URL="postgresql://user:pass@host:port/db?connection_limit=10&pool_timeout=20"
```

---

### Error: "Table does not exist"

**Síntomas:**
- Errores: `relation "TableName" does not exist`
- Prisma no encuentra tablas

**Soluciones:**

1. **Verificar que las migraciones están aplicadas:**
```bash
npx prisma migrate status
```

2. **Aplicar migraciones pendientes:**
```bash
npx prisma migrate deploy
```

3. **Regenerar Prisma Client:**
```bash
npx prisma generate
```

4. **Verificar esquema:**
```bash
npx prisma db pull  # Sincronizar esquema desde BD
```

---

## 🔴 Problemas de Redis

### Error: "Redis out of memory"

**Síntomas:**
- Redis rechaza escrituras
- Errores: `OOM command not allowed`

**Soluciones:**

1. **Ver uso de memoria:**
```bash
redis-cli -u $REDIS_URL INFO memory
```

2. **Limpiar caché:**
```bash
redis-cli -u $REDIS_URL FLUSHALL
# ⚠️ Esto borra TODO el caché
```

3. **Limpiar solo claves expiradas:**
```bash
redis-cli -u $REDIS_URL --scan --pattern "*" | xargs redis-cli -u $REDIS_URL DEL
```

4. **Aumentar memoria de Redis:**
   - En Render/Railway: Upgrade plan
   - En Redis propio: Editar `redis.conf`: `maxmemory 2gb`

---

## 💳 Problemas de Stripe

### Error: "Stripe subscription not found"

**Síntomas:**
- Cambio de plan falla
- Errores al procesar pagos

**Soluciones:**

1. **Verificar `stripeSubscriptionId` en BD:**
```sql
SELECT id, "stripeSubscriptionId", status 
FROM "Subscription" 
WHERE "stripeSubscriptionId" IS NOT NULL;
```

2. **Verificar en Stripe Dashboard:**
   - Dashboard → Customers → Buscar cliente
   - Ver suscripciones activas

3. **Sincronizar manualmente:**
   - Si la suscripción existe en Stripe pero no en BD:
   - Actualizar `Subscription.stripeSubscriptionId` manualmente

---

### Error: "Stripe webhook not received"

**Síntomas:**
- Pagos en Stripe pero no se procesan en la app
- Suscripciones no se actualizan

**Soluciones:**

1. **Verificar URL del webhook:**
   - Stripe Dashboard → Webhooks
   - Debe ser: `https://tu-api.com/billing/webhooks/stripe`
   - Debe ser HTTPS

2. **Ver eventos recientes:**
   - Stripe Dashboard → Webhooks → Tu endpoint → Eventos
   - Ver si hay eventos fallidos (rojos)

3. **Reenviar eventos:**
   - Click en evento fallido → "Send again"

4. **Verificar logs del webhook:**
```bash
grep -i "stripe\|webhook" logs.txt | tail -20
```

---

## 💾 Problemas de Backups

### Error: "Backup failed: pg_dump not found"

**Síntomas:**
- Backups de plataforma fallan
- Error: `pg_dump: command not found`

**Soluciones:**

1. **Instalar pg_dump:**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Docker (ya incluido en postgres:16-alpine)
```

2. **Verificar que está en PATH:**
```bash
which pg_dump
```

3. **Si está en Docker:**
   - El sistema intenta usar Docker automáticamente
   - Verificar que Docker está disponible: `docker --version`

---

### Error: "Backup failed: Permission denied"

**Síntomas:**
- Backups fallan al escribir archivo
- Error: `EACCES: permission denied`

**Soluciones:**

1. **Verificar permisos del directorio:**
```bash
ls -la backups/
# Debe ser escribible por el usuario de la API
```

2. **Crear directorio si no existe:**
```bash
mkdir -p backups
chmod 755 backups
```

3. **Verificar variable `BACKUP_DIR`:**
```bash
echo $BACKUP_DIR
# Debe apuntar a un directorio escribible
```

---

### Error: "Backup failed: Disk full"

**Síntomas:**
- Backups fallan
- Error: `ENOSPC: no space left on device`

**Soluciones:**

1. **Verificar espacio en disco:**
```bash
df -h
```

2. **Limpiar backups antiguos:**
```bash
# Ver backups
ls -lh backups/

# Eliminar backups antiguos (>30 días)
find backups/ -type f -mtime +30 -delete
```

3. **Configurar S3 para backups:**
```env
BACKUP_S3_BUCKET=tu-bucket
AWS_ACCESS_KEY_ID=tu-key
AWS_SECRET_ACCESS_KEY=tu-secret
AWS_REGION=us-east-1
```

---

## 🔐 Problemas de Autenticación

### Error: "Invalid token" o "Token expired"

**Síntomas:**
- Usuarios no pueden iniciar sesión
- Tokens rechazados

**Soluciones:**

1. **Verificar `JWT_ACCESS_SECRET`:**
```bash
echo $JWT_ACCESS_SECRET
# Debe estar configurado y ser el mismo en todas las instancias
```

2. **Verificar expiración:**
   - Access token: 15 minutos (default)
   - Refresh token: 7 días (default)

3. **Si cambiaste el secret:**
   - Todos los tokens existentes se invalidan
   - Usuarios deben iniciar sesión de nuevo

---

### Error: "User not found" después de login

**Síntomas:**
- Login exitoso pero luego "User not found"
- Token válido pero usuario no existe

**Soluciones:**

1. **Verificar que el usuario existe:**
```sql
SELECT id, email, "tenantId", "isActive" 
FROM "User" 
WHERE email = 'usuario@ejemplo.com';
```

2. **Verificar que el usuario está activo:**
```sql
UPDATE "User" SET "isActive" = true WHERE email = 'usuario@ejemplo.com';
```

3. **Verificar tenant:**
```sql
SELECT id, name, "isActive" FROM "Tenant" WHERE id = 'tenant-id';
```

---

## ⚡ Problemas de Performance

### API Lenta

**Síntomas:**
- Respuestas > 2 segundos
- Timeouts frecuentes

**Soluciones:**

1. **Verificar métricas:**
```bash
curl -H "Authorization: Bearer $TOKEN" https://tu-api.com/metrics
```

2. **Revisar queries lentas:**
   - Si `QUERY_PERFORMANCE_MONITORING=true`:
   - Ver logs para queries > `SLOW_QUERY_THRESHOLD_MS`

3. **Verificar índices en BD:**
```sql
-- Ver índices de una tabla
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Sale';
```

4. **Verificar caché:**
   - Redis debe estar funcionando
   - Verificar que `CACHE_TTL_SECONDS` está configurado

5. **Escalar recursos:**
   - Aumentar CPU/RAM del servidor
   - O agregar más instancias

---

### Base de Datos Lenta

**Síntomas:**
- Queries tardan mucho
- Timeouts en BD

**Soluciones:**

1. **Ver queries activas:**
```sql
SELECT pid, now() - query_start AS duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY duration DESC;
```

2. **Verificar locks:**
```sql
SELECT * FROM pg_locks WHERE NOT granted;
```

3. **Vacuum y análisis:**
```sql
VACUUM ANALYZE;
```

4. **Verificar tamaño de tablas:**
```sql
SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename)) 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

---

## 📝 Cómo Leer Logs

### Formato de Logs

**Desarrollo (texto):**
```
[2026-02-19 10:00:00] [ERROR] [BackupsService] Backup failed: Error message
```

**Producción (JSON si `LOG_FORMAT=json`):**
```json
{
  "timestamp": "2026-02-19T10:00:00.000Z",
  "level": "error",
  "context": "BackupsService",
  "message": "Backup failed: Error message",
  "stack": "..."
}
```

### Buscar Errores Específicos

**Errores de base de datos:**
```bash
grep -i "database\|prisma\|postgres" logs.txt
```

**Errores de autenticación:**
```bash
grep -i "auth\|jwt\|token\|login" logs.txt
```

**Errores de Stripe:**
```bash
grep -i "stripe\|webhook\|payment" logs.txt
```

**Errores 500:**
```bash
grep -i "error\|exception\|500" logs.txt | tail -50
```

### Ver Logs en Tiempo Real

**Render:**
```bash
render logs --service tu-api --tail
```

**Railway:**
```bash
railway logs --tail
```

**VPS:**
```bash
tail -f /var/log/tu-api.log
# O con PM2
pm2 logs tu-api --lines 100
```

---

## 🆘 Si Nada Funciona

1. **Revisar health check:**
```bash
curl https://tu-api.com/health
```

2. **Revisar logs recientes:**
```bash
tail -100 logs.txt
```

3. **Verificar variables de entorno críticas:**
```bash
env | grep -E "DATABASE_URL|REDIS_URL|JWT|STRIPE"
```

4. **Reiniciar la API:**
   - Render/Railway: Redeploy
   - VPS: `pm2 restart` o `systemctl restart`

5. **Rollback si es necesario:**
   - Ver [RUNBOOK_OPERACIONES_COMPLETO.md](./RUNBOOK_OPERACIONES_COMPLETO.md#rollback)

---

**Última actualización:** 2026-02-19
