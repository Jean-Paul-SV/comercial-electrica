# 📋 Pendientes por Implementar

**Fecha:** 2026-02-18  
**Estado Actual:** ✅ 11 de 11 mejoras críticas/altas implementadas  
**Riesgo Actual:** MEDIO (5.5/10)

---

## 🎯 Resumen Ejecutivo

Este documento lista **todas las tareas pendientes** organizadas por prioridad y tipo. Las mejoras críticas ya están implementadas; estas son tareas operacionales y mejoras futuras.

---

## ⏳ Pendientes Críticos (Acción Manual Requerida)

### 🔴 Prioridad 1: Infraestructura (Esta Semana)

#### 1. Migración Plan Render (E1)
- **Estado:** ⏳ Pendiente acción manual
- **Prioridad:** 🔴 CRÍTICO
- **Tiempo estimado:** 30-45 minutos
- **Costo:** ~$7-25/mes
- **Guía:** `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md`
- **Por qué es crítico:**
  - Plan free no tiene SLA garantizado
  - Puede suspenderse por inactividad
  - Sin escalado automático
- **Checklist:**
  - [ ] Crear backup completo antes de migrar
  - [ ] Actualizar `render.yaml` (plan: starter)
  - [ ] Aplicar cambios en Render Dashboard
  - [ ] Verificar post-migración (health check, endpoints)
  - [ ] Configurar monitoreo externo (UptimeRobot)

#### 2. Configurar Monitoreo Externo (A1)
- **Estado:** ⏳ Pendiente acción manual
- **Prioridad:** 🔴 CRÍTICO
- **Tiempo estimado:** 15 minutos
- **Costo:** $0 (UptimeRobot gratis)
- **Guía:** Incluida en `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md`
- **Por qué es crítico:**
  - Sin monitoreo externo no sabes cuándo el sistema cae
  - Clientes descubren antes que tú
  - Puede causar churn del 10-15%
- **Checklist:**
  - [ ] Crear cuenta UptimeRobot (o Pingdom/StatusCake)
  - [ ] Configurar monitor para `/health`
  - [ ] Configurar alertas por email
  - [ ] Probar alerta (detener servicio temporalmente)

---

## ⏳ Pendientes Importantes (Próximas 2 Semanas)

### 🟠 Prioridad 2: Validación y Pruebas

#### 3. Validación DIAN en Habilitación (E2)
- **Estado:** ⏳ Pendiente credenciales reales
- **Prioridad:** 🟠 ALTO
- **Tiempo estimado:** 2-3 semanas por tenant
- **Costo:** Costo de certificados DIAN por tenant
- **Guía:** `docs/GUIA_VALIDACION_DIAN.md`
- **Por qué es importante:**
  - Sin validación real no sabes si DIAN funciona
  - Puede haber problemas ocultos en producción
  - Requisito legal para facturación electrónica
- **Checklist:**
  - [ ] Obtener credenciales DIAN reales por tenant
  - [ ] Configurar certificado .p12 por tenant
  - [ ] Configurar Software ID y PIN
  - [ ] Generar 10-20 facturas de prueba en habilitación
  - [ ] Verificar aceptación de DIAN
  - [ ] Validar CUFE y PDF/QR generados
  - [ ] Documentar resultados

#### 4. Ejecutar Pruebas de Carga (M2)
- **Estado:** ⏳ Pendiente ejecución
- **Prioridad:** 🟠 ALTO
- **Tiempo estimado:** 1-2 días
- **Costo:** $0 (herramientas gratuitas)
- **Guía:** `docs/GUIA_PRUEBAS_CARGA.md`
- **Por qué es importante:**
  - Sin pruebas no sabes si soporta 100+ tenants
  - Puede haber cuellos de botella ocultos
  - Necesario para escalar con confianza
- **Checklist:**
  - [ ] Instalar k6 o Artillery
  - [ ] Preparar datos de prueba (50-100 tenants)
  - [ ] Ejecutar escenario normal (50 tenants)
  - [ ] Ejecutar escenario alto (100 tenants)
  - [ ] Ejecutar escenario peak (200 tenants)
  - [ ] Analizar resultados y cuellos de botella
  - [ ] Optimizar según resultados
  - [ ] Re-ejecutar pruebas después de optimizaciones

---

## 🔧 Pendientes Opcionales (Mejoras Futuras)

