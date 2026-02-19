# 🚀 Procedimiento de Despliegue

**Última actualización:** 2026-02-19  
**Propósito:** Guía paso a paso para desplegar el sistema a producción de forma segura.

---

## 📋 Checklist Pre-Despliegue

Antes de desplegar, verifica:

- [ ] **Tests pasan:** `npm run test` en `apps/api`
- [ ] **Build exitoso:** `npm run build` en `apps/api`
- [ ] **Migraciones revisadas:** Verificar que no hay migraciones problemáticas
- [ ] **Variables de entorno:** Todas las variables críticas configuradas
- [ ] **Backup reciente:** Backup de base de datos antes de desplegar
- [ ] **Health check OK:** Verificar que staging funciona correctamente
- [ ] **Script de verificación:** Ejecutar `node scripts/verificar-pre-despliegue.js`

---

## 🔧 Ejecutar Verificación Pre-Despliegue

```bash
# Desde la raíz del proyecto
node scripts/verificar-pre-despliegue.js
```

Este script verifica:
- ✅ Variables de entorno críticas
- ✅ Build exitoso
- ✅ Migraciones presentes
- ✅ Prisma Client generado
- ✅ Estructura de archivos
- ✅ Dependencias instaladas
- ✅ Tests pasan

**Si hay errores críticos:** Resolver antes de continuar.  
**Si hay advertencias:** Revisar pero puedes continuar.

---

## 🌐 Despliegue en Render

### Despliegue Automático (Recomendado)

1. **Push a `main` branch:**
```bash
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main
```

2. **Render despliega automáticamente:**
   - Ve a Dashboard → Tu servicio API
   - Verás el nuevo deployment en progreso

3. **Verificar despliegue:**
   - Esperar a que termine (2-5 minutos)
   - Verificar logs: Dashboard → Logs
   - Probar health check: `curl https://tu-api.onrender.com/health`

### Despliegue Manual

1. **Dashboard → Deployments → Deploy latest commit**

2. **O desde CLI:**
```bash
render deploy
```

### Variables de Entorno en Render

1. **Dashboard → Tu servicio → Environment**
2. **Agregar/editar variables:**
   - `DATABASE_URL` (conectada automáticamente si usas Render PostgreSQL)
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `REDIS_URL` (si usas Render Redis)
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `ALERTS_ENABLED=true`
   - `ALERT_EMAIL=admin@tudominio.com`
   - Y todas las demás...

3. **Guardar cambios** → Render reinicia automáticamente

---

## 🚂 Despliegue en Railway

### Despliegue Automático

1. **Push a `main` branch:**
```bash
git push origin main
```

2. **Railway despliega automáticamente**

3. **Verificar:**
   - Dashboard → Deployments → Ver progreso
   - Logs → Ver logs en tiempo real

### Variables de Entorno en Railway

1. **Dashboard → Tu servicio → Variables**
2. **Agregar variables** (mismas que Render)
3. **Guardar** → Railway reinicia automáticamente

---

## 🖥️ Despliegue en VPS Propio

### Opción 1: Con PM2

```bash
# 1. Conectar al servidor
ssh usuario@tu-servidor.com

# 2. Ir al directorio del proyecto
cd /ruta/a/comercial-electrica

# 3. Pull cambios
git pull origin main

# 4. Instalar dependencias (si hay cambios)
cd apps/api
npm install

# 5. Aplicar migraciones
npx prisma migrate deploy

# 6. Generar Prisma Client
npx prisma generate

# 7. Build
npm run build

# 8. Reiniciar con PM2
pm2 restart tu-api
# O si es la primera vez:
# pm2 start dist/main.js --name tu-api
```

### Opción 2: Con Docker

```bash
# 1. Pull cambios
git pull origin main

# 2. Rebuild imagen
docker-compose build api

# 3. Reiniciar contenedor
docker-compose up -d api

# 4. Ver logs
docker-compose logs -f api
```

### Opción 3: Con systemd

