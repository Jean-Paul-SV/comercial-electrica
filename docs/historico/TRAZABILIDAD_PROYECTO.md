# Trazabilidad del proyecto

**Objetivo:** Vincular **objetivos de negocio** → **documentos de diseño** → **componentes de implementación** para ver qué cubre cada necesidad y qué falta por hacer.

---

## 1. Resumen ejecutivo

| Área | Objetivo de negocio | Documento(s) de diseño | Estado actual |
|------|---------------------|-------------------------|---------------|
| **Seguridad y acceso** | Roles y permisos por cliente; validación backend + frontend | ROLES_Y_PERMISOS_DISEÑO, schema-roles-permisos.prisma | Parcial: Tenant, Permission, Role, UserRole, PermissionsService, PermissionsGuard, GET /auth/me; nav por permisos; RoleName se mantiene por compatibilidad |
| **Estado operativo** | Interpretar estado del negocio; alertas y acciones | ESTADOS_OPERATIVOS_Y_ALERTAS | Implementado: GET /reports/operational-state; dashboard con bloque "Alertas operativas" |
| **Onboarding** | Guiar usuarios no técnicos; reducir estrés | ONBOARDING_UX_DISEÑO | Implementado: flujo 3 pasos, GET/PATCH /onboarding/status, panel Tu progreso |
| **Auditoría** | Trazabilidad completa; defendible ante DIAN | AUDITORIA_Y_TRAZABILIDAD | Parcial: AuditLog + requestId, ip, userAgent, severity, category, **tenantId**; AuditContextInterceptor; **hash chain implementada** (previousHash/entryHash, verifyChain); **listado y entidad filtrados por tenant** |
| **Resiliencia** | Negocio no se detenga; backups y offline | RESILIENCIA_Y_SINCRONIZACION | Implementado: backups + download + export CSV + copia S3; cliente: reintentos/backoff, timeout, detección offline, banner; cola offline + Idempotency-Key (nivel B) |
| **Modularidad SaaS** | Módulos por cliente; planes y franquicias | ARQUITECTURA_MODULAR_SAAS | Implementado: Plan, PlanFeature, TenantModule, AddOn, TenantAddOn; TenantModulesService; ModulesGuard + @RequireModule; GET /auth/me con tenant + enabledModules; nav por moduleCode; página "Módulo no disponible" |
| **Indicadores** | Datos que digan “qué hacer”; no solo gráficas | INDICADORES_Y_ACCIONES | Implementado: productos pérdida/margen bajo, sin rotación, facturas vencidas, proveedores menos competitivos, ventas por empleado; dashboard "Acciones recomendadas" |

---

## 2. Objetivos de negocio y documentos de diseño

Cada objetivo se traza a uno o más documentos de diseño.

| ID | Objetivo de negocio | Documento(s) | Sección principal |
|----|---------------------|--------------|--------------------|
| **O1** | Roles desacoplados de permisos; permisos por acción (crear, ver, editar, eliminar) | ROLES_Y_PERMISOS_DISEÑO | Modelo conceptual, Permission, RolePermission |
| **O2** | Validación en backend y frontend; escalable para nuevos módulos | ROLES_Y_PERMISOS_DISEÑO | PermissionsGuard, @RequirePermission, frontend por permisos |
| **O3** | Multi-tenant; múltiples negocios con mismo código | ROLES_Y_PERMISOS_DISEÑO, ARQUITECTURA_MODULAR_SAAS, schema-roles-permisos | Tenant, User.tenantId, Plan, TenantModule |
| **O4** | Detectar situaciones críticas (caja, stock, cotizaciones, ventas anómalas) | ESTADOS_OPERATIVOS_Y_ALERTAS | Catálogo de estados, reglas de detección |
| **O5** | Alertas con prioridad/severidad y acción sugerida | ESTADOS_OPERATIVOS_Y_ALERTAS | Estructura API indicators + alerts, acción por estado |
| **O6** | Onboarding para nuevos negocios; checklist de configuración mínima | ONBOARDING_UX_DISEÑO | Flujo 3 pasos, estados de progreso, checklist Recomendado |
| **O7** | Mensajes claros y no técnicos; guiar sin abrumar | ONBOARDING_UX_DISEÑO | Glosario Evitar/Usar, tono, una acción por pantalla |
| **O8** | Registrar quién hizo qué, cuándo y desde dónde | AUDITORIA_Y_TRAZABILIDAD | Estructura de logs (ip, userAgent, requestId), eventos por entidad |
| **O9** | Historial inmutable; defendible ante DIAN y control interno | AUDITORIA_Y_TRAZABILIDAD | Inmutabilidad, hash chain, retención, exportación |
| **O10** | Backups automáticos; exportación manual; negocio no se detenga | RESILIENCIA_Y_SINCRONIZACION | Estrategia backup, GET download, exportación por entidad |
| **O11** | Funcionamiento offline parcial; sincronización al recuperar conexión | RESILIENCIA_Y_SINCRONIZACION | Cola de escrituras, Idempotency-Key, niveles A/B/C |
| **O12** | Activar o desactivar módulos por cliente; planes y franquicias | ARQUITECTURA_MODULAR_SAAS | Plan, PlanFeature, Tenant, TenantModule, AddOn, ModulesGuard |
| **O13** | Indicadores que digan “qué hacer” (productos con pérdida, proveedores, empleados) | INDICADORES_Y_ACCIONES | Catálogo de indicadores, fórmulas, insight + acción + enlace |
| **O14** | Mostrar indicadores sin abrumar; dónde aplicar IA | INDICADORES_Y_ACCIONES | Una acción por bloque, top N, sección Acciones recomendadas; IA: anomalías, pronóstico, resumen NL |