### 🟡 Prioridad 3: Optimizaciones y Mejoras

#### 5. Habilitar Archivado Automático
- **Estado:** ⏳ Pendiente habilitación (código listo)
- **Prioridad:** 🟡 MEDIO
- **Acción requerida:**
  ```env
  ARCHIVE_ENABLED=true
  AUDIT_RETENTION_DAYS=730
  SALES_RETENTION_YEARS=2
  ```
- **Por qué es útil:** Controla crecimiento de BD, reduce costos, mejora performance.
- **Nota:** El health check (`/health`) en producción muestra un aviso informativo si `ARCHIVE_ENABLED` no está en `true`.

#### 6. Implementar Exportación a S3 para Archivado
- **Estado:** ⏳ No implementado
- **Prioridad:** 🟡 MEDIO
- **Tiempo estimado:** 1 semana
- **Costo:** ~$1-5/mes (S3 storage)
- **Descripción:**
  - Exportar datos archivados a S3 antes de eliminar
  - Mantener backups de datos históricos
  - Implementar en `ArchiveService`
- **Archivos a modificar:**
  - `apps/api/src/audit/archive.service.ts`
  - Agregar método `exportToS3()`

#### 7. Implementar Particionado de Tablas por Fecha
- **Estado:** ⏳ No implementado
- **Prioridad:** 🟡 MEDIO
- **Tiempo estimado:** 1 semana
- **Costo:** $0
- **Descripción:**
  - Particionar `AuditLog` y `Sale` por fecha (mensual)
  - Mejora performance de queries históricas
  - Facilita archivado y eliminación
- **Tablas candidatas:**
  - `AuditLog` (particionar por `createdAt`)
  - `Sale` (particionar por `soldAt`)
  - `DianDocument` (particionar por `createdAt`)

#### 8. Implementar Replicación Redis
- **Estado:** ⏳ No implementado
- **Prioridad:** 🟡 MEDIO
- **Tiempo estimado:** 2-3 días
- **Costo:** ~$10-20/mes (Upstash Redis replicado)
- **Descripción:**
  - Migrar a Redis replicado (Upstash Redis)
  - Eliminar single point of failure
  - Mejorar resiliencia
- **Por qué es útil:**
  - Redis actual es single point of failure
  - Si Redis cae, rate limiting se resetea
  - Colas se bloquean

#### 9. Implementar Dashboard de Métricas en Frontend
- **Estado:** ✅ COMPLETADO
- **Prioridad:** 🟡 MEDIO
- **Descripción:**
  - ✅ Dashboard en Panel proveedor → **Métricas de negocio** (`/provider/metrics`)
  - ✅ Consume `/provider/metrics/business`: MRR, churn, LTV, CAC, conversión, ARPU, clientes
  - ✅ Enlace en menú lateral del panel proveedor

#### 10. Implementar Validación de Límites de Plan en Creación de Usuarios
- **Estado:** ✅ COMPLETADO
- **Prioridad:** 🟡 MEDIO
- **Tiempo estimado:** 2-3 días
- **Costo:** $0
- **Descripción:**
  - ✅ Validar `maxUsers` al crear/invitar usuarios (ya implementado en `register()` y `inviteUser()`)
  - ✅ Validar módulos habilitados por plan (ya implementado con `ModulesGuard`)
  - ✅ Endpoint para verificar límites del tenant (`GET /tenant/limits` y `GET /auth/limits`)
- **Archivos implementados:**
  - ✅ `apps/api/src/auth/auth.service.ts` (métodos `register()` y `inviteUser()` ya validan límites)
  - ✅ `apps/api/src/common/services/plan-limits.service.ts` (mejorado para incluir `enabledModules`)
  - ✅ `apps/api/src/tenant/tenant.controller.ts` (nuevo endpoint `GET /tenant/limits`)
  - ✅ `apps/api/src/tenant/tenant.module.ts` (nuevo módulo)
  - ✅ `apps/api/src/auth/auth.controller.ts` (endpoint `GET /auth/limits` actualizado)

---

## 📊 Pendientes de Mejoras Futuras (Largo Plazo)

### 🟢 Prioridad 4: Escalabilidad y Optimización

