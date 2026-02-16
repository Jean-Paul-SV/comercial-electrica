# 🔧 Guía de Troubleshooting

**Fecha:** 2026-02-16  
**Propósito:** Guía rápida para resolver problemas comunes en producción

---

## 📋 Índice

1. [Errores Comunes](#errores-comunes)
2. [Lectura de Logs](#lectura-de-logs)
3. [Verificación de Conectividad](#verificación-de-conectividad)
4. [Problemas de Base de Datos](#problemas-de-base-de-datos)
5. [Problemas de Redis](#problemas-de-redis)
6. [Problemas de Stripe](#problemas-de-stripe)
7. [Problemas de DIAN](#problemas-de-dian)
8. [Problemas de Performance](#problemas-de-performance)
9. [Problemas Multi-Tenant](#problemas-multi-tenant)

---

## 🚨 Errores Comunes

### Error 500 - Internal Server Error

**Síntomas:**
- Respuesta HTTP 500 en cualquier endpoint
- Logs muestran excepciones no capturadas

**Diagnóstico:**
```bash
# Ver logs estructurados
tail -f logs/app.log | jq

# Ver logs en formato texto
tail -f logs/app.log

# Buscar errores recientes
grep -i error logs/app.log | tail -20
```

**Soluciones comunes:**

1. **Error de conexión a base de datos:**
   ```bash
   # Verificar que PostgreSQL está corriendo
   docker ps | grep postgres
   
   # Verificar conexión
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Error de conexión a Redis:**
   ```bash
   # Verificar que Redis está corriendo
   docker ps | grep redis
   
   # Verificar conexión
   redis-cli -h localhost -p 6379 ping
   ```

3. **Error de validación de variables de entorno:**
   ```bash
   # Verificar que todas las variables requeridas están configuradas
   node -e "require('dotenv').config(); console.log(process.env.JWT_ACCESS_SECRET ? 'OK' : 'MISSING')"
   ```

---

### Error 401 - Unauthorized

**Síntomas:**
- Respuesta HTTP 401 en endpoints protegidos
- Mensaje: "Unauthorized" o "Token inválido"

**Diagnóstico:**
```bash
# Verificar que el token JWT es válido
# Usar jwt.io para decodificar el token manualmente
```

**Soluciones:**

1. **Token expirado:**
   - El token JWT tiene expiración (default: 18 horas)
   - Solución: Hacer login nuevamente

2. **Token inválido:**
   - Verificar que el header `Authorization: Bearer <token>` está presente
   - Verificar que `JWT_ACCESS_SECRET` coincide entre servicios

3. **Usuario inactivo:**
   - Verificar que el usuario está activo en la base de datos
   ```sql
   SELECT id, email, "isActive" FROM "User" WHERE email = 'usuario@example.com';
   ```

---

### Error 403 - Forbidden

**Síntomas:**
- Respuesta HTTP 403 en endpoints protegidos
- Mensaje: "No tienes permisos" o "Módulo no habilitado"

**Diagnóstico:**
```bash
# Verificar permisos del usuario
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/auth/me | jq .permissions

# Verificar módulos del tenant
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/auth/me | jq .modules
```

**Soluciones:**

1. **Falta de permisos:**
   - Asignar permisos necesarios al rol del usuario
   - Verificar que el usuario tiene el rol correcto

2. **Módulo no habilitado:**
   - Verificar que el módulo está activo en el plan del tenant
   - Activar el módulo en la configuración del tenant

---

### Error 429 - Too Many Requests

**Síntomas:**
- Respuesta HTTP 429 después de múltiples requests
- Mensaje: "Too Many Requests"

**Diagnóstico:**
```bash
# Verificar límites de rate limiting
# Ver logs para ver qué límite se excedió
```

**Soluciones:**

1. **Rate limit global excedido:**
   - Esperar 1 minuto antes de continuar
   - Reducir frecuencia de requests

2. **Rate limit por plan excedido:**
   - Verificar límites del plan del tenant
   - Considerar upgrade de plan si es necesario

---

### Error 400 - Bad Request

**Síntomas:**
- Respuesta HTTP 400 con mensaje de validación
- Datos de entrada inválidos

**Diagnóstico:**
```bash
# El mensaje de error contiene detalles de la validación
# Verificar el body del request contra el DTO esperado
```

**Soluciones:**

1. **Validación de DTO:**
   - Verificar que todos los campos requeridos están presentes
   - Verificar tipos de datos (string, number, etc.)
   - Verificar formatos (email, fecha, etc.)

2. **Límites de negocio:**
   - Verificar que no se exceden límites (cantidad, monto, etc.)
   - Ver mensaje de error para límite específico

---

## 📝 Lectura de Logs

### Logs Estructurados (JSON)

**Formato:**
```json
{
  "timestamp": "2026-02-16T10:30:00.000Z",
  "level": "error",
  "context": "SalesService",
  "message": "Stock insuficiente",
  "requestId": "abc-123-def",
  "tenantId": "tenant-123",
  "userId": "user-456"
}
```

**Comandos útiles:**
```bash
# Ver errores recientes
cat logs/app.log | jq 'select(.level == "error")' | tail -20

# Ver logs de un request específico
cat logs/app.log | jq 'select(.requestId == "abc-123-def")'

# Ver logs de un tenant específico
cat logs/app.log | jq 'select(.tenantId == "tenant-123")'

# Ver logs de un servicio específico
cat logs/app.log | jq 'select(.context == "SalesService")'
```

### Logs de Texto

**Formato:**
```
[2026-02-16 10:30:00] ERROR [SalesService] Stock insuficiente - RequestId: abc-123-def
```

**Comandos útiles:**
```bash
# Ver errores recientes
tail -f logs/app.log | grep ERROR

# Buscar por texto
grep "Stock insuficiente" logs/app.log

# Ver logs de un rango de tiempo
grep "2026-02-16 10:" logs/app.log
```

---

## 🔌 Verificación de Conectividad

### Base de Datos (PostgreSQL)

**Verificar conexión:**
```bash
# Conectar directamente
psql $DATABASE_URL -c "SELECT version();"

# Verificar conexiones activas
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Verificar pool de conexiones
psql $DATABASE_URL -c "SHOW max_connections;"
```

**Problemas comunes:**

1. **Conexión rechazada:**
   ```bash
   # Verificar que PostgreSQL está corriendo
   docker ps | grep postgres
   
   # Verificar puerto
   netstat -tuln | grep 5432
   ```

2. **Autenticación fallida:**
   - Verificar `DATABASE_URL` en `.env`
   - Verificar credenciales en PostgreSQL

3. **Base de datos no existe:**
   ```bash
   # Crear base de datos si no existe
   createdb nombre_db
   ```

---

### Redis

**Verificar conexión:**
```bash
# Ping a Redis
redis-cli -h localhost -p 6379 ping

# Ver información del servidor
redis-cli INFO

# Ver claves activas
redis-cli KEYS "*"
```

**Problemas comunes:**

1. **Conexión rechazada:**
   ```bash
   # Verificar que Redis está corriendo
   docker ps | grep redis
   
   # Verificar puerto
   netstat -tuln | grep 6379
   ```

2. **Memoria agotada:**
   ```bash
   # Ver uso de memoria
   redis-cli INFO memory
   
   # Limpiar caché si es necesario
   redis-cli FLUSHDB
   ```

---

### Stripe

**Verificar configuración:**
```bash
# Verificar que STRIPE_SECRET_KEY está configurado
echo $STRIPE_SECRET_KEY | cut -c1-10

# Verificar webhook endpoint
curl -X GET https://api.stripe.com/v1/webhook_endpoints \
  -u $STRIPE_SECRET_KEY:
```

**Problemas comunes:**

1. **Webhook no recibido:**
   - Verificar que el endpoint está configurado en Stripe Dashboard
   - Verificar que el servidor es accesible desde internet
   - Verificar logs del servidor para requests de Stripe

2. **Firma de webhook inválida:**
   - Verificar que `STRIPE_WEBHOOK_SECRET` coincide con el de Stripe
   - Verificar que el raw body se está usando para verificación

---

### DIAN

**Verificar configuración:**
```bash
# Verificar certificado DIAN
ls -la storage/dian/certificates/

# Verificar configuración en base de datos
psql $DATABASE_URL -c "SELECT * FROM \"DianConfig\" WHERE \"tenantId\" = 'tenant-id';"
```

**Problemas comunes:**

1. **Certificado expirado:**
   - Renovar certificado DIAN
   - Actualizar en configuración del tenant

2. **Error de firma:**
   - Verificar que el certificado es válido
   - Verificar que `DIAN_CERT_ENCRYPTION_KEY` es correcto

---

## 🗄️ Problemas de Base de Datos

### Conexiones Agotadas

**Síntomas:**
- Error: "too many connections"
- Aplicación lenta o sin respuesta

**Diagnóstico:**
```sql
-- Ver conexiones activas
SELECT count(*) FROM pg_stat_activity;

-- Ver conexiones por base de datos
SELECT datname, count(*) 
FROM pg_stat_activity 
GROUP BY datname;
```

**Solución:**
```bash
# Aumentar max_connections en PostgreSQL
# O configurar connection pooling en DATABASE_URL
# Ejemplo: postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20
```

---

### Queries Lentas

**Diagnóstico:**
```sql
-- Ver queries activas y su duración
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY duration DESC;

-- Ver queries más lentas en el historial
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

**Solución:**
- Agregar índices según `docs/OPTIMIZACION_QUERIES.md`
- Optimizar queries según documentación
- Usar EXPLAIN ANALYZE para identificar problemas

---

## 🔴 Problemas de Redis

### Memoria Agotada

**Síntomas:**
- Errores al escribir en Redis
- Caché no funciona

**Diagnóstico:**
```bash
# Ver uso de memoria
redis-cli INFO memory

# Ver claves más grandes
redis-cli --bigkeys
```

**Solución:**
```bash
# Limpiar caché si es necesario
redis-cli FLUSHDB

# O aumentar memoria de Redis
# En docker-compose.yml: mem_limit: 512m
```

---

## ⚡ Problemas de Performance

### Latencia Alta

**Diagnóstico:**
```bash
# Ver métricas de latencia
curl http://localhost:3000/metrics | grep latency

# Ver logs de requests lentos
cat logs/app.log | jq 'select(.duration > 2000)'
```

**Soluciones:**

1. **Queries lentas:**
   - Ver sección "Problemas de Base de Datos"
   - Agregar índices según documentación

2. **Caché no funcionando:**
   - Verificar que Redis está conectado
   - Verificar TTL de caché

3. **Rate limiting muy restrictivo:**
   - Ajustar límites según necesidad
   - Verificar límites por plan

---

## 🏢 Problemas Multi-Tenant

### Aislamiento de Datos

**Verificar aislamiento:**
```sql
-- Verificar que todos los recursos tienen tenantId
SELECT 
  'Sale' as table_name,
  count(*) as total,
  count("tenantId") as with_tenant,
  count(*) - count("tenantId") as missing_tenant
FROM "Sale"
UNION ALL
SELECT 'Product', count(*), count("tenantId"), count(*) - count("tenantId") FROM "Product"
UNION ALL
SELECT 'Customer', count(*), count("tenantId"), count(*) - count("tenantId") FROM "Customer";
```

**Problemas comunes:**

1. **Datos sin tenantId:**
   - Migrar datos existentes
   - Agregar validación en creación

2. **Tenant A ve datos de Tenant B:**
   - Verificar que los guards están aplicados
   - Verificar que los servicios filtran por tenantId

---

## 📞 Contacto y Soporte

### Información Necesaria para Reportar Problemas

1. **Request ID:** Incluido en headers de respuesta (`X-Request-Id`)
2. **Timestamp:** Hora exacta del problema
3. **Tenant ID:** Si aplica
4. **Usuario:** Email del usuario afectado
5. **Endpoint:** URL y método HTTP
6. **Body:** Si aplica (sin datos sensibles)
7. **Logs:** Logs relevantes del servidor

### Comandos Útiles para Recopilar Información

```bash
# Información del sistema
curl http://localhost:3000/health | jq

# Métricas actuales
curl http://localhost:3000/metrics | jq

# Logs recientes
tail -100 logs/app.log | jq

# Estado de servicios
docker ps
docker-compose ps
```

---

**Última actualización:** 2026-02-16