---

## 3. Trazabilidad: documento → componentes de implementación

Qué parte del código o del esquema materializa cada diseño.

### 3.1 Roles y permisos (ROLES_Y_PERMISOS_DISEÑO, schema-roles-permisos.prisma)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| Tenant, Permission, Role, RolePermission, UserRole | Prisma: Tenant, Permission, Role, RolePermission, UserRole; User.tenantId, User.userRoles | Implementado |
| PermissionsService, getEnabledPermissionsForUser(userId) | PermissionsService.getEnabledPermissionsForUser, userHasAnyPermission | Implementado |
| PermissionsGuard, @RequirePermission('recurso:accion') | PermissionsGuard + @RequirePermission; AuditController usa audit:read | Implementado |
| GET /auth/me con permissions | GET /auth/me devuelve user + permissions | Implementado |
| Frontend: nav por permisos | filterByRole: getNavForRole(..., permissions); config con requiredPermission; AuthProvider permissions | Implementado |

**Archivos relacionados:** `apps/api/prisma/schema.prisma`, `apps/api/src/auth/permissions.service.ts`, `permissions.guard.ts`, `require-permission.decorator.ts`, `auth.service.ts`, `auth.controller.ts`; `apps/api/prisma/seed.ts`; `apps/web/src/features/auth/api.ts`, `types.ts`; `apps/web/src/shared/providers/AuthProvider.tsx`, `shared/navigation/config.ts`, `filterByRole.ts`, `types.ts`, `shared/ui/AppShell.tsx`.

### 3.2 Estados operativos y alertas (ESTADOS_OPERATIVOS_Y_ALERTAS)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| GET /reports/operational-state (indicators + alerts) | ReportsService.getOperationalState(), GET /reports/operational-state | Implementado |
| Reglas de detección (caja, stock, cotizaciones, ventas, facturas proveedor) | getOperationalState: CASH_NO_SESSION, CASH_MULTIPLE_OPEN, STOCK_ZERO, STOCK_LOW, QUOTES_EXPIRED, QUOTES_EXPIRING_SOON, SALES_ANOMALY_ZERO, INVOICES_OVERDUE, INVOICES_DUE_SOON | Implementado |
| Severidad y prioridad por estado | Cada alerta tiene severity y priority; orden por priority | Implementado |
| actionLabel, actionHref por alerta | Cada alerta tiene actionLabel, actionHref, entityIds | Implementado |

**Archivos relacionados:** `apps/api/src/reports/reports.service.ts`; `apps/web/src/features/reports/api.ts`, `hooks.ts`, `types.ts`; `apps/web/src/app/(protected)/app/page.tsx` (bloque "Alertas operativas").

### 3.3 Onboarding (ONBOARDING_UX_DISEÑO)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| Flujo bienvenida → Paso 1 (caja) → Paso 2 (producto) → Paso 3 (listo) | /onboarding: bienvenida, paso 1 (abrir caja), paso 2 (primer producto), paso 3 (listo) | Implementado |
| Condición “primera vez” (User.onboardingStatus, sin caja/productos) | GET /onboarding/status; redirección desde dashboard si not_started/in_progress | Implementado |
| Panel “Tu progreso” / checklist Recomendado en dashboard | Dashboard: panel “Tu progreso” colapsable con checklist, “Ya no mostrar”, enlace a /onboarding | Implementado |
| Mensajes claros y no técnicos | Textos en onboarding y panel según glosario del diseño | Implementado |