#### 11. Implementar PgBouncer para Connection Pooling
- **Estado:** ⏳ No implementado
- **Prioridad:** 🟢 BAJO (para 1,000+ clientes)
- **Tiempo estimado:** 1 semana
- **Costo:** $0 (self-hosted) o ~$20/mes (managed)
- **Descripción:**
  - PgBouncer como proxy de conexiones
  - Permite más conexiones concurrentes
  - Mejor gestión de pool
- **Cuándo implementar:** Cuando tengas 500+ clientes activos

#### 12. Implementar Caché Distribuido Avanzado
- **Estado:** ⏳ Parcialmente implementado
- **Prioridad:** 🟢 BAJO
- **Tiempo estimado:** 1 semana
- **Costo:** $0 (Redis ya existe)
- **Descripción:**
  - Caché más agresivo para reportes
  - Invalidación inteligente
  - Pre-cálculo de métricas frecuentes

#### 13. Implementar CDN para Assets Estáticos
- **Estado:** ⏳ No implementado
- **Prioridad:** 🟢 BAJO
- **Tiempo estimado:** 2-3 días
- **Costo:** ~$5-10/mes (Cloudflare, etc.)
- **Descripción:**
  - CDN para assets estáticos del frontend
  - Mejora tiempos de carga
  - Reduce carga en servidor

#### 14. Implementar Logging Estructurado Avanzado
- **Estado:** ⏳ Parcialmente implementado
- **Prioridad:** 🟢 BAJO
- **Tiempo estimado:** 3-5 días
- **Costo:** ~$10-50/mes (Datadog, LogRocket, etc.)
- **Descripción:**
  - Logging estructurado con contexto
  - Agregación de logs
  - Búsqueda y análisis avanzado

---

## 🔒 Pendientes de Seguridad (Mejoras Continuas)

### 🟡 Prioridad 3: Seguridad Adicional

#### 15. Implementar Rotación Automática de Secretos
- **Estado:** ⏳ Parcialmente implementado (DIAN cert keys)
- **Prioridad:** 🟡 MEDIO
- **Tiempo estimado:** 1 semana
- **Costo:** $0
- **Descripción:**
  - Rotación automática de JWT secrets
  - Rotación de claves de encriptación
  - Notificación antes de rotación

#### 16. Implementar Auditoría de Queries Sin TenantId
- **Estado:** ✅ COMPLETADO
- **Prioridad:** 🟡 MEDIO
- **Descripción:**
  - ✅ Middleware de Prisma que detecta findMany/findFirst/updateMany/deleteMany sin `tenantId` en modelos con alcance por tenant
  - ✅ Logging en nivel WARN cuando el request tiene tenantId pero la query no filtra por tenantId
  - ✅ Archivo: `apps/api/src/prisma/tenant-query-audit.middleware.ts`; registrado en `PrismaService.onModuleInit()`

#### 17. Implementar Rate Limiting por IP Adicional
- **Estado:** ✅ COMPLETADO
- **Prioridad:** 🟡 MEDIO
- **Descripción:**
  - ✅ Login: 50/min por IP (existente)
  - ✅ Forgot-password: 3/15 min (existente)
  - ✅ Bootstrap-admin: 5/hora por IP
  - ✅ Reset-password y accept-invite: 30/min por IP (nuevo throttle `publicIp`)

---

## 📈 Pendientes de Métricas y Observabilidad

### 🟡 Prioridad 3: Observabilidad Mejorada

#### 18. Implementar Métricas Prometheus Completas
- **Estado:** ⏳ Parcialmente implementado
- **Prioridad:** 🟡 MEDIO
- **Tiempo estimado:** 1 semana
- **Costo:** $0 (self-hosted) o ~$20/mes (Grafana Cloud)
- **Descripción:**
  - Métricas completas de Prometheus
  - Dashboard de Grafana
  - Alertas configurables

#### 19. Implementar Tracing Distribuido
- **Estado:** ⏳ No implementado
- **Prioridad:** 🟢 BAJO
- **Tiempo estimado:** 1 semana
- **Costo:** ~$20-50/mes (Datadog APM, etc.)
- **Descripción:**
  - Tracing distribuido con OpenTelemetry
  - Visualización de requests end-to-end
  - Identificación de cuellos de botella

---

## 🎯 Resumen por Prioridad

### 🔴 Críticos (Esta Semana)

1. ✅ Migración plan Render (30-45 min)
2. ✅ Configurar monitoreo externo (15 min)

**Total tiempo:** ~1 hora  
**Total costo:** ~$7-25/mes

