# Auditoría de Seguridad Técnica — Orion SaaS

**Proyecto:** Orion (Comercial Eléctrica)  
**Stack:** Next.js (App Router), React, API REST (NestJS), PostgreSQL, multi-tenant, JWT, facturación electrónica DIAN  
**Fecha:** Febrero 2025  
**Alcance:** API backend, autenticación, autorización, multi-tenant, fugas de datos, vulnerabilidades comunes, optimización y configuración de producción.

---

## Resumen ejecutivo

La auditoría revisó autenticación (JWT), autorización (guards, permisos), aislamiento multi-tenant, manejo de errores y datos sensibles, uso de Prisma (raw queries, middleware), rate limiting, CORS, headers de seguridad y exposición de Swagger. Se identificaron hallazgos en varios niveles; ninguno crítico de explotación directa, pero sí mejoras importantes para hardening en entorno SaaS empresarial con datos sensibles (facturación electrónica).

---

## 1. Autenticación y autorización

### 1.1 ✅ JWT — Validación y expiración

- **Estado:** Correcto.
- **Detalle:** `jwt.strategy.ts` usa `ignoreExpiration: false`, secreto desde `JWT_ACCESS_SECRET` y payload con `sub`, `role`, `tenantId`, `isPlatformAdmin`. No se encontró bypass de expiración.
- **Recomendación:** Mantener; asegurar que `JWT_ACCESS_SECRET` sea fuerte y único en producción (no por defecto de env).

### 1.2 ⚠️ Rate limiting en desarrollo desactivado

- **Severidad:** Bajo  
- **Riesgo:** En desarrollo no hay límite en login/forgot-password; en producción sí (ThrottleAuthGuard).
- **Código:** `apps/api/src/common/guards/throttle-auth.guard.ts` — `if (process.env.NODE_ENV !== 'production') return true;`
- **Recomendación:** Opcional: en dev aplicar límites más altos en lugar de desactivar por completo, para detectar dependencias incorrectas antes de subir a producción.

### 1.3 ✅ Endpoints sensibles protegidos

- Login, forgot-password, reset-password, accept-invite, bootstrap-admin están sin JwtAuthGuard pero con Throttler (límites por IP o por email según endpoint).
- Resto de rutas usan `JwtAuthGuard` y, donde aplica, `PermissionsGuard` / `ModulesGuard` / `PlatformAdminGuard`.

### 1.4 ✅ Separación autenticación / autorización

- Autenticación: JWT Strategy + Guard. Autorización: `PermissionsGuard` (permisos), `ModulesGuard` (módulos por tenant), `PlatformAdminGuard` (solo plataforma). Roles y permisos se validan en backend.

### 1.5 ✅ Respuestas de usuario sin datos sensibles

- `getMe` usa `select` sin `passwordHash`. Login y otros flujos que necesitan verificar contraseña usan `select: { ..., passwordHash: true }` solo en ese flujo y no exponen el hash.

### 1.6 ✅ IDOR en recursos por tenant

- Revisados: ventas (`findFirst` con `id` + `tenantId`), backups (`getBackup` valida `backup.tenantId === tenantId` tras cargar), usuarios (update/delete comprueban `targetTenantId === requestTenantId`). No se detectó IDOR en los puntos revisados.
- **Recomendación:** Mantener patrón: siempre filtrar o validar por `tenantId` (o equivalente) en servicio al acceder por `id`.

---

## 2. Riesgo multi-tenant

### 2.1 ⚠️ Middleware de auditoría tenant solo advierte

- **Severidad:** Medio  
- **Riesgo:** Queries sobre modelos con alcance por tenant sin `tenantId` en `where` solo generan un warning en logs; no se bloquean.
- **Código:** `apps/api/src/prisma/tenant-query-audit.middleware.ts` — `logger.warn(...)` y luego `next(params)`.
- **Solución:**  
  - Opción A (recomendada): En producción, si el request tiene `tenantId` y la acción es sobre un modelo en `TENANT_SCOPED_MODELS` sin `tenantId` en `where`, lanzar una excepción (p. ej. `ForbiddenException`) en lugar de solo advertir.  
  - Opción B: Revisar todos los usos de `findMany`/`findFirst`/`updateMany`/`deleteMany` sobre esos modelos y asegurar que siempre incluyan `tenantId`; después se puede mantener solo el warning como red de seguridad.

### 2.2 ✅ Tenant en contexto de request

- `TenantContextInterceptor` rellena `req.user.tenantId` desde BD cuando viene en el JWT; el orden con `AuditContextInterceptor` permite que el contexto de auditoría tenga `tenantId` correcto.

### 2.3 ✅ Listados y get por recurso