**Archivos relacionados:** `apps/api/src/onboarding/`, `apps/api/prisma/schema.prisma` (User.onboardingStatus, onboardingCompletedAt); `apps/web/src/features/onboarding/`, `apps/web/src/app/(protected)/onboarding/page.tsx`, `app/page.tsx`, `layout.tsx`.

### 3.4 Auditoría (AUDITORIA_Y_TRAZABILIDAD)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| AuditLog con actorId, entity, entityId, action, diff, createdAt | AuditLog en Prisma; AuditService.log, logCreate, logUpdate, logDelete, logAuth | Implementado |
| Campos ip, userAgent, requestId, severity, category | Schema + migración 20260131000000; AuditService acepta contexto; AuditContextInterceptor inyecta por request | Implementado |
| tenantId en AuditLog (multi-tenant) | Schema tenantId; AuditContextData.tenantId; TenantContextInterceptor antes de AuditContextInterceptor; persistencia y hash compatibles con registros antiguos | Implementado (feb 2026) |
| Listado y consulta por entidad filtrados por tenant | GET /audit-logs: where.tenantId = req.user.tenantId o query.tenantId (plataforma); GET entity/:entity/:entityId idem | Implementado (feb 2026) |
| Cadena de integridad (hash chain) | previousHash, entryHash en create; verifyChain() y GET /audit-logs/verify-chain | Implementado |
| Guard de permisos para consulta (audit:read, módulo audit) | AuditController @RequirePermission('audit:read'), @RequireModule('audit') | Implementado |
| Retención y archivado | No documentado en código | Por definir en operación |

**Qué falta en trazabilidad (opcional o futuro):**

- **Campo summary:** ✅ Implementado (feb 2026): columna `summary` en AuditLog; si no se pasa en contexto se genera `entity · action`; listado y modal de auditoría lo muestran cuando existe.
- **Cobertura de eventos:** según AUDITORIA_Y_TRAZABILIDAD no todos los módulos llaman aún a audit (ej. algunos CRUD de categorías, facturas, proveedores); ir ampliando según prioridad.
- **Retención/archivado:** política de retención y exportación para cumplimiento (por definir en operación).

**Archivos relacionados:** `apps/api/prisma/schema.prisma` (AuditLog), `apps/api/src/common/services/audit.service.ts`, `apps/api/src/common/audit/audit-context.ts`, `apps/api/src/common/interceptors/audit-context.interceptor.ts`, `apps/api/src/audit/audit.controller.ts`, `apps/api/src/audit/dto/list-audit-logs-query.dto.ts`.

### 3.5 Resiliencia (RESILIENCIA_Y_SINCRONIZACION)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| Backups automáticos periódicos | BackupsService.scheduledBackup (cron 2 AM), createBackup, cleanupOldBackups | Implementado |
| Verificación por checksum | verifyBackup(id) | Implementado |
| Descarga de backup (GET /backups/:id/download) | BackupsController GET :id/download, BackupsService.getBackupDownload | Implementado |
| Copia off-site (S3/Blob) | BackupsService.uploadToS3IfConfigured: tras backup exitoso, si BACKUP_S3_BUCKET está definido, sube a S3 (key backups/backup-{id}.dump) | Implementado |
| Exportación por entidad (CSV) | GET /reports/export?entity=sales|customers, ReportsService.exportAsCsv | Implementado (ventas, clientes) |
| Reintentos y backoff en cliente | apiClient: requestWithRetry, timeout 30s, 3 intentos, backoff 1s/2s/4s; solo 5xx y errores de red | Implementado |
| Detección offline en cliente | useOnlineStatus (navigator.onLine + eventos online/offline) | Implementado |
| Banner "Sin conexión" en UI | AppShell y layout onboarding: banner cuando !isOnline | Implementado |
| Cola de escrituras + Idempotency-Key | Backend: IdempotencyInterceptor (Redis cache 24h); Frontend: offlineQueueStore, apiClient idempotencyKey, useOfflineQueue, OfflineQueueBell; ventas con encolado en error de red | Implementado |

**Archivos relacionados:** `apps/api/src/backups/backups.service.ts`, `backups.controller.ts`; `apps/web/src/infrastructure/api/client.ts`, `apps/web/src/shared/hooks/useOnlineStatus.ts`, `apps/web/src/shared/ui/AppShell.tsx`, `apps/web/src/app/(protected)/layout.tsx`.

