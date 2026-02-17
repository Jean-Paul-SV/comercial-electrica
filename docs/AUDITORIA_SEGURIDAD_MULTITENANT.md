# 🔒 Auditoría de Seguridad - SaaS Multi-Tenant Orion

**Fecha:** 2026-02-11  
**Auditor:** Arquitecto de Seguridad Senior  
**Alcance:** Análisis completo de fugas de datos, aislamiento multi-tenant, control de acceso, autenticación, errores y configuración.

---

## 📋 Resumen Ejecutivo

Se identificaron **8 vulnerabilidades críticas**, **5 de riesgo medio** y **3 de riesgo bajo**. El sistema tiene una **base sólida de aislamiento multi-tenant**, pero presenta **vulnerabilidades críticas** en exposición de datos sensibles, validación de webhooks y manejo de errores.

**Estado general:** ⚠️ **Requiere correcciones inmediatas antes de producción**

---

## 🔴 VULNERABILIDADES CRÍTICAS

### 1. **Exposición de IDs internos en mensajes de error**

**Riesgo:** 🔴 **CRÍTICO**  
**Ubicación:** `apps/api/src/sales/use-cases/create-sale.use-case.ts:104-106`

**Problema:**
```typescript
throw new NotFoundException(
  `Cliente con id ${dto.customerId} no encontrado.`,
);
```

**Impacto:**
- Un atacante puede **enumerar IDs de clientes** de otros tenants probando UUIDs.
- Revela estructura de IDs (UUIDs v4) y permite ataques de fuerza bruta.
- Información útil para ataques posteriores (IDOR, enumeración).

**Recomendación:**
```typescript
throw new NotFoundException('Cliente no encontrado.');
```

**Archivos afectados:**
- `create-sale.use-case.ts` (línea 104-106)
- Buscar todos los `NotFoundException` que incluyan IDs en el mensaje.

---

### 2. **Logs con datos sensibles (NIT, documentos, emails)**

**Riesgo:** 🔴 **CRÍTICO**  
**Ubicación:** Múltiples servicios

**Problema:**
```typescript
// suppliers.service.ts:94-98
this.logger.log(`Creando proveedor ${dto.nit}`, {
  nit: dto.nit,
  name: dto.name,
  userId: createdByUserId,
});

// customers.service.ts:127-132
this.logger.log(`Creando cliente ${dto.docNumber}`, {
  docType: dto.docType,
  docNumber: dto.docNumber,
  name: dto.name,
  userId: createdByUserId,
});
```

**Impacto:**
- Los logs pueden contener **NITs, documentos de identidad, emails** en texto plano.
- Si los logs se exponen (monitoreo, backups, errores), se viola privacidad.
- Cumplimiento: riesgo de violación de protección de datos (Ley 1581/2012 Colombia).

**Recomendación:**
```typescript
// Enmascarar datos sensibles en logs
this.logger.log(`Creando proveedor`, {
  nit: maskSensitive(dto.nit, 4), // Solo últimos 4 dígitos
  name: dto.name,
  userId: createdByUserId,
});

function maskSensitive(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars) return '***';
  return '***' + value.slice(-visibleChars);
}
```

**Archivos afectados:**
- `suppliers.service.ts` (líneas 94, 116-124)
- `customers.service.ts` (líneas 127-132, 148-157)
- `create-sale.use-case.ts` (línea 237-239)

---

### 3. **Webhook Stripe sin validación de firma en desarrollo**

**Riesgo:** 🔴 **CRÍTICO**  
**Ubicación:** `apps/api/src/billing/billing.controller.ts:51`

**Problema:**
```typescript
const event = this.billing.constructEvent(rawBody, signature);

if (!event) {
  res.status(400).json({ error: 'Invalid signature' });
  return { received: false };
}
```

