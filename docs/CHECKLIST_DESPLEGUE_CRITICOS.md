# Checklist de Despliegue: Críticos Implementados

**Fecha:** Febrero 2026  
**Objetivo:** Desplegar las mejoras críticas implementadas a producción

---

## ⚠️ IMPORTANTE: Antes de empezar

- [ ] **Backup completo de BD:** Hacer backup antes de ejecutar migraciones
- [ ] **Ventana de mantenimiento:** Ejecutar en horario de bajo tráfico si es posible
- [ ] **Revisar logs:** Tener acceso a logs de producción para monitorear

---

## Paso 1: Migración de Base de Datos

### 1.1 Preparar migración

- [ ] Verificar que la migración existe:
  ```bash
  ls apps/api/prisma/migrations/20260220000000_add_stripe_sync_fields/
  ```

- [ ] Revisar el contenido de la migración:
  ```bash
  cat apps/api/prisma/migrations/20260220000000_add_stripe_sync_fields/migration.sql
  ```

### 1.2 Ejecutar migración en producción

**Opción A: Desde Render (recomendado)**
- [ ] Render ejecutará la migración automáticamente en el próximo deploy
- [ ] O ejecutar manualmente desde Shell de Render:
  ```bash
  cd apps/api
  npx prisma migrate deploy
  ```

**Opción B: Desde tu máquina (si tienes acceso directo)**
- [ ] Conectar a BD de producción:
  ```bash
  cd apps/api
  DATABASE_URL="postgresql://..." npx prisma migrate deploy
  ```

- [ ] Verificar que la migración se aplicó:
  ```sql
  -- Ejecutar en BD de producción
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'Subscription' 
  AND column_name IN ('needsStripeSync', 'stripeSyncError');
  ```

### 1.3 Verificar índices

- [ ] Verificar que el índice se creó:
  ```sql
  SELECT indexname 
  FROM pg_indexes 
  WHERE tablename = 'Subscription' 
  AND indexname = 'Subscription_needsStripeSync_idx';
  ```

---

## Paso 2: Migrar Plan de Render

### 2.1 Acceder a Render