### 3.6 Arquitectura modular SaaS (ARQUITECTURA_MODULAR_SAAS)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| Plan, PlanFeature, Tenant, TenantModule, AddOn, TenantAddOn | Prisma: Plan, PlanFeature, Tenant.planId, TenantModule, AddOn, TenantAddOn; migración 20260202100000; seed plan "Todo incluido" | Implementado |
| TenantModulesService, getEnabledModules(tenantId) | TenantModulesService.getEnabledModules; tenantId null = todos los módulos | Implementado |
| ModulesGuard, @RequireModule('inventory') | ModulesGuard + @RequireModule; aplicado en Inventory, Suppliers, SupplierInvoices, Purchases, Dian, Reports, Audit, Backups | Implementado |
| GET /auth/me con enabledModules | GET /auth/me devuelve user, permissions, tenant: { id, name, plan?, enabledModules } | Implementado |
| Frontend: nav por moduleCode | config con moduleCode por ítem/sección; filterByRole(..., enabledModules); AuthProvider.enabledModules; página /plan-required | Implementado |

**Archivos relacionados:** `apps/api/prisma/schema.prisma`, `apps/api/src/auth/tenant-modules.service.ts`, `modules.guard.ts`, `require-module.decorator.ts`, `auth.service.ts`, `auth.controller.ts`; `apps/api/prisma/seed.ts`; `apps/web/src/features/auth/types.ts`, `shared/providers/AuthProvider.tsx`, `shared/navigation/config.ts`, `filterByRole.ts`, `routeModuleMap.ts`, `shared/ui/AppShell.tsx`, `app/(protected)/layout.tsx`, `app/(protected)/plan-required/page.tsx`.

### 3.7 Indicadores accionables (INDICADORES_Y_ACCIONES)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| Productos con pérdida, margen erosionado | ReportsService.getActionableIndicators: PRODUCTS_LOSS, PRODUCTS_LOW_MARGIN | Implementado |
| Proveedores menos competitivos | SUPPLIERS_LESS_COMPETITIVE: precio por encima del promedio por producto (PurchaseOrderItem por supplierId/productId) | Implementado |
| Patrones por empleado (ventas por usuario) | SALES_BY_EMPLOYEE: ventas por Sale.createdByUserId, total y cuenta por usuario | Implementado |
| Sin rotación, facturas vencidas | PRODUCTS_NO_ROTATION, INVOICES_OVERDUE en getActionableIndicators | Implementado |
| GET /reports/actionable-indicators (insight, action, actionHref) | GET /reports/actionable-indicators; ReportsService.getActionableIndicators | Implementado |
| Sección “Acciones recomendadas” en dashboard | Dashboard con bloque que consume actionable-indicators | Implementado |

**Archivos relacionados:** `apps/api/src/reports/reports.service.ts`, `reports.controller.ts`, `interfaces/actionable-indicators.interface.ts`; `apps/web/src/features/reports/api.ts`, `hooks.ts`, `types.ts`; `apps/web/src/app/(protected)/app/page.tsx`, `apps/web/src/app/(protected)/reports/page.tsx`.

---

## 4. Matriz de trazabilidad (objetivo ↔ documento ↔ componente)

| Objetivo | Documento | Componente backend | Componente frontend | Estado |
|----------|-----------|--------------------|---------------------|--------|
| O1–O3 Roles, permisos, multi-tenant | ROLES_Y_PERMISOS, schema-roles-permisos, ARQUITECTURA_MODULAR_SAAS | Tenant, Permission, Role, UserRole, PermissionsService, PermissionsGuard, GET /auth/me | Nav por permisos (requiredPermission), AuthProvider.permissions | Parcial (RBAC implementado; Plan/módulos pendiente) |
| O4–O5 Estados y alertas | ESTADOS_OPERATIVOS_Y_ALERTAS | ReportsService.getOperationalState, reglas por estado | Dashboard con bloque "Alertas operativas" (alerts[]) | Implementado |
| O6–O7 Onboarding | ONBOARDING_UX_DISEÑO | User.onboardingStatus, GET/PATCH /onboarding/status | Flujo 3 pasos, redirección primera vez, panel Tu progreso | Implementado |
| O8–O9 Auditoría completa | AUDITORIA_Y_TRAZABILIDAD | AuditLog + ip, userAgent, severity, category, tenantId; hash chain; listado por tenant | Consulta auditoría (existente) | Parcial (log completo; retención/archivado por definir) |
| O10–O11 Backup y resiliencia | RESILIENCIA_Y_SINCRONIZACION | BackupsService, GET download, export CSV, copia S3; apiClient reintentos/backoff/timeout/idempotencyKey; useOnlineStatus; IdempotencyInterceptor | Banner sin conexión; cola offline + UI Pendientes de enviar | Implementado |
| O12 Módulos por cliente | ARQUITECTURA_MODULAR_SAAS | Plan, TenantModule, TenantModulesService, ModulesGuard, GET /me con tenant + enabledModules | Nav por moduleCode; página plan-required | Implementado |
| O13–O14 Indicadores e IA | INDICADORES_Y_ACCIONES | Reports: productos pérdida/margen bajo, sin rotación, facturas vencidas, proveedores menos competitivos, ventas por empleado; GET actionable-indicators | Acciones recomendadas en dashboard; reportes por categoría | Implementado |