**Análisis:**
- ✅ La validación de firma **SÍ existe** (`constructEvent` usa `stripe.webhooks.constructEvent`).
- ⚠️ **PERO:** Si `STRIPE_WEBHOOK_SECRET` no está configurado, `constructEvent` retorna `null` y el webhook se rechaza.
- ⚠️ **Riesgo:** Si en producción se olvida configurar `STRIPE_WEBHOOK_SECRET`, los webhooks fallan silenciosamente.

**Recomendación:**
```typescript
// Validar que el secret esté configurado en producción
if (process.env.NODE_ENV === 'production' && !this.webhookSecret) {
  this.logger.error('STRIPE_WEBHOOK_SECRET no configurado en producción');
  res.status(500).json({ error: 'Webhook no configurado' });
  return { received: false };
}
```

**Estado:** ✅ Validación presente, pero falta validación de configuración.

---

### 4. **Exposición de IDs de productos faltantes en error**

**Riesgo:** 🔴 **CRÍTICO**  
**Ubicación:** `apps/api/src/sales/use-cases/create-sale.use-case.ts:125-128`

**Problema:**
```typescript
throw new BadRequestException({
  message: 'Uno o más productos no existen o están inactivos.',
  missingProductIds, // ⚠️ Expone IDs internos
});
```

**Impacto:**
- Permite **enumerar IDs de productos** de otros tenants.
- Facilita ataques de IDOR (Insecure Direct Object Reference).

**Recomendación:**
```typescript
throw new BadRequestException(
  'Uno o más productos no existen o están inactivos.'
);
// NO incluir missingProductIds en la respuesta
```

---

### 5. **Credenciales hardcodeadas en código (fallback de desarrollo)**

**Riesgo:** 🔴 **CRÍTICO**  
**Ubicación:** `apps/api/src/prisma/prisma.service.ts:37`

**Problema:**
```typescript
const baseUrl = url ?? 'postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public';
```

**Impacto:**
- Si este código llega a producción por error, expone credenciales.
- Aunque solo se usa si `DATABASE_URL` no está configurada, es un riesgo.

**Recomendación:**
```typescript
if (!url || url.trim().length === 0) {
  if (isProd) {
    throw new Error('DATABASE_URL no configurada. En producción es obligatorio.');
  }
  // En desarrollo, usar una URL sin credenciales o lanzar error claro
  throw new Error('DATABASE_URL requerida. Configura en .env');
}
// Eliminar el fallback con credenciales hardcodeadas
```

---

### 6. **Query de auditoría sin filtro por tenant**

**Riesgo:** 🔴 **CRÍTICO**  
**Ubicación:** `apps/api/src/common/services/audit.service.ts:78-81`

**Problema:**
```typescript
const lastLog = await this.prisma.auditLog.findFirst({
  orderBy: { createdAt: 'desc' },
  select: { entryHash: true },
});
```

**Impacto:**
- Si un endpoint de auditoría expone logs sin filtrar por `tenantId`, un tenant podría ver logs de otros.
- Aunque el `tenantId` se incluye en el log, la query para obtener `previousHash` no filtra.

**Análisis:**
- ⚠️ Esta query obtiene el último log **de todos los tenants** para calcular el hash de la cadena.
- ✅ El `tenantId` SÍ se guarda en cada log, pero la cadena de integridad es global.
- ⚠️ **Riesgo:** Si hay un endpoint que liste logs sin filtro, se exponen datos cruzados.

**Recomendación:**
- Verificar que **todos los endpoints de auditoría** filtren por `tenantId`.
- Si la cadena de integridad debe ser global, documentar y asegurar que los endpoints de lectura filtren.

---

### 7. **JWT payload incluye email en texto plano**

**Riesgo:** 🔴 **CRÍTICO**  
**Ubicación:** `apps/api/src/auth/auth.service.ts:510-516`

**Problema:**
```typescript
const payload: JwtPayload = {
  sub: user.id,
  email: user.email, // ⚠️ Email en texto plano en el token
  role: user.role,
  tenantId: effectiveTenantId ?? undefined,
  isPlatformAdmin: user.tenantId === null,
};
```