### 🟠 Importantes (Próximas 2 Semanas)

3. ⏳ Validación DIAN habilitación (2-3 semanas)
4. ⏳ Pruebas de carga (1-2 días)

**Total tiempo:** 2-3 semanas  
**Total costo:** Costo certificados DIAN

### 🟡 Opcionales (Próximo Mes)

5. ⏳ Habilitar archivado automático (5 min)
6. ⏳ Exportación S3 para archivado (1 semana)
7. ⏳ Particionado de tablas (1 semana)
8. ⏳ Replicación Redis (2-3 días)
9. ⏳ Dashboard métricas frontend (1 semana)
10. ⏳ Validación límites plan (2-3 días)

**Total tiempo:** ~1 mes  
**Total costo:** ~$10-25/mes

### 🟢 Futuras (Largo Plazo)

11-19. Mejoras de escalabilidad y optimización

**Total tiempo:** Variable  
**Total costo:** Variable según mejoras

---

## 📋 Checklist Consolidado

### Esta Semana (Críticos)

- [ ] Migrar plan Render (30-45 min)
- [ ] Configurar monitoreo externo (15 min)
- [ ] Ejecutar `npm run verify:tenant-isolation` (5 min)

### Próximas 2 Semanas (Importantes)

- [ ] Obtener credenciales DIAN reales
- [ ] Validar DIAN en habilitación (2-3 semanas)
- [ ] Ejecutar pruebas de carga (1-2 días)

### Próximo Mes (Opcionales)

- [ ] Habilitar archivado automático (5 min)
- [ ] Implementar exportación S3 (1 semana)
- [ ] Implementar particionado de tablas (1 semana)
- [ ] Migrar a Redis replicado (2-3 días)
- [ ] Crear dashboard de métricas (1 semana)
- [x] Validar límites de plan en creación usuarios (2-3 días) ✅ COMPLETADO

---

## 📊 Estado de Implementación

### ✅ Completado (11/11)

- ✅ Connection pool aumentado
- ✅ Reconciliación Stripe mejorada
- ✅ Métricas conexiones BD
- ✅ Alertas proactivas de pagos
- ✅ Script verificación multi-tenant
- ✅ Servicio validación backups
- ✅ Scheduler validación backups
- ✅ Checklist migración Render
- ✅ Validación NIT certificados DIAN
- ✅ Rate limiting por tenant extendido
- ✅ Archivado automático de datos

### ⏳ Pendiente Acción Manual (4)

1. Migración plan Render
2. Configurar monitoreo externo
3. Validación DIAN habilitación
4. Ejecutar pruebas de carga

### ⏳ Pendiente Implementación (8)

5. Exportación S3 para archivado
6. Particionado de tablas
7. Replicación Redis
8. Dashboard métricas frontend
9. ~~Validación límites plan~~ ✅ COMPLETADO
10. PgBouncer (futuro)
11. Caché avanzado (futuro)
12. CDN (futuro)
13. Logging avanzado (futuro)

---

## 🎯 Recomendaciones

### Inmediatas (Esta Semana)

1. **Migrar plan Render** - Crítico para producción estable
2. **Configurar monitoreo** - Crítico para detectar problemas

### Corto Plazo (Próximas 2 Semanas)

3. **Validar DIAN** - Requisito legal para facturación
4. **Pruebas de carga** - Validar capacidad antes de escalar

### Mediano Plazo (Próximo Mes)

5. **Habilitar archivado** - Controlar crecimiento de BD
6. **Implementar exportación S3** - Mejorar archivado
7. **Dashboard métricas** - Mejor observabilidad

### Largo Plazo (Cuando Escales)

8. **PgBouncer** - Para 500+ clientes
9. **Replicación Redis** - Para alta disponibilidad
10. **CDN** - Para mejor performance global

---

## 📚 Documentación Relacionada

- `docs/RESUMEN_EJECUTIVO_FINAL.md` - Estado completo del proyecto
- `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md` - Próximo paso crítico
- `docs/GUIA_VALIDACION_DIAN.md` - Validación DIAN
- `docs/GUIA_PRUEBAS_CARGA.md` - Pruebas de carga
- `docs/AUDITORIA_HOSTIL_DESTRUCCION.md` - Auditoría completa

---

**Última actualización:** 2026-02-18  
**Próxima revisión:** Después de completar pendientes críticos