- Servicios revisados (ventas, clientes, catálogo, reportes, usage, backups) reciben `tenantId` (desde controller) y lo usan en `where` o en raw con parámetros (`${tenantId}::uuid`). Raw queries usan `Prisma.sql` parametrizado, no concatenación.

### 2.4 Recomendación defensa en profundidad (backups)

- `getBackup(id, tenantId)` hace `findFirst({ where: { id, deletedAt: null } })` y luego comprueba `backup.tenantId === tenantId`. Funcionalmente correcto; para defensa en profundidad se puede filtrar en la query cuando hay `tenantId`:  
  `where: { id, deletedAt: null, ...(tenantId ? { tenantId, scope: 'TENANT' } : {}) }`  
  Así no se carga en BD un registro de otro tenant.

---

## 3. Fuga de datos

### 3.1 ✅ Errores y stack traces

- **Estado:** Correcto.  
- `AllExceptionsFilter` no envía `stack` al cliente; en producción sanitiza metadatos Prisma con `sanitizePrismaMeta`. El stack se usa solo en logs del servidor.

### 3.2 ✅ Sanitización de metadatos Prisma

- `sanitize.util.ts` redacta `table`, `column_name` y `target` en respuestas de error. Uso consistente en el filtro global de excepciones.

### 3.3 ✅ Variables de entorno

- Validación en `env.validation.ts`; no se exponen env al cliente. `JWT_REFRESH_SECRET` y `ALLOWED_ORIGINS` requeridos/recomendados en producción.

### 3.4 ✅ Enmascaramiento en logs

- `maskSensitive` y `maskEmail` usados en servicios (p. ej. suppliers, customers) para no loguear datos sensibles completos.

### 3.5 Recomendación

- Revisar cualquier nuevo endpoint que devuelva entidades (User, DianConfig, etc.) y asegurar que nunca incluyan `passwordHash`, tokens, o secretos en el JSON.

---

## 4. Vulnerabilidades comunes

### 4.1 ✅ SQL Injection

- Uso de `Prisma.sql` con parámetros (p. ej. `tenantId`, límites, fechas) en reports, usage, catalog, health-monitor. No se encontró concatenación de entrada de usuario en SQL.

### 4.2 ✅ XSS / inyección en respuestas

- API REST devuelve JSON; no se generan HTML desde entrada de usuario. El front (Next.js/React) debe seguir escapando/sanitizando en UI; no forma parte de esta auditoría de API.

### 4.3 CSRF

- API es consumida por SPA con JWT en header (Bearer). Si los tokens no se envían en cookies, el riesgo CSRF clásico es bajo. Si en el futuro se usan cookies para el token, habría que añadir protección CSRF (token en header/cookie SameSite, etc.).

### 4.4 ✅ Validación de entrada

- `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true` reduce mass assignment y campos inesperados.

### 4.5 ✅ Rate limiting

- Login, forgot-password, bootstrap, reset-password, accept-invite y endpoints costosos (reportes, export, DIAN, backups, bulk) con límites por IP o por tenant en producción. ThrottleAuthGuard solo aplica en `NODE_ENV === 'production'`.

### 4.6 ✅ CORS

- En producción se exige `ALLOWED_ORIGINS`; en main.ts se valida y se rechaza origen no permitido. En desarrollo se permite cualquier origen.

### 4.7 ⚠️ Swagger en producción

- **Severidad:** Medio (informativo)  
- **Riesgo:** `/api/docs` está montado siempre; en producción expone estructura de la API y facilita reconocimiento.
- **Solución:**  
  - Desactivar Swagger en producción:  
    `if (process.env.NODE_ENV !== 'production') { SwaggerModule.setup('api/docs', app, document, ...); }`  
  - O proteger la ruta (p. ej. IP allowlist, auth básica o VPN) si se necesita documentación en prod.

---

## 5. Optimización

### 5.1 Queries N+1

- No se realizó un barrido exhaustivo de todos los listados. En los servicios revisados se usan `include`/`select` y en algunos reportes se usan raw queries agregadas. Recomendación: en listados grandes (ventas, movimientos, reportes) revisar que no haya bucles que ejecuten una query por ítem; usar `include` o queries agregadas cuando sea posible.

### 5.2 Índices

- El schema de Prisma no fue auditado índice por índice. Para multi-tenant y reportes es importante tener índices compuestos donde se filtra por `tenantId` + fecha o estado (p. ej. `(tenantId, createdAt)`, `(tenantId, status)` en tablas grandes). Recomendación: revisar índices en `schema.prisma` para tablas como Sale, Invoice, InventoryMovement, AuditLog, BackupRun y añadir los que falten según patrones de consulta.

### 5.3 Caché

- No se revisó una estrategia global de caché (Redis ya está en el stack). Para reportes pesados o datos que cambien poco (catálogo, planes), considerar TTL corto por tenant para reducir carga en BD.

### 5.4 Next.js / frontend