- [ ] Entrar a [https://dashboard.render.com](https://dashboard.render.com)
- [ ] Abrir el servicio de la **API** (no el frontend)

### 2.2 Cambiar plan

- [ ] Ir a **Settings** → **Plan**
- [ ] Seleccionar **Starter** ($7/mes)
- [ ] Confirmar cambio
- [ ] Esperar a que Render reinicie el servicio

### 2.3 Verificar que funciona

- [ ] Esperar 2-3 minutos después del reinicio
- [ ] Verificar health check:
  ```bash
  curl https://TU-API.onrender.com/health
  ```
- [ ] Debe devolver `"status":"ok"`

---

## Paso 3: Configurar Variables de Entorno

### 3.1 Variables opcionales (recomendadas)

En Render Dashboard → Environment, añadir:

- [ ] `DIAN_CERT_ALERT_DAYS_BEFORE=30` (días antes de vencer para alertar)
- [ ] `PLAN_LIMITS_ALERT_AFTER_DAYS=7` (días después de exceder límite)
- [ ] `DIAN_RECONCILIATION_MIN_HOURS=1` (horas antes de reconciliar)

### 3.2 Variables críticas (verificar que existen)

- [ ] `ALERTS_ENABLED=true` (debe estar en `true`)
- [ ] `ALERT_EMAIL=tu-email@ejemplo.com` (tu email para alertas)
- [ ] `STRIPE_SECRET_KEY=sk_live_...` (clave de producción)
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...` (secret del webhook)
- [ ] `DIAN_CERT_ENCRYPTION_KEY=...` (clave de cifrado)

### 3.3 Guardar y redeploy

- [ ] Guardar cambios en Render
- [ ] Si Render pregunta, confirmar **Redeploy**
- [ ] Esperar a que el servicio se reinicie

---

## Paso 4: Verificar Despliegue

### 4.1 Health check

- [ ] Ejecutar:
  ```bash
  curl https://TU-API.onrender.com/health
  ```
- [ ] Verificar que devuelve `"status":"ok"`
- [ ] Verificar que `services.database.status` es `"connected"`
- [ ] Verificar que `services.redis.status` es `"connected"`

### 4.2 Verificar logs de inicio

En Render Dashboard → Logs, buscar:

- [ ] Mensaje: "Nest application successfully started"
- [ ] NO debe haber errores de migración
- [ ] NO debe haber errores de módulos faltantes

### 4.3 Verificar que los schedulers están activos

Esperar al menos 10 minutos y revisar logs para verificar que se ejecutan:

- [ ] **Health Monitor** (cada 5 min): Buscar "Health check" en logs
- [ ] **Stripe Reconciliation** (cada 6h): Buscar "Reconciliación de suscripciones Stripe"
- [ ] **Plan Limits Monitor** (diario 9:00 AM): Buscar "Verificación de límites"
- [ ] **Dian Cert Monitor** (diario 9:00 AM): Buscar "Verificación de certificados DIAN"
- [ ] **Dian Reconciliation** (diario 10:00 AM): Buscar "Reconciliación de documentos DIAN"

---

## Paso 5: Probar Funcionalidades Nuevas

### 5.1 Probar reconciliación Stripe (manual)

- [ ] Crear una suscripción de prueba en Stripe
- [ ] Modificar manualmente el plan en BD para crear inconsistencia
- [ ] Esperar 6 horas o ejecutar manualmente el scheduler
- [ ] Verificar que se sincroniza correctamente

### 5.2 Probar alertas de límites

- [ ] Crear un tenant de prueba con plan básico (ej. maxUsers=5)
- [ ] Añadir más usuarios de los permitidos
- [ ] Esperar al día siguiente a las 9:00 AM
- [ ] Verificar que llega alerta por email

### 5.3 Probar alertas de certificados DIAN

- [ ] Crear un certificado de prueba con fecha de vencimiento cercana
- [ ] O modificar `certValidUntil` manualmente a fecha cercana
- [ ] Esperar al día siguiente a las 9:00 AM
- [ ] Verificar que llega alerta por email

### 5.4 Probar reconciliación DIAN

- [ ] Crear un documento DIAN en estado SENT
- [ ] Esperar al día siguiente a las 10:00 AM
- [ ] Verificar que se consulta GetStatus y actualiza estado

---

## Paso 6: Monitoreo Post-Despliegue

### 6.1 Primeras 24 horas

- [ ] Revisar logs cada 2-3 horas
- [ ] Verificar que no hay errores críticos
- [ ] Verificar que los schedulers se ejecutan correctamente
- [ ] Verificar que las alertas llegan (si hay eventos)

### 6.2 Primera semana

- [ ] Revisar logs diariamente
- [ ] Verificar métricas de uso
- [ ] Revisar que no hay tenants con `needsStripeSync=true` por más de 24h
- [ ] Verificar que las reconciliaciones funcionan

### 6.3 Primer mes

- [ ] Revisar métricas de alertas
- [ ] Ajustar umbrales si es necesario
- [ ] Documentar cualquier problema encontrado
- [ ] Planificar mejoras según feedback

---

## 🚨 Troubleshooting

### Error: "Migration failed"

**Solución:**
1. Verificar que la BD está accesible
2. Verificar que tienes permisos de escritura
3. Revisar logs de migración para detalles
4. Si falla, hacer rollback manual si es necesario

### Error: "Module not found"

**Solución:**
1. Verificar que el código se desplegó correctamente
2. Verificar que `npm install` se ejecutó
3. Revisar logs de build en Render

### Los schedulers no se ejecutan

**Solución:**
1. Verificar que `@nestjs/schedule` está instalado
2. Verificar que los módulos están importados correctamente
3. Revisar logs de inicio para errores de módulos
4. Verificar que el servicio está corriendo (no suspendido)

### Alertas no llegan

**Solución:**
1. Verificar que `ALERTS_ENABLED=true`
2. Verificar configuración de SMTP (si usas email)
3. Verificar `SLACK_WEBHOOK_URL` (si usas Slack)
4. Revisar logs para errores de envío

---

## ✅ Checklist Final

Antes de considerar el despliegue completo:

- [ ] Migración ejecutada sin errores
- [ ] Plan de Render migrado a Starter
- [ ] Variables de entorno configuradas
- [ ] Health check devuelve OK
- [ ] Logs muestran que los schedulers están activos
- [ ] Pruebas manuales pasan (opcional pero recomendado)
- [ ] Monitoreo configurado para primeras 24 horas

---

**Tiempo estimado total:** 30-60 minutos  
**Downtime esperado:** 2-5 minutos (durante redeploy)