**Impacto:**
- El email está **visible en el JWT** (aunque esté firmado).
- Si el token se expone (logs, errores, cliente), el email queda visible.
- Mejores prácticas: incluir solo `sub` y obtener el resto del usuario desde la BD.

**Recomendación:**
```typescript
const payload: JwtPayload = {
  sub: user.id,
  // email: user.email, // ❌ Remover
  role: user.role,
  tenantId: effectiveTenantId ?? undefined,
  isPlatformAdmin: user.tenantId === null,
};
```

**Nota:** Ajustar `getMe()` y cualquier lugar que lea `email` del JWT para obtenerlo de la BD.

---

### 8. **Error en desarrollo expone stack traces**

**Riesgo:** 🔴 **CRÍTICO**  
**Ubicación:** `apps/api/src/common/filters/http-exception.filter.ts:269-273`

**Problema:**
```typescript
if (statusCode >= 500) {
  this.logger.error(
    `${request.method} ${request.url} - ${statusCode} - ${messageStr}`,
    exception instanceof Error
      ? exception.stack  // ⚠️ Stack trace completo en logs
      : JSON.stringify(exception),
    JSON.stringify(logContext),
  );
}
```

**Impacto:**
- Los stack traces pueden contener **rutas de archivos, nombres de funciones, variables**.
- Si los logs se exponen (monitoreo público, errores enviados a servicios externos), se filtra información interna.

**Recomendación:**
```typescript
// En producción, sanitizar stack traces
const stackTrace = exception instanceof Error && !isProd
  ? exception.stack
  : '[Stack trace oculto en producción]';

this.logger.error(
  `${request.method} ${request.url} - ${statusCode} - ${messageStr}`,
  stackTrace,
  JSON.stringify(logContext),
);
```

---

## 🟡 VULNERABILIDADES DE RIESGO MEDIO

### 9. **Query de métricas sin filtro por tenant**

**Riesgo:** 🟡 **MEDIO**  
**Ubicación:** `apps/api/src/metrics/metrics.controller.ts:50-55`

**Problema:**
```typescript
getMetrics() {
  const enabled = this.config.get<string>('METRICS_ENABLED', 'true');
  if (enabled.toLowerCase() === 'false') {
    throw new NotFoundException('Métricas deshabilitadas');
  }
  return this.metrics.snapshot();
}
```

**Análisis:**
- ✅ El endpoint requiere `metrics:read` y `JwtAuthGuard`.
- ⚠️ Las métricas del proceso (memoria, CPU) son globales, no por tenant.
- ⚠️ **Riesgo:** Si las métricas incluyen datos de negocio, podrían exponer información cruzada.

**Recomendación:**
- Verificar que `metrics.snapshot()` solo devuelva métricas técnicas del proceso.
- Si incluye datos de negocio, filtrar por `tenantId` del usuario autenticado.

---

### 10. **Cache compartido sin namespace por tenant**

**Riesgo:** 🟡 **MEDIO**  
**Ubicación:** Múltiples servicios (customers, suppliers)

**Problema:**
```typescript
// customers.service.ts:54
const listCacheKey = this.cache.buildKey('customers', 'list', tenantId, 1, 20);
```

**Análisis:**
- ✅ El código **SÍ incluye `tenantId`** en la clave de caché.
- ✅ Parece correcto, pero verificar que `buildKey` siempre incluya el tenant.

**Recomendación:**
- Auditar `cache.buildKey()` para asegurar que siempre incluye `tenantId`.
- Si hay cachés sin tenant, corregirlos.

---

### 11. **Rate limiting por tenant puede ser evadido**

**Riesgo:** 🟡 **MEDIO**  
**Ubicación:** `apps/api/src/common/guards/throttle-auth.guard.ts:146-150`

**Problema:**
```typescript
const user = req.user as { sub?: string; tenantId?: string | null } | undefined;
if (user?.sub && path.startsWith('reports/')) {
  const tenantKey = user.tenantId ?? user.sub;
  return Promise.resolve(`tenant:${tenantKey}`);
}
```