- Fuera del alcance de esta auditoría de API. Recomendación general: usar `revalidate` o fetch con caché donde tenga sentido y evitar re-renders innecesarios en listados.

---

## 6. Configuración de producción

### 6.1 ✅ NODE_ENV

- Lógica condicional usa `process.env.NODE_ENV === 'production'` para CORS, throttle, sanitización de errores y headers. Asegurar que en despliegue real se configure `NODE_ENV=production`.

### 6.2 ✅ Headers de seguridad

- En main.ts se configuran (según entorno y solicitud):  
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, y en producción con HTTPS `Strict-Transport-Security`.  
  Revisar que el proxy (Render/Vercel/nginx) no quite estos headers y que HTTPS esté habilitado.

### 6.3 HTTPS

- HSTS se aplica cuando `isProd && req.secure`. Asegurar que el front y la API se sirvan solo por HTTPS en producción y que `ALLOWED_ORIGINS` use `https://`.

---

## 7. Lista de hallazgos por severidad

| ID | Hallazgo | Severidad | Acción recomendada |
|----|----------|-----------|---------------------|
| H1 | Middleware tenant solo advierte, no bloquea queries sin tenantId | Medio | Bloquear en prod o corregir todas las queries y dejar solo warning |
| H2 | Swagger disponible en producción | Medio | Desactivar en prod o proteger la ruta |
| H3 | Rate limiting desactivado en desarrollo | Bajo | Opcional: límites altos en dev |
| H4 | getBackup no filtra por tenantId en la query (solo post-lectura) | Bajo | Añadir tenantId/scope en where cuando hay tenantId |

---

## 8. Recomendaciones de hardening

1. **Multi-tenant:** Activar bloqueo en el middleware de auditoría de tenant en producción (o eliminar cualquier query sin `tenantId` en modelos acotados).  
2. **Documentación:** No exponer `/api/docs` en producción o protegerla.  
3. **Secrets:** Rotar `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` si alguna vez pudieron quedar expuestos; usar secretos fuertes y únicos por entorno.  
4. **Backups/archivos:** Asegurar que las rutas de almacenamiento de backups y facturas no sean accesibles por path traversal (Express static suele mitigarlo; validar que los controladores que sirven archivos comprueben siempre tenant/permiso).  
5. **Auditoría:** Mantener y revisar logs del middleware tenant para detectar nuevos usos sin `tenantId`.  
6. **Índices y N+1:** Revisar schema e índices para tablas críticas por tenant y optimizar listados/reportes que puedan generar N+1.

---

## Anexo A — Ejemplos de implementación

### A.1 Bloquear queries sin tenantId en producción (middleware Prisma)

En `apps/api/src/prisma/tenant-query-audit.middleware.ts`, sustituir el aviso por un fallo en producción:

```ts
if (!hasTenantIdInWhere(params.args)) {
  const msg = `Query sin tenantId: model=${params.model} action=${params.action} requestTenantId=${requestTenantId}`;
  if (process.env.NODE_ENV === 'production') {
    const { ForbiddenException } = require('@nestjs/common');
    throw new ForbiddenException('Operación no permitida: falta alcance por tenant.');
  }
  logger.warn(`${msg}. Revisar aislamiento multi-tenant.`);
}
```

Asegurarse de que todas las queries sobre `TENANT_SCOPED_MODELS` incluyan `tenantId` en `where` antes de activar el bloqueo.

### A.2 Desactivar Swagger en producción

En `apps/api/src/main.ts`, envolver la configuración de Swagger:

```ts
if (process.env.NODE_ENV !== 'production') {
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
  console.log(`📚 Documentación Swagger: http://localhost:${process.env.PORT ?? 3000}/api/docs`);
}
```

### A.3 Defensa en profundidad en getBackup (backups.service.ts)

```ts
async getBackup(id: string, tenantId?: string | null) {
  const where: { id: string; deletedAt: null; tenantId?: string; scope?: 'TENANT' } = {
    id,
    deletedAt: null,
  };
  if (typeof tenantId === 'string' && tenantId.trim() !== '') {
    where.tenantId = tenantId;
    where.scope = 'TENANT';
  }
  const backup = await this.prisma.backupRun.findFirst({ where });
  if (!backup) throw new NotFoundException(`Backup ${id} no encontrado`);
  return backup;
}
```

---

## 9. Conclusión

El proyecto aplica buenas prácticas en JWT, validación de entrada, CORS, rate limiting en producción, manejo de errores y sanitización de respuestas. Los puntos a reforzar son el aislamiento multi-tenant (bloqueo o corrección de queries sin tenant) y la exposición de Swagger en producción. Con las correcciones propuestas, el nivel de seguridad es adecuado para un SaaS empresarial con facturación electrónica, manteniendo revisión periódica de nuevos endpoints y modelos.
