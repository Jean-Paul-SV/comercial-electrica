# Trazabilidad del proyecto

**Objetivo:** Vincular **objetivos de negocio** → **documentos de diseño** → **componentes de implementación** para ver qué cubre cada necesidad y qué falta por hacer.

---

## 1. Resumen ejecutivo

| Área | Objetivo de negocio | Documento(s) de diseño | Estado actual |
|------|---------------------|-------------------------|---------------|
| **Seguridad y acceso** | Roles y permisos por cliente; validación backend + frontend | ROLES_Y_PERMISOS_DISEÑO, schema-roles-permisos.prisma | Diseñado; implementado parcial (RoleName ADMIN/USER) |
| **Estado operativo** | Interpretar estado del negocio; alertas y acciones | ESTADOS_OPERATIVOS_Y_ALERTAS | Diseñado; dashboard con KPIs básicos |
| **Onboarding** | Guiar usuarios no técnicos; reducir estrés | ONBOARDING_UX_DISEÑO | Diseñado; no implementado |
| **Auditoría** | Trazabilidad completa; defendible ante DIAN | AUDITORIA_Y_TRAZABILIDAD | Diseñado; AuditLog + AuditService existentes, sin IP/hash/severidad |
| **Resiliencia** | Negocio no se detenga; backups y offline | RESILIENCIA_Y_SINCRONIZACION | Parcial: backups automáticos; sin descarga ni cola offline |
| **Modularidad SaaS** | Módulos por cliente; planes y franquicias | ARQUITECTURA_MODULAR_SAAS | Diseñado; no implementado (sin Tenant/Plan) |
| **Indicadores** | Datos que digan “qué hacer”; no solo gráficas | INDICADORES_Y_ACCIONES | Diseñado; reportes descriptivos, sin indicadores accionables |

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
| Tenant, Permission, Role, RolePermission, UserRole | Prisma: no existen; User tiene solo RoleName (ADMIN/USER) | Por implementar |
| PermissionsService, getEnabledPermissions(tenantId/userId) | No existe | Por implementar |
| PermissionsGuard, @RequirePermission('recurso:accion') | RolesGuard + @Roles(RoleName) en controllers | Parcial; migrar a permisos |
| JWT con permisos o tenantId | JWT con sub, email, role | Parcial; añadir permissions o tenantId |
| Frontend: nav y rutas por permisos | filterByRole.ts, nav por roles ADMIN/USER | Parcial; extender a permisos |

**Archivos relacionados:** `apps/api/src/auth/roles.guard.ts`, `roles.decorator.ts`, `auth.service.ts`; `apps/web/src/shared/navigation/config.ts`, `filterByRole.ts`, `shared/auth/roles.ts`.

### 3.2 Estados operativos y alertas (ESTADOS_OPERATIVOS_Y_ALERTAS)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| GET /reports/operational-state (indicators + alerts) | GET /reports/dashboard con sales, inventory, cash, quotes | Parcial; sin estructura alerts[] ni acción por estado |
| Reglas de detección (caja, stock, cotizaciones, ventas anómalas, etc.) | app.service.getStats, reports.getDashboard (lowStock, openSessions, pendingQuotes) | Parcial; faltan CASH_NO_SESSION, QUOTES_EXPIRED, SALES_ANOMALY_*, etc. |
| Severidad y prioridad por estado | No | Por implementar |
| actionLabel, actionHref por alerta | No | Por implementar |

**Archivos relacionados:** `apps/api/src/reports/reports.service.ts`, `app.service.ts`; `apps/web/src/app/(protected)/app/page.tsx`.

### 3.3 Onboarding (ONBOARDING_UX_DISEÑO)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| Flujo bienvenida → Paso 1 (caja) → Paso 2 (producto) → Paso 3 (listo) | No existe | Por implementar |
| Condición “primera vez” (sin caja/productos o flag onboarding) | No | Por implementar |
| Panel “Tu progreso” / checklist Recomendado en dashboard | No | Por implementar |
| Mensajes y glosario no técnicos | No centralizado | Por implementar donde aplique |

**Archivos relacionados:** Nuevas rutas/páginas en `apps/web`; posible endpoint GET /onboarding/status o flag en GET /auth/me.

### 3.4 Auditoría (AUDITORIA_Y_TRAZABILIDAD)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| AuditLog con actorId, entity, entityId, action, diff, createdAt | AuditLog en Prisma; AuditService.log, logCreate, logUpdate, logDelete, logAuth | Implementado |
| Campos ip, userAgent, requestId, severity, category, hash | No en schema ni en servicio | Por implementar |
| Guard de permisos para consulta (solo ADMIN) | AuditController @Roles(ADMIN) | Implementado |
| Cadena de integridad (hash chain) | No | Opcional |
| Retención y archivado | No documentado en código | Por definir en operación |