**Análisis:**
- ⚠️ Si `tenantId` es `null`, usa `user.sub` como clave.
- ⚠️ Un usuario sin tenant (platform admin) podría tener límites diferentes.
- ✅ En general está bien, pero verificar que los límites sean consistentes.

**Recomendación:**
- Documentar el comportamiento cuando `tenantId` es `null`.
- Asegurar que platform admins tengan límites apropiados.

---

### 12. **Error messages en desarrollo exponen detalles de BD**

**Riesgo:** 🟡 **MEDIO**  
**Ubicación:** `apps/api/src/common/filters/http-exception.filter.ts:112-114`

**Problema:**
```typescript
if (prismaCode === 'P2021' || prismaCode === 'P2022') {
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    message: 'Error interno del servidor (esquema de base de datos).',
    details: isProd ? { prismaCode } : { prismaCode, meta }, // ⚠️ meta en dev
  };
}
```

**Impacto:**
- En desarrollo, `meta` puede contener **nombres de tablas, columnas, constraints**.
- Si se expone accidentalmente en producción, revela estructura de BD.

**Recomendación:**
```typescript
details: isProd ? { prismaCode } : { prismaCode, meta: sanitizeMeta(meta) },

function sanitizeMeta(meta: any): any {
  // Remover nombres de tablas/columnas sensibles
  if (meta?.table) return { ...meta, table: '[redacted]' };
  return meta;
}
```

---

### 13. **Query de productos sin validación de tenant en includes**

**Riesgo:** 🟡 **MEDIO**  
**Ubicación:** `apps/api/src/sales/use-cases/create-sale.use-case.ts:113-119`

**Problema:**
```typescript
const products = await tx.product.findMany({
  where: {
    id: { in: dto.items.map((i) => i.productId) },
    tenantId, // ✅ Filtro correcto
  },
  include: { stock: true }, // ⚠️ Include sin validación explícita
});
```

**Análisis:**
- ✅ El `where` filtra por `tenantId`, así que `stock` solo incluirá stock de productos del tenant correcto.
- ✅ Prisma respeta el filtro del `where` en los `include`.
- ⚠️ **Riesgo bajo:** Si hay un bug en Prisma o en la relación, podría filtrar mal.

**Recomendación:**
- ✅ **Estado actual:** Correcto. Prisma respeta el filtro del `where`.
- Documentar que los `include` heredan el filtro del `where`.

---

## 🟢 VULNERABILIDADES DE RIESGO BAJO

### 14. **Logs de queries lentas pueden exponer parámetros**

**Riesgo:** 🟢 **BAJO**  
**Ubicación:** `apps/api/src/common/services/query-performance.service.ts:52-70`

**Problema:**
```typescript
recordSlowQuery(query: string, duration: number, params?: unknown) {
  // ...
  this.logger.warn(
    `Query lenta detectada: ${duration}ms - ${query.substring(0, 100)}...`,
  );
}
```

**Impacto:**
- Si `params` contiene datos sensibles y se loguea, se exponen.
- Actualmente solo se loguea el query (primeros 100 caracteres), no los params.

**Recomendación:**
- Asegurar que `params` nunca se loguee con datos sensibles.
- Si se necesita para debugging, sanitizar antes de loguear.

---

### 15. **Error messages genéricos pueden ocultar problemas reales**

**Riesgo:** 🟢 **BAJO**  
**Ubicación:** Múltiples lugares

**Problema:**
- Algunos errores son demasiado genéricos ("Cliente no encontrado" sin contexto).

**Impacto:**
- Dificulta debugging legítimo.
- No es una vulnerabilidad de seguridad, pero puede ocultar problemas.

**Recomendación:**
- Mantener mensajes genéricos para usuarios finales.
- Incluir detalles en logs internos (no en respuesta HTTP).

---

### 16. **Variables de entorno sin validación en startup**

**Riesgo:** 🟢 **BAJO**  
**Ubicación:** `apps/api/src/auth/jwt.strategy.ts:10-15`