---

## 5. Dependencias entre diseños

- **Tenant** es compartido por: Roles y permisos (User.tenantId, UserRole.tenantId), Arquitectura modular (Tenant.planId, TenantModule), y opcionalmente Auditoría (tenantId en AuditLog). Conviene introducir Tenant y Plan en una misma migración si se implementan ambos.
- **Estados operativos** y **Indicadores accionables** comparten datos (caja, stock, cotizaciones, ventas); pueden compartir servicio de “estado del negocio” y exponer dos endpoints (operational-state vs actionable-indicators) o uno unificado con secciones.
- **Onboarding** usa estado de caja y productos (¿hay sesión abierta? ¿hay productos?); depende de los mismos datos que Estados operativos.
- **Indicadores por empleado** requieren **quién registró la venta**: o bien campo `soldBy` en Sale o uso de AuditLog (entity=sale, action=create, actorId). Afecta a Auditoría (ya se registra create de sale) e Indicadores.

---

## 6. Orden sugerido de implementación

1. **Auditoría (campos nuevos):** Añadir ip, userAgent, requestId, severity, category a AuditLog e inyectar contexto en AuditService; bajo impacto y alto valor para trazabilidad.
2. **Backup descarga y exportación:** GET /backups/:id/download; GET /reports/export?entity=… para resiliencia y uso con internet inestable.
3. **Estados operativos (alerts):** OperationalStateService o extensión de Reports con estructura indicators + alerts y actionHref; dashboard con bloque “Acciones recomendadas” usando esas alertas.
4. **Indicadores accionables (primeros):** Productos con pérdida, facturas vencidas, sin rotación; endpoint actionable-indicators o integrar en dashboard.
5. **Tenant + Plan + módulos:** Schema Tenant, Plan, PlanFeature, TenantModule (y AddOn si aplica); TenantModulesService; ModulesGuard; GET /auth/me con enabledModules; frontend nav por moduleCode.
6. **Roles y permisos (RBAC):** Permission, Role, RolePermission, UserRole; PermissionsService; PermissionsGuard y @RequirePermission; frontend por permisos.
7. **Onboarding:** Flujo 3 pasos, condición primera vez, panel Tu progreso.
8. **Resiliencia cliente:** Reintentos y backoff en apiClient; detección offline; cola de escrituras + Idempotency-Key en backend (opcional según prioridad).

---

## 7. Referencia rápida de documentos

| Documento | Ruta | Contenido principal |
|-----------|------|---------------------|
| ROLES_Y_PERMISOS_DISEÑO | docs/ROLES_Y_PERMISOS_DISEÑO.md | RBAC, Permission, Role, Tenant, guard, flujo |
| schema-roles-permisos | docs/schema-roles-permisos.prisma | Prisma: Tenant, Permission, Role, RolePermission, UserRole |
| ESTADOS_OPERATIVOS_Y_ALERTAS | docs/ESTADOS_OPERATIVOS_Y_ALERTAS.md | Estados, reglas, indicators + alerts, severidad, acciones |
| ONBOARDING_UX_DISEÑO | docs/ONBOARDING_UX_DISEÑO.md | Flujo onboarding, progreso, mensajes, checklist |
| AUDITORIA_Y_TRAZABILIDAD | docs/AUDITORIA_Y_TRAZABILIDAD.md | Eventos, estructura logs, inmutabilidad, hash chain |
| RESILIENCIA_Y_SINCRONIZACION | docs/RESILIENCIA_Y_SINCRONIZACION.md | Backup, descarga, cola offline, Idempotency-Key |
| ARQUITECTURA_MODULAR_SAAS | docs/ARQUITECTURA_MODULAR_SAAS.md | Plan, Tenant, módulos por cliente, ModulesGuard, precios |
| INDICADORES_Y_ACCIONES | docs/INDICADORES_Y_ACCIONES.md | Indicadores accionables, fórmulas, IA, “qué hacer” |

Este documento se puede actualizar cuando se implemente un componente o se añada un nuevo objetivo o diseño.