**Archivos relacionados:** `apps/api/prisma/schema.prisma` (AuditLog), `apps/api/src/common/services/audit.service.ts`, `apps/api/src/audit/audit.controller.ts`.

### 3.5 Resiliencia (RESILIENCIA_Y_SINCRONIZACION)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| Backups automáticos periódicos | BackupsService.scheduledBackup (cron 2 AM), createBackup, cleanupOldBackups | Implementado |
| Verificación por checksum | verifyBackup(id) | Implementado |
| Descarga de backup (GET /backups/:id/download) | No | Por implementar |
| Copia off-site (S3/Blob) | No | Por implementar |
| Exportación por entidad (CSV/Excel) | No | Por implementar |
| Reintentos y detección offline en cliente | apiClient sin reintentos; sin navigator.onLine | Por implementar |
| Cola de escrituras + Idempotency-Key | No | Por implementar |

**Archivos relacionados:** `apps/api/src/backups/backups.service.ts`, `backups.controller.ts`; `apps/web/src/infrastructure/api/client.ts`.

### 3.6 Arquitectura modular SaaS (ARQUITECTURA_MODULAR_SAAS)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| Plan, PlanFeature, Tenant, TenantModule, AddOn, TenantAddOn | No en schema | Por implementar |
| TenantModulesService, getEnabledModules(tenantId) | No | Por implementar |
| ModulesGuard, @RequireModule('inventory') | No | Por implementar |
| GET /auth/me con enabledModules | GET /auth/me devuelve user + token; sin tenant ni modules | Por implementar |
| Frontend: nav por moduleCode | Nav por roles; sin moduleCode ni enabledModules | Por implementar |

**Archivos relacionados:** `apps/api/prisma/schema.prisma` (sin Tenant/Plan); `apps/api/src/auth/auth.service.ts`, auth.controller; `apps/web/src/shared/navigation/config.ts`.

### 3.7 Indicadores accionables (INDICADORES_Y_ACCIONES)

| Entregable del diseño | Componente actual | Estado |
|------------------------|-------------------|--------|
| Productos con pérdida, margen erosionado | No en reportes | Por implementar |
| Proveedores menos competitivos | No | Por implementar |
| Patrones por empleado (ventas por usuario) | Sale sin soldBy; AuditLog entity=sale action=create con actorId | Parcial; requiere soldBy o uso de AuditLog |
| Sin rotación, stock muerto, clientes inactivos, riesgo de caja | reports: inventory (lowStock), dashboard; no sin rotación ni riesgo caja estructurado | Parcial |
| GET /reports/actionable-indicators (insight, action, actionHref) | No | Por implementar |
| Sección “Acciones recomendadas” en dashboard | Dashboard con KPIs; sin bloque de acciones recomendadas | Por implementar |

**Archivos relacionados:** `apps/api/src/reports/reports.service.ts`; `apps/web/src/app/(protected)/app/page.tsx`, `apps/web/src/app/(protected)/reports/page.tsx`.

---

## 4. Matriz de trazabilidad (objetivo ↔ documento ↔ componente)

| Objetivo | Documento | Componente backend | Componente frontend | Estado |
|----------|-----------|--------------------|---------------------|--------|
| O1–O3 Roles, permisos, multi-tenant | ROLES_Y_PERMISOS, schema-roles-permisos, ARQUITECTURA_MODULAR_SAAS | Permission, Role, UserRole, Tenant, PermissionsService, Guards | Nav por permisos, enabledModules en contexto | Diseñado; backend parcial (RoleName) |
| O4–O5 Estados y alertas | ESTADOS_OPERATIVOS_Y_ALERTAS | OperationalStateService o extensión Reports, reglas por estado | Dashboard con alertas y acciones | Parcial (KPIs); sin alerts[] |
| O6–O7 Onboarding | ONBOARDING_UX_DISEÑO | Flag onboarding, opcional endpoint status | Flujo 3 pasos, panel Tu progreso | Por implementar |
| O8–O9 Auditoría completa | AUDITORIA_Y_TRAZABILIDAD | AuditLog + ip, userAgent, severity; hash opcional | Consulta auditoría (existente) | Parcial (log básico) |
| O10–O11 Backup y resiliencia | RESILIENCIA_Y_SINCRONIZACION | BackupsService, GET download, export CSV; cliente: reintentos, cola | Indicador conexión, pendientes | Parcial (backup automático) |
| O12 Módulos por cliente | ARQUITECTURA_MODULAR_SAAS | Plan, Tenant, TenantModule, ModulesGuard, GET /me con modules | Nav por moduleCode | Por implementar |
| O13–O14 Indicadores e IA | INDICADORES_Y_ACCIONES | Reports: productos pérdida, proveedores, empleado; actionable-indicators | Acciones recomendadas, reportes por categoría | Parcial (reportes descriptivos) |

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