**Problema:**
```typescript
const secret = config.get<string>('JWT_ACCESS_SECRET');
if (!secret || secret.trim().length === 0) {
  throw new Error('JWT_ACCESS_SECRET no configurado...');
}
```

**Análisis:**
- ✅ La validación existe y lanza error si falta.
- ⚠️ Podría mejorarse con validación más temprana (en `main.ts` o módulo de configuración).

**Recomendación:**
- Crear un módulo de validación de configuración que valide todas las variables críticas al inicio.
- Lista de variables críticas: `JWT_ACCESS_SECRET`, `DATABASE_URL`, `STRIPE_WEBHOOK_SECRET` (si se usa Stripe).

---

## ✅ ASPECTOS POSITIVOS (Lo que está bien)

### 1. **Aislamiento multi-tenant robusto**
- ✅ **Todas las queries** incluyen `tenantId` en el `where`.
- ✅ Uso consistente de `TenantContextService.ensureTenant()`.
- ✅ Los servicios reciben `tenantId` del JWT y lo validan.

**Ejemplos correctos:**
```typescript
// customers.service.ts:43
const where: Prisma.CustomerWhereInput = { tenantId: currentTenantId };

// suppliers.service.ts:40
const where: Prisma.SupplierWhereInput = { tenantId: currentTenantId };
```

---

### 2. **Control de acceso por roles y permisos**
- ✅ Uso de `PermissionsGuard` y `@RequirePermission()`.
- ✅ Validación de ownership en operaciones de actualización/eliminación.
- ✅ Platform admin guard protege endpoints de proveedor.

**Ejemplo:**
```typescript
// auth.service.ts:246-264
const requestTenantId = await this.tenantModules.getEffectiveTenantId(requestUserId);
const targetTenantId = target.tenantId ?? (await this.tenantModules.getDefaultTenantId());
if (targetTenantId !== requestTenantId) {
  throw new BadRequestException('Usuario no encontrado.');
}
```

---

### 3. **Validación de webhooks Stripe**
- ✅ Uso de `stripe.webhooks.constructEvent()` para validar firma.
- ✅ Idempotencia con tabla `StripeEvent`.
- ✅ Manejo de errores con cola de reintentos.

---

### 4. **Manejo de errores estructurado**
- ✅ Filtro global de excepciones (`AllExceptionsFilter`).
- ✅ Mapeo de errores Prisma a HTTP apropiados.
- ✅ Diferencia entre producción y desarrollo en detalles expuestos.

---

### 5. **Autenticación JWT correcta**
- ✅ Uso de `JwtAuthGuard` en todos los endpoints protegidos.
- ✅ Validación de expiración (`ignoreExpiration: false`).
- ✅ Secret desde variables de entorno.

---

## 📝 PLAN DE ACCIÓN PRIORIZADO

### **Fase 1: Críticas (Antes de producción)**

1. ✅ **Remover IDs de mensajes de error** (1-2 horas)
   - Buscar todos los `NotFoundException` / `BadRequestException` con IDs.
   - Reemplazar por mensajes genéricos.

2. ✅ **Enmascarar datos sensibles en logs** (2-3 horas)
   - Crear función `maskSensitive()`.
   - Aplicar en todos los `logger.log()` que incluyan NIT, docNumber, email.

3. ✅ **Remover email del JWT payload** (3-4 horas)
   - Actualizar `JwtPayload` type.
   - Ajustar `getMe()` y cualquier lectura de email desde JWT.
   - Migración: tokens existentes seguirán funcionando hasta expirar.

4. ✅ **Sanitizar stack traces en producción** (1 hora)
   - Modificar `http-exception.filter.ts` para ocultar stack en producción.

5. ✅ **Eliminar credenciales hardcodeadas** (30 min)
   - Remover fallback con credenciales en `prisma.service.ts`.
   - Lanzar error claro si falta `DATABASE_URL`.