```bash
# 1. Pull cambios y build (igual que PM2)

# 2. Reiniciar servicio
sudo systemctl restart tu-api

# 3. Ver estado
sudo systemctl status tu-api

# 4. Ver logs
sudo journalctl -u tu-api -f
```

---

## ✅ Verificación Post-Despliegue

### 1. Health Check

```bash
curl https://tu-api.com/health
```

**Debe devolver:**
```json
{
  "status": "ok",
  "services": {
    "database": { "status": "connected" },
    "redis": { "status": "connected" },
    "queues": { ... }
  }
}
```

### 2. Verificar Logs

**Render:**
- Dashboard → Logs → Ver últimas líneas
- Buscar errores: `grep -i error` en los logs

**Railway:**
- Dashboard → Logs → Ver en tiempo real

**VPS:**
```bash
# PM2
pm2 logs tu-api --lines 50

# Docker
docker-compose logs --tail=50 api

# systemd
sudo journalctl -u tu-api -n 50
```

### 3. Probar Endpoint Crítico

```bash
# Login de prueba
curl -X POST https://tu-api.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

### 4. Verificar Migraciones Aplicadas

```bash
# En el servidor/contenedor
cd apps/api
npx prisma migrate status
```

**Debe mostrar:** `All migrations have been applied`

---

## ⏪ Rollback

### Si el Despliegue Falla

#### Render

1. **Dashboard → Deployments**
2. **Encontrar deployment anterior que funcionaba**
3. **Click en "..." → Rollback to this deployment**
4. **Esperar a que termine el rollback**

#### Railway

1. **Dashboard → Deployments**
2. **Encontrar deployment anterior**
3. **Click en "Redeploy"**

#### VPS

```bash
# 1. Revertir código
git revert HEAD
# O volver a commit anterior
git checkout <commit-anterior>

# 2. Rebuild y restart
cd apps/api
npm run build
pm2 restart tu-api
```

### Rollback de Migraciones

**Si una migración causó problemas:**

```bash
# Ver migraciones aplicadas
npx prisma migrate status

# Revertir manualmente (solo si conoces el SQL)
psql $DATABASE_URL < rollback-script.sql

# Marcar como no aplicada
npx prisma migrate resolve --rolled-back <migration-name>
```

---

## 🔄 Despliegue Sin Downtime

### Estrategia Blue-Green (Render/Railway)

1. **Crear nuevo servicio** (blue)
2. **Desplegar nueva versión** en blue
3. **Verificar que funciona**
4. **Cambiar DNS/tráfico** a blue
5. **Esperar unos minutos**
6. **Eliminar servicio anterior** (green)

### Estrategia Rolling (VPS con Load Balancer)

1. **Desplegar en instancia 1**
2. **Verificar que funciona**
3. **Desplegar en instancia 2**
4. **Repetir para todas las instancias**

---

## 📊 Monitoreo Post-Despliegue

### Primeros 15 Minutos

- [ ] Health check respondiendo OK
- [ ] Sin errores 5xx en logs
- [ ] Sin alertas críticas
- [ ] Métricas normales (requests/min, latencia)

### Primeras 24 Horas

- [ ] Revisar logs periódicamente
- [ ] Verificar que alertas funcionan
- [ ] Monitorear métricas de performance
- [ ] Verificar que backups se ejecutan

---

## 🚨 Si Algo Sale Mal

1. **Revisar logs inmediatamente**
2. **Verificar health check**
3. **Si es crítico: Rollback inmediato**
4. **Documentar el problema**
5. **Revisar [TROUBLESHOOTING_COMPLETO.md](./TROUBLESHOOTING_COMPLETO.md)**

---

## 📝 Checklist Post-Despliegue

- [ ] Health check OK
- [ ] Sin errores en logs
- [ ] Endpoints críticos funcionando
- [ ] Migraciones aplicadas
- [ ] Alertas configuradas y funcionando
- [ ] Monitoreo activo
- [ ] Documentación actualizada (si hubo cambios)

---

**Última actualización:** 2026-02-19
