# 🚀 Procedimiento de Despliegue

**Fecha:** 2026-02-16  
**Propósito:** Guía paso a paso para desplegar la aplicación en producción

---

## 📋 Índice

1. [Checklist Pre-Despliegue](#checklist-pre-despliegue)
2. [Preparación del Entorno](#preparación-del-entorno)
3. [Despliegue en Render](#despliegue-en-render)
4. [Despliegue en Vercel](#despliegue-en-vercel)
5. [Despliegue Manual](#despliegue-manual)
6. [Verificación Post-Despliegue](#verificación-post-despliegue)
7. [Rollback](#rollback)

---

## ✅ Checklist Pre-Despliegue

### Variables de Entorno

- [ ] `DATABASE_URL` configurada y accesible
- [ ] `REDIS_URL` configurada y accesible
- [ ] `JWT_ACCESS_SECRET` configurado (mínimo 32 caracteres aleatorios)
- [ ] `JWT_REFRESH_SECRET` configurado (diferente de ACCESS_SECRET)
- [ ] `NODE_ENV=production`
- [ ] `ALLOWED_ORIGINS` configurado con dominios permitidos
- [ ] `STRIPE_SECRET_KEY` configurado (si se usa Stripe)
- [ ] `STRIPE_WEBHOOK_SECRET` configurado (si se usa Stripe)
- [ ] `DIAN_CERT_ENCRYPTION_KEY` configurado (si se usa DIAN)
- [ ] Variables opcionales según necesidades

### Base de Datos

- [ ] Base de datos creada y accesible
- [ ] Migraciones aplicadas (`prisma migrate deploy`)
- [ ] Seed ejecutado si es necesario (`prisma db seed`)
- [ ] Backup de base de datos existente (si hay datos)

### Infraestructura

- [ ] Redis funcionando y accesible
- [ ] Servidor de archivos configurado (si aplica)
- [ ] S3 configurado para backups (si aplica)
- [ ] DNS configurado (si aplica)
- [ ] SSL/TLS configurado (HTTPS)

### Código

- [ ] Todos los tests pasan (`npm test`)
- [ ] Build exitoso (`npm run build`)
- [ ] Sin errores de linting (`npm run lint`)
- [ ] Versión actualizada en `package.json`
- [ ] Changelog actualizado

### Monitoreo

- [ ] Alertas configuradas (Slack, Email, etc.)
- [ ] Dashboards de monitoreo configurados
- [ ] Health checks funcionando
- [ ] Logs estructurados configurados

---

## 🔧 Preparación del Entorno

### 1. Crear Base de Datos

```bash
# PostgreSQL en producción
createdb nombre_db_produccion

# O usar servicio gestionado (Render, AWS RDS, etc.)
```

### 2. Aplicar Migraciones

```bash
cd apps/api
npm run prisma:migrate:deploy
```

### 3. Ejecutar Seed (Opcional)

```bash
# Solo si es necesario crear datos iniciales
npm run prisma:seed
```

### 4. Configurar Variables de Entorno

Crear archivo `.env.production` o configurar en plataforma:

```bash
# Copiar ejemplo
cp env.example .env.production

# Editar con valores de producción
nano .env.production
```

**Variables críticas:**
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20
REDIS_URL=redis://host:6379
JWT_ACCESS_SECRET=tu-secret-super-seguro-minimo-32-caracteres
JWT_REFRESH_SECRET=otro-secret-diferente-minimo-32-caracteres
ALLOWED_ORIGINS=https://app.tudominio.com,https://admin.tudominio.com
```

---

## 🌐 Despliegue en Render

### 1. Configurar Blueprint

El archivo `render.yaml` ya está configurado. Solo necesitas:

1. Conectar repositorio en Render Dashboard
2. Seleccionar "Blueprint" como tipo de servicio
3. Render detectará `render.yaml` automáticamente

### 2. Variables de Entorno en Render

Configurar en Render Dashboard → Environment:

```env
NODE_ENV=production
DATABASE_URL=${db.DATABASE_URL}  # Si usas DB de Render
REDIS_URL=${redis.REDIS_URL}     # Si usas Redis de Render
JWT_ACCESS_SECRET=<generar-secret>
JWT_REFRESH_SECRET=<generar-secret>
ALLOWED_ORIGINS=https://app.tudominio.com
```

### 3. Build y Deploy

Render ejecutará automáticamente:
```bash
npm install
npm run build
npm run start:prod
```

### 4. Verificar Despliegue

```bash
# Health check
curl https://tu-app.onrender.com/health

# Métricas
curl https://tu-app.onrender.com/metrics
```

---

## ▲ Despliegue en Vercel

### 1. Configurar Proyecto

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Configurar proyecto
cd apps/api
vercel
```

### 2. Variables de Entorno

Configurar en Vercel Dashboard → Settings → Environment Variables

### 3. Build Settings

En `vercel.json` o configuración del proyecto:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": null
}
```

### 4. Deploy

```bash
# Deploy a producción
vercel --prod
```

---

## 🖥️ Despliegue Manual

### 1. Preparar Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js (si no está instalado)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 para gestión de procesos
sudo npm install -g pm2
```

### 2. Clonar Repositorio

```bash
cd /opt
sudo git clone https://github.com/tu-usuario/tu-repo.git
cd tu-repo
```

### 3. Instalar Dependencias

```bash
cd apps/api
npm install --production
```

### 4. Build

```bash
npm run build
```

### 5. Configurar Variables de Entorno

```bash
# Crear archivo .env
nano .env

# O copiar desde ejemplo
cp ../../env.example .env
nano .env
```

### 6. Aplicar Migraciones

```bash
npm run prisma:migrate:deploy
```

### 7. Iniciar con PM2

```bash
# Crear archivo de configuración PM2
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'api',
    script: './dist/src/main.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF

# Iniciar aplicación
pm2 start ecosystem.config.js

# Guardar configuración
pm2 save

# Configurar inicio automático
pm2 startup
```

---

## ✅ Verificación Post-Despliegue

### 1. Health Check

```bash
curl https://tu-api.com/health | jq
```

**Verificar:**
- [ ] Status: "ok"
- [ ] Database: "connected"
- [ ] Redis: "connected"
- [ ] Queues: "connected"

### 2. Endpoints Críticos

```bash
# Swagger
curl https://tu-api.com/api/docs

# Métricas
curl https://tu-api.com/metrics

# Auth (debe requerir autenticación)
curl https://tu-api.com/auth/me
# Debe retornar 401
```

### 3. Logs

```bash
# Ver logs en tiempo real
pm2 logs api

# O si usas Render/Vercel
# Ver logs en dashboard
```

### 4. Monitoreo

- [ ] Verificar que métricas se están recopilando
- [ ] Verificar que alertas están configuradas
- [ ] Verificar que dashboards muestran datos

---

## 🔄 Rollback

### Rollback en Render

1. Ir a Dashboard → Deploys
2. Seleccionar deploy anterior
3. Hacer "Rollback to this deploy"

### Rollback en Vercel

```bash
# Ver historial de deploys
vercel ls

# Rollback a versión anterior
vercel rollback [deployment-url]
```

### Rollback Manual

```bash
# 1. Detener aplicación
pm2 stop api

# 2. Revertir código
git checkout <commit-anterior>
git pull

# 3. Reinstalar dependencias (si cambió package.json)
npm install --production

# 4. Rebuild
npm run build

# 5. Reiniciar aplicación
pm2 restart api
```

---

## 🔗 Referencias

- Runbook operacional: `docs/RUNBOOK_OPERACIONES.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Monitoreo: `docs/MONITOREO_PROMETHEUS_GRAFANA.md`
- Alertas: `docs/ALERTAS_CONFIGURACION.md`

---

**Última actualización:** 2026-02-16