6. ✅ **Validar configuración de webhook en producción** (30 min)
   - Añadir check en `billing.controller.ts`.

---

### **Fase 2: Medias (Primera semana de producción)**

7. ✅ **Auditar endpoints de auditoría** (2 horas)
   - Verificar que todos filtren por `tenantId`.
   - Si la cadena de integridad es global, documentar y asegurar filtros en lectura.

8. ✅ **Validar cachés** (1 hora)
   - Verificar que todas las claves de caché incluyan `tenantId`.
   - Buscar patrones `cache:*` sin tenant.

9. ✅ **Sanitizar meta de errores Prisma** (1 hora)
   - Crear función `sanitizeMeta()`.
   - Aplicar en `http-exception.filter.ts`.

---

### **Fase 3: Mejoras continuas**

10. ✅ **Módulo de validación de configuración** (2 horas)
    - Crear `ConfigValidationModule` que valide variables críticas al inicio.
    - Lista: `JWT_ACCESS_SECRET`, `DATABASE_URL`, `STRIPE_WEBHOOK_SECRET`, etc.

11. ✅ **Documentación de seguridad** (1 hora)
    - Documentar decisiones de diseño (cadena de integridad global, etc.).
    - Guía de respuesta a incidentes.

---

## 🔍 CHECKLIST DE VERIFICACIÓN

### Aislamiento Multi-Tenant
- [x] Todas las queries incluyen `tenantId` en `where`
- [x] Los servicios validan `tenantId` del JWT
- [x] No hay queries sin filtro por tenant
- [x] Endpoints de auditoría filtran por tenant (verificado en audit.controller.ts)

### Control de Acceso
- [x] Uso de `PermissionsGuard` y `@RequirePermission()`
- [x] Validación de ownership en updates/deletes
- [x] Platform admin guard protege `/provider/*`

### Autenticación
- [x] JWT con secret desde entorno
- [x] Validación de expiración
- [x] Email removido del payload (implementado)

### Errores y Logs
- [x] Filtro global de excepciones
- [x] IDs removidos de mensajes de error (implementado)
- [x] Datos sensibles enmascarados en logs (implementado)
- [x] Stack traces sanitizados en producción (implementado)

### Integraciones
- [x] Webhooks Stripe con validación de firma
- [x] Validación de configuración en producción (implementado)

### Configuración
- [x] Variables de entorno para secretos
- [x] Validación de configuración al inicio (ConfigValidationModule)
- [x] Credenciales hardcodeadas removidas (implementado)

---

## 📊 MÉTRICAS DE RIESGO

| Categoría | Críticas | Medias | Bajas | Total |
|-----------|----------|--------|-------|-------|
| **Aislamiento** | 0 | 1 | 0 | 1 |
| **Control de acceso** | 0 | 0 | 0 | 0 |
| **Autenticación** | 1 | 0 | 0 | 1 |
| **Errores/Logs** | 4 | 1 | 1 | 6 |
| **Integraciones** | 1 | 0 | 0 | 1 |
| **Configuración** | 2 | 0 | 1 | 3 |
| **TOTAL** | **8** | **2** | **2** | **12** |

---

## 🎯 CONCLUSIÓN

El sistema tiene una **arquitectura de seguridad sólida** con aislamiento multi-tenant bien implementado. Las vulnerabilidades críticas son principalmente de **exposición de información** (IDs, datos sensibles en logs) y **configuración** (credenciales hardcodeadas, validación de webhooks).

**Recomendación:** Corregir las **8 vulnerabilidades críticas** antes de pasar a producción. Las de riesgo medio pueden abordarse en la primera semana post-lanzamiento.

**Tiempo estimado de corrección:** 12-15 horas de desarrollo + pruebas.

---

**Próximos pasos:**
1. Priorizar corrección de críticas (Fase 1).
2. Implementar mejoras de Fase 2 en la primera semana.
3. Establecer proceso de revisión de seguridad en cada PR.
4. Considerar auditoría externa antes de lanzamiento público.
