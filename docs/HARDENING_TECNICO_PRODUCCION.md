# Hardening técnico para producción — SaaS multi-tenant

**Rol:** CTO externo / Auditor técnico senior  
**Criterio:** Sistema con clientes pagos; evaluación práctica, no teórica.  
**Fecha:** Febrero 2026.

---

## Evaluación global del producto

**Nivel actual:** **Early SaaS** (camino a Production-ready)  
**Estado:** Base sólida con riesgos críticos identificables y corregibles en 1–2 semanas.  
**Recomendación:** Corregir críticos y altos antes de escalar clientes pagos.

**Qué NO necesitas ahora:**
- Microservicios
- Kubernetes avanzado
- Service mesh
- Monitoreo distribuido (tracing)
- Multi-región

**Qué SÍ debes hacer antes de escalar:**
- ✅ Cerrar fugas multi-tenant (getStats, getDashboard, reportes) — **Hecho**
- ✅ Rate limiting real en producción — **Hecho**
- ✅ Idempotencia en webhooks Stripe (tabla StripeEvent; ejecutar migración en cada entorno) — **Hecho**
- ✅ Tests E2E de flujos críticos (suite 11/11, 55 tests con tenant) — **Hecho**
- Alertas básicas operativas — Pendiente

**Riesgos técnicos a 3–6 meses:**
- Escalado de datos (auditoría, reportes) sin estrategia de archivado
- Dependencias desactualizadas (vulnerabilidades)
- Crecimiento de deuda técnica si no se refactoriza ReportsService

---

# Sprint 1 — Cierre de riesgos críticos (obligatorio)

**Estado de implementación (feb 2026):** Los ítems C1, C2, C3, C4, A1 y A2 del Sprint 1 están **implementados**. GET /stats filtra por tenantId (o platform admin con ?tenantId=); reportes (dashboard, operational-state, sales, inventory, cash, customers, export, actionable-indicators, etc.) exigen y filtran por tenantId; rate limiting activo en producción (login, forgot-password, reports); CORS exige ALLOWED_ORIGINS en producción; webhook Stripe con idempotencia (tabla StripeEvent; migración pendiente de ejecutar en cada entorno); PermissionsGuard en cash, sales y expenses. Suite E2E (11 suites, 55 tests) pasa con tenant y módulos. Ver `QUE_FALTA_DESPUES_SPRINT1.md` para pendientes (ej. ejecutar migración StripeEvent).

---

## 🔴 Críticos

### C1: GET /stats devuelve datos globales (fuga multi-tenant) — ✅ IMPLEMENTADO

**Hallazgo:**
```typescript
// apps/api/src/app.service.ts:103-171
async getStats() {
  const totalUsers = await this.prisma.user.count(); // ❌ Sin tenantId
  const totalProducts = await this.prisma.product.count({ where: { isActive: true } }); // ❌ Sin tenantId
  const totalCustomers = await this.prisma.customer.count(); // ❌ Sin tenantId
  const totalSales = await this.prisma.sale.count({ where: { status: 'PAID' } }); // ❌ Sin tenantId
  // ...
}
```

**Impacto:** Cualquier usuario con permiso `reports:read` ve conteos de TODOS los tenants (usuarios, productos, clientes, ventas globales).

**Acción inmediata:**
1. Modificar `AppController.getStats()` para recibir `@Req() req` y extraer `req.user.tenantId`.
2. Modificar `AppService.getStats(tenantId?: string | null)` para filtrar TODOS los `count()` y `aggregate()` por `tenantId`.
3. Si el endpoint debe ser solo para platform admin, añadir `@UseGuards(PlatformAdminGuard)` y quitar `@RequirePermission('reports:read')`.
4. Actualizar Swagger: documentar que requiere platform admin o que devuelve stats del tenant del usuario.

**Código de corrección:**
```typescript
// app.controller.ts
@Get('stats')
@UseGuards(JwtAuthGuard, PermissionsGuard, PlatformAdminGuard) // O mantener reports:read pero filtrar por tenant
@RequirePermission('reports:read')
getStats(@Req() req: { user?: { tenantId?: string } }) {
  return this.appService.getStats(req.user?.tenantId);
}

// app.service.ts
async getStats(tenantId?: string | null) {
  if (!tenantId) throw new ForbiddenException('Tenant requerido');
  const [
    totalUsers,
    totalProducts,
    totalCustomers,
    totalSales,
    // ...
  ] = await Promise.all([
    this.prisma.user.count({ where: { tenantId } }),
    this.prisma.product.count({ where: { tenantId, isActive: true } }),
    this.prisma.customer.count({ where: { tenantId } }),
    this.prisma.sale.count({ where: { tenantId, status: 'PAID' } }),
    // ...
  ]);
  // ...
}
```

**Tiempo estimado:** 2–3 horas  
**Prioridad:** Bloquea producción con clientes pagos.

---

### C2: GET /reports/dashboard devuelve datos globales (fuga multi-tenant) — ✅ IMPLEMENTADO

**Hallazgo:**
```typescript
// apps/api/src/reports/reports.service.ts:609-755
async getDashboard() {
  // ...
  const todaySales = await this.prisma.sale.findMany({
    where: { status: 'PAID', soldAt: { gte: todayStart, lt: todayEnd } }, // ❌ Sin tenantId
  });
  const totalProducts = await this.prisma.product.count({
    where: { isActive: true }, // ❌ Sin tenantId
  });
  const totalCustomers = await this.prisma.customer.count(); // ❌ Sin tenantId
  const openCashSessions = await this.prisma.cashSession.findMany({
    where: { closedAt: null }, // ❌ Sin tenantId
  });
  // ...
}
```

**Impacto:** Dashboard muestra datos de TODOS los tenants.

**Acción inmediata:**
1. Modificar `ReportsController.getDashboard()` para recibir `@Req() req` y extraer `tenantId`.
2. Modificar `ReportsService.getDashboard(tenantId: string)` para filtrar TODAS las consultas por `tenantId`.
3. Actualizar clave de caché: `cache:dashboard:${tenantId}` en lugar de `cache:dashboard:main`.

**Código de corrección:**
```typescript
// reports.controller.ts
@Get('dashboard')
getDashboard(@Req() req: { user?: { tenantId?: string } }) {
  if (!req.user?.tenantId) throw new ForbiddenException('Tenant requerido');
  return this.reportsService.getDashboard(req.user.tenantId);
}

// reports.service.ts
async getDashboard(tenantId: string) {
  return this.wrapReport(async () => {
    const cacheKey = this.cache.buildKey('dashboard', tenantId);
    // ...
    const todaySales = await this.prisma.sale.findMany({
      where: { tenantId, status: 'PAID', soldAt: { gte: todayStart, lt: todayEnd } },
    });
    const totalProducts = await this.prisma.product.count({
      where: { tenantId, isActive: true },
    });
    // ... filtrar TODAS las consultas por tenantId
  });
}
```

**Tiempo estimado:** 2–3 horas  
**Prioridad:** Bloquea producción con clientes pagos.

---

### C3: Rate limiting desactivado en producción (excepto forgot-password) — ✅ IMPLEMENTADO

**Hallazgo:**
```typescript
// apps/api/src/common/guards/throttle-auth.guard.ts:12-26
async canActivate(context: ExecutionContext): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true;
  const isForgotPassword = /* ... */;
  if (!isForgotPassword) {
    return true; // ❌ Pasa sin límite
  }
  return super.canActivate(context);
}
```

**Impacto:** Sin protección contra:
- Fuerza bruta en login (POST /auth/login)
- Scraping masivo de reportes/listados
- DoS por endpoints costosos (reportes, export)

**Acción inmediata:**
1. Activar rate limit por IP en POST /auth/login (p. ej. 10 req/min por IP).
2. Activar rate limit por usuario autenticado en endpoints costosos (GET /reports/*, GET /reports/export).
3. Mantener bypass en desarrollo.

**Código de corrección:**
```typescript
// throttle-auth.guard.ts
async canActivate(context: ExecutionContext): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return true;
  const req = context.switchToHttp().getRequest<{ method?: string; url?: string; originalUrl?: string; user?: { sub?: string } }>();
  const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
  const normalizedPath = path.replace(/^\/+/, '') || '/';
  
  // Login: límite por IP
  const isLogin = req.method === 'POST' && normalizedPath === 'auth/login';
  if (isLogin) {
    return super.canActivate(context); // Usa IP del getTracker
  }
  
  // Forgot password: límite por email
  const isForgotPassword = req.method === 'POST' && normalizedPath === 'auth/forgot-password';
  if (isForgotPassword) {
    return super.canActivate(context);
  }
  
  // Reportes y export: límite por usuario autenticado
  const isExpensiveReport = req.method === 'GET' && (
    normalizedPath.startsWith('reports/') ||
    normalizedPath === 'reports/export'
  );
  if (isExpensiveReport && req.user?.sub) {
    return super.canActivate(context); // Usa userId del getTracker
  }
  
  // Resto: sin límite (navegación normal)
  return true;
}

protected getTracker(req: Record<string, unknown>): Promise<string> {
  // Login: por IP
  if (/* es login */) {
    return Promise.resolve(req.ip || 'unknown');
  }
  // Forgot: por email
  if (/* es forgot-password */) {
    const email = /* ... */;
    return Promise.resolve(`forgot:${email}`);
  }
  // Reportes: por userId
  const user = req.user as { sub?: string } | undefined;
  if (user?.sub) {
    return Promise.resolve(`user:${user.sub}`);
  }
  // Default: por IP
  return Promise.resolve(req.ip || 'unknown');
}
```

**Configuración ThrottlerModule (ajustar límites):**
```typescript
// app.module.ts
ThrottlerModule.forRoot([
  { name: 'login', ttl: 60000, limit: 10 }, // 10/min por IP
  { name: 'forgot', ttl: 900000, limit: 3 }, // 3/15min por email
  { name: 'reports', ttl: 60000, limit: 30 }, // 30/min por usuario
  // ...
])
```

**Tiempo estimado:** 4–6 horas  
**Prioridad:** Alto riesgo de abuso sin esto.

---

### C4: CORS permite cualquier origen si ALLOWED_ORIGINS está vacío — ✅ IMPLEMENTADO

**Hallazgo:**
```typescript
// apps/api/src/main.ts:69-80
const corsOrigin = isProd && allowedOrigins.length > 0
  ? (origin, callback) => { /* valida */ }
  : true; // ❌ En prod sin ALLOWED_ORIGINS, permite TODO
```

**Impacto:** En producción sin `ALLOWED_ORIGINS`, cualquier sitio puede hacer requests con credenciales (cookies/tokens) si el usuario está autenticado.

**Acción inmediata:**
1. En producción, si `ALLOWED_ORIGINS` está vacío, lanzar error al arrancar o usar un default seguro (ej. solo el dominio del frontend conocido).
2. Documentar en `.env.example` y guía de despliegue que `ALLOWED_ORIGINS` es obligatorio en producción.

**Código de corrección:**
```typescript
// main.ts
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (isProd && allowedOrigins.length === 0) {
  throw new Error(
    'ALLOWED_ORIGINS debe estar configurado en producción. Ejemplo: ALLOWED_ORIGINS=https://app.tudominio.com,https://admin.tudominio.com'
  );
}

const corsOrigin = isProd
  ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        return callback(null, false);
      }
      const normalized = origin.trim().replace(/\/$/, '');
      const allowed = allowedOrigins.some((o) => o === normalized);
      callback(null, allowed);
    }
  : true; // Dev: permitir todo
```

**Tiempo estimado:** 30 minutos  
**Prioridad:** Riesgo de CSRF/abuso si no se corrige.

---

## 🟠 Altos

### A1: Webhook Stripe sin idempotencia por event.id — ✅ IMPLEMENTADO

**Hallazgo:**
```typescript
// apps/api/src/billing/billing.service.ts:217-237
async handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'invoice.paid':
      await this.handleInvoicePaid(invoice);
      break;
    // ❌ No verifica si event.id ya fue procesado
  }
}
```

**Impacto:** Si Stripe reenvía un evento (ej. por timeout), se procesa dos veces: prorroga suscripción dos veces, registra pago fallido dos veces, etc.

**Acción inmediata:**
1. Crear tabla `StripeEvent` (id, eventId, type, processedAt, payload) o usar Redis con TTL.
2. Antes de procesar, verificar si `event.id` ya existe.
3. Si existe, retornar sin procesar (idempotente).
4. Si no existe, procesar y guardar `event.id`.

**Código de corrección:**
```typescript
// billing.service.ts
async handleStripeEvent(event: Stripe.Event): Promise<void> {
  // Verificar idempotencia
  const existing = await this.prisma.stripeEvent.findUnique({
    where: { eventId: event.id },
  });
  if (existing) {
    this.logger.debug(`Evento Stripe ${event.id} ya procesado, ignorando`);
    return;
  }
  
  // Procesar
  try {
    switch (event.type) {
      case 'invoice.paid':
        await this.handleInvoicePaid(invoice);
        break;
      // ...
    }
    
    // Guardar como procesado
    await this.prisma.stripeEvent.create({
      data: {
        eventId: event.id,
        type: event.type,
        processedAt: new Date(),
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // No guardar si falla (permitir reintento)
    throw err;
  }
}
```

**Migración Prisma:**
```prisma
model StripeEvent {
  id         String   @id @default(uuid()) @db.Uuid
  eventId    String   @unique @db.VarChar(255) // Stripe event.id
  type       String   @db.VarChar(100)
  processedAt DateTime @default(now())
  payload    Json
  
  @@index([eventId])
  @@index([processedAt])
}
```

**Tiempo estimado:** 3–4 horas  
**Prioridad:** Evita duplicados en pagos y suscripciones.

**Nota:** Migración Prisma creada (`StripeEvent`). Ejecutar `npx prisma migrate deploy` en cada entorno (ver QUE_FALTA_DESPUES_SPRINT1.md).

---

### A2: Validación backend de roles/permisos inconsistente — ✅ IMPLEMENTADO

**Hallazgo:**
- Algunos controladores solo usan `@UseGuards(JwtAuthGuard)` sin `PermissionsGuard` (cash, sales, quotes, expenses).
- La política de acceso depende del rol en el JWT (ADMIN/USER) pero no siempre se valida con permisos explícitos.

**Impacto:** Si un usuario tiene rol ADMIN pero no debería tener acceso a ciertas operaciones según permisos, el backend no lo bloquea.

**Acción inmediata:**
1. Revisar controladores que solo usan `JwtAuthGuard` y añadir `PermissionsGuard` + `@RequirePermission` donde la política de negocio lo exija.
2. Priorizar: cash (abrir/cerrar caja), sales (crear venta), expenses (crear gasto).

**Ejemplo:**
```typescript
// cash.controller.ts
@Post('sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('cash:create')
openSession(/* ... */) { /* ... */ }

@Patch('sessions/:id/close')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('cash:update')
closeSession(/* ... */) { /* ... */ }
```

**Tiempo estimado:** 2–3 horas (revisar y añadir decoradores)  
**Prioridad:** Seguridad de acceso consistente.

---

### A3: Revisar otros endpoints sin filtro tenantId — ✅ IMPLEMENTADO

**Acción:**
1. ✅ Buscar todos los `count()`, `aggregate()`, `findMany()` sin `where: { tenantId }` en servicios que reciben `tenantId`.
2. ✅ Priorizar: ReportsService (getOperationalState, getSalesReport, getInventoryReport, etc.).

**Checklist rápido:**
- [x] `ReportsService.getDashboard()` → Filtrar por tenantId ✅
- [x] `ReportsService.getOperationalState()` → Verificar que todas las consultas filtran por tenantId ✅
- [x] `ReportsService.getSalesReport()` → Verificar filtro por tenantId ✅
- [x] `ReportsService.getInventoryReport()` → Filtrar por tenantId ✅
- [x] `ReportsService.getCashReport()` → Filtrar por tenantId ✅
- [x] `ReportsService.getCustomersReport()` → Filtrar por tenantId ✅
- [x] `ReportsService.getActionableIndicators()` → Filtrar por tenantId ✅
- [x] `ReportsService.getCustomerClusters()` → Filtrar por tenantId ✅
- [x] `ReportsService.getTrendingProducts()` → Filtrar por tenantId ✅
- [x] `ReportsService.getDashboardSummary()` → Filtrar por tenantId ✅
- [x] `AppService.getStats()` → Filtrar por tenantId ✅
- [x] Cualquier `count()` o `aggregate()` en servicios de negocio → Verificar tenantId ✅

**Tiempo estimado:** 2–3 horas (auditoría + fixes) — ✅ Completado  
**Prioridad:** Evitar más fugas multi-tenant — ✅ Resuelto.

---

# Sprint 2 — Robustez SaaS y operación

## 🟠 Altos

### A4: Falta de tests E2E para flujos SaaS críticos

**Hallazgo:**
- No hay E2E para:
  - Crear tenant + admin + suscripción Stripe
  - Cambiar plan de tenant
  - Renovar suscripción (PATCH /provider/tenants/:id/subscription/renew)
  - Webhook Stripe (invoice.paid, invoice.payment_failed, subscription.deleted)
  - Suspensión automática por impago

**Impacto:** Regresiones en flujos de facturación y tenant sin detección automática.

**Acción inmediata:**
1. Crear `apps/api/test/provider.e2e-spec.ts`:
   - POST /provider/tenants (crear tenant + admin + subscription)
   - PATCH /provider/tenants/:id (cambiar plan)
   - PATCH /provider/tenants/:id/subscription/renew
   - GET /provider/tenants (listar)
   - PATCH /provider/tenants/:id/status (suspender/reactivar)

2. Crear `apps/api/test/billing.e2e-spec.ts`:
   - POST /billing/webhooks/stripe con evento `invoice.paid` (mock de Stripe)
   - POST /billing/webhooks/stripe con evento `invoice.payment_failed` (primer fallo)
   - POST /billing/webhooks/stripe con evento `invoice.payment_failed` (segundo fallo en 30 días → suspensión)
   - POST /billing/webhooks/stripe con evento `customer.subscription.deleted` → CANCELLED
   - Verificar idempotencia (mismo event.id dos veces → solo procesa una vez)

**Estructura sugerida:**
```typescript
describe('Provider E2E', () => {
  let platformAdminToken: string;
  let tenantId: string;
  
  beforeAll(async () => {
    // Crear usuario platform admin (sin tenantId)
    platformAdminToken = await setupPlatformAdmin();
  });
  
  it('debe crear tenant con plan y suscripción Stripe', async () => {
    // POST /provider/tenants con planId que tenga stripePriceId
    // Verificar: tenant creado, subscription creada, stripeSubscriptionId guardado
  });
  
  it('debe cambiar plan de tenant', async () => {
    // PATCH /provider/tenants/:id con nuevo planId
    // Verificar: Subscription.planId actualizado
  });
  
  // ...
});

describe('Billing Webhooks E2E', () => {
  it('debe procesar invoice.paid y prorrogar suscripción', async () => {
    // Crear tenant con suscripción Stripe
    // POST /billing/webhooks/stripe con evento invoice.paid mockeado
    // Verificar: Subscription.currentPeriodEnd prorrogado 30 días, lastPaymentFailedAt = null
  });
  
  it('debe suspender tenant tras segundo pago fallido en 30 días', async () => {
    // Primer invoice.payment_failed → lastPaymentFailedAt guardado
    // Segundo invoice.payment_failed (dentro de 30 días) → status SUSPENDED, tenant.isActive = false
  });
  
  it('debe ser idempotente (mismo event.id dos veces)', async () => {
    // Enviar mismo evento dos veces
    // Verificar: solo se procesa una vez (StripeEvent guardado)
  });
});
```

**Tiempo estimado:** 1–2 días  
**Prioridad:** Garantizar que facturación y tenant funcionan correctamente.

---

### A5: No hay alertas configuradas

**Hallazgo:**
- Health check existe (`GET /health`) pero no hay integración con sistema de alertas (PagerDuty, Slack, email, etc.).
- Métricas en memoria (MetricsService) pero no exportadas a sistema persistente.

**Impacto:** Si la API cae o hay errores masivos, no hay notificación automática.

**Acción inmediata:**
1. Configurar monitor externo (UptimeRobot, Pingdom, o el orquestador) que haga GET /health cada 1–2 minutos y alerte si:
   - Status != 'ok'
   - Response time > 5s
   - No responde (timeout)

2. Alertas mínimas recomendadas:
   - **5xx rate > 1%** en últimos 5 minutos
   - **Health check failed** (DB/Redis desconectados)
   - **Cola con failed > 10** (dian, backup, reports)
   - **Latencia p95 > 2s** en endpoints críticos (ventas, caja)

3. Opcional: Integrar métricas con Prometheus + Grafana o servicio de métricas (Datadog, New Relic) para dashboards y alertas avanzadas.

**Tiempo estimado:** 4–6 horas (configurar monitor + alertas básicas)  
**Prioridad:** Detección temprana de problemas.

---

### A6: Rotación de secretos no documentada

**Hallazgo:**
- No hay proceso documentado para rotar JWT secrets, Stripe webhook secret, o DATABASE_URL si se comprometen.

**Acción inmediata:**
1. Documentar en runbook:
   - Rotar `JWT_ACCESS_SECRET`: invalidar todos los tokens (forzar re-login) o usar doble secreto (viejo + nuevo) durante periodo de transición.
   - Rotar `STRIPE_WEBHOOK_SECRET`: regenerar en Stripe Dashboard y actualizar env; eventos antiguos fallarán (aceptable).
   - Rotar `DATABASE_URL`: actualizar env y reiniciar; conexiones antiguas fallarán.

2. Proceso recomendado:
   - Generar nuevo secreto
   - Actualizar env en producción
   - Reiniciar API
   - Verificar que funciona (health check)
   - Invalidar tokens antiguos si aplica (JWT)

**Tiempo estimado:** 1 hora (documentar)  
**Prioridad:** Preparación para incidentes.

---

## 🟡 Medios

### M1: Logs estructurados sin correlation ID propagado

**Hallazgo:**
- Request ID existe pero no se propaga automáticamente a todos los logs de NestJS (solo en AllExceptionsFilter).

**Acción:**
- Opcional: Inyectar requestId en el contexto del logger (NestJS LoggerService personalizado) para que todas las líneas de log de una request tengan el mismo ID.

**Tiempo estimado:** 2–3 horas  
**Prioridad:** Mejora debugging pero no bloquea.

---

### M2: Métricas solo en memoria

**Hallazgo:**
- MetricsService guarda métricas en memoria; al reiniciar se pierden.

**Acción:**
- Exportar a Prometheus o sistema persistente para historial y dashboards.

**Tiempo estimado:** 4–6 horas  
**Prioridad:** Mejora observabilidad pero no bloquea.

---

### M3: Backups sin pruebas de restore periódicas

**Hallazgo:**
- Backups funcionan pero no hay evidencia de pruebas de restore en staging.

**Acción:**
- Calendarizar prueba de restore mensual en staging; documentar en runbook.

**Tiempo estimado:** 2 horas (automatizar o calendarizar)  
**Prioridad:** Garantizar que backups son restaurables.

---

# Sprint 3 — Evaluación DIAN (alcance legal Colombia)

## Estado actual de DIAN

**Hallazgo:**
```typescript
// apps/api/src/dian/dian.service.ts:468-561
async sendToDian(signedXml: string, dianDocumentId: string) {
  // ...
  if (this.dianEnv === DianEnvironment.HABILITACION) {
    // ❌ Mock response
    const mockResponse = {
      status: 'ACCEPTED',
      cufe: `CUFE-${dianDocumentId.substring(0, 8).toUpperCase()}-${Date.now()}`,
    };
    return mockResponse;
  }
  // Producción: llamada real (pero código existe)
  const response = await fetch(/* ... */);
}

async generatePDF(dianDocumentId: string): Promise<string> {
  // ❌ Placeholder
  this.logger.warn('generatePDF es un placeholder');
  return `pdf-placeholder-${dianDocumentId}.pdf`;
}
```

**CUFE:** Generado como simulado (`CUFE-${id}-${timestamp}`); no sigue Anexo Técnico DIAN.

**Consulta estado:** No implementada (solo se procesa respuesta del envío inicial).

---

## Diferencia: Gestión comercial vs Facturación electrónica legal

| Aspecto | Gestión comercial | Facturación electrónica legal |
|---------|-------------------|-------------------------------|
| **Ventas** | ✅ Registro de ventas, clientes, productos, caja | ✅ Incluido |
| **Facturas internas** | ✅ Número, totales, PDF básico | ✅ Incluido |
| **Envío a DIAN** | ❌ No | ✅ **Obligatorio** para ser legal |
| **CUFE real** | ❌ Simulado | ✅ **Obligatorio** según Anexo Técnico |
| **PDF con QR/CUFE** | ❌ Placeholder | ✅ **Obligatorio** para entrega al cliente |
| **Consulta estado DIAN** | ❌ No | ✅ **Recomendado** para sincronizar estados |
| **Venta legal** | ✅ Puede venderse como "gestión comercial" | ✅ Puede venderse como "facturación electrónica" |

---

## Qué falta exactamente para DIAN legal

### 1. Envío real a DIAN

**Estado:** Código existe pero usa mock en HABILITACION.  
**Falta:**
- Configurar `DIAN_ENV=PRODUCCION` y credenciales reales (softwareId, softwarePin, certificado).
- Probar en ambiente de habilitación DIAN con facturas de prueba.
- Manejar respuestas ACEPTADO/RECHAZADO y códigos de error DIAN.
- Reintentos con backoff si DIAN no responde (timeout, 5xx).

**Tiempo estimado:** 1 semana (configuración + pruebas en habilitación)

---

### 2. CUFE conforme a Anexo Técnico

**Estado:** Simulado (`CUFE-${id}-${timestamp}`).  
**Falta:**
- Implementar cálculo según Anexo Técnico DIAN FE 1.9:
  - Algoritmo: SHA-256 sobre campos específicos del XML (prefijo numérico, fecha, tipo doc, número, etc.).
  - Formato: 96 caracteres hexadecimales.
- Incluir CUFE en el XML antes de enviar.
- Validar que el CUFE recibido en la respuesta DIAN coincide con el calculado.

**Tiempo estimado:** 3–5 días (implementación + pruebas)

---

### 3. Consulta estado real

**Estado:** No implementada.  
**Falta:**
- Consumir Web Service DIAN de consulta (GET por CUFE o número de factura).
- Job periódico (cron) que consulte estados pendientes (SENT sin respuesta) y sincronice.
- Actualizar DianDocument.status según respuesta (ACCEPTED, REJECTED).

**Tiempo estimado:** 2–3 días

---

### 4. PDF + QR

**Estado:** Placeholder.  
**Falta:**
- Generar PDF con plantilla estándar DIAN (campos obligatorios, formato).
- Incluir QR code con datos de la factura (CUFE, número, fecha, totales, NIT emisor/receptor).
- Guardar PDF en disco o S3 y exponer URL de descarga.

**Tiempo estimado:** 3–4 días (librería PDF + QR + plantilla)

---

## Roadmap DIAN realista

| Fase | Tarea | Tiempo | Dependencias |
|------|-------|--------|--------------|
| **Fase 1** | Envío real a DIAN (habilitación) | 1 semana | Credenciales DIAN, certificado |
| **Fase 2** | CUFE según Anexo Técnico | 3–5 días | Anexo Técnico FE 1.9 |
| **Fase 3** | PDF + QR | 3–4 días | Librería PDF, QR |
| **Fase 4** | Consulta estado + sincronización | 2–3 días | Web Service consulta DIAN |
| **Fase 5** | Pruebas en habilitación + ajustes | 1 semana | Todas las fases anteriores |
| **Total** | **3–4 semanas** | | |

---

## Riesgos legales si se vende incompleto

**Riesgo alto:**
- Si se vende como "facturación electrónica legal" sin envío real a DIAN, el cliente no puede cumplir con obligaciones fiscales. Posible demanda o incumplimiento contractual.

**Recomendación:**
- **Vender como "gestión comercial"** hasta completar DIAN.
- O **vender con DIAN** pero con disclaimer claro: "Envío a DIAN en fase de habilitación; producción en [fecha estimada]". Aceptable si el cliente está informado.

**Criterio de cuándo se puede vender "con DIAN":**
- ✅ Envío real funcionando en habilitación
- ✅ CUFE calculado según Anexo Técnico
- ✅ PDF con QR generado correctamente
- ✅ Pruebas exitosas con facturas reales en habilitación
- ⚠️ Consulta estado: recomendado pero no bloqueante para venta inicial

---

# Checklist de validación pre-producción

## Seguridad multi-tenant

- [x] GET /stats filtra por tenantId (o solo platform admin) ✅
- [x] GET /reports/dashboard filtra por tenantId ✅
- [x] Todos los reportes (sales, inventory, cash, customers) filtran por tenantId ✅
- [x] GET /reports/operational-state filtra por tenantId ✅
- [x] GET /reports/actionable-indicators filtra por tenantId ✅
- [x] GET /reports/customer-clusters filtra por tenantId ✅
- [x] GET /reports/trending-products filtra por tenantId ✅
- [x] GET /reports/dashboard-summary filtra por tenantId ✅
- [x] Auditoría: listado y GET por entidad filtran por tenantId ✅
- [x] No hay `count()` o `aggregate()` sin `where: { tenantId }` en servicios de negocio ✅

## Seguridad de acceso

- [x] Rate limit activo en POST /auth/login (10 req/min por IP) ✅
- [x] Rate limit activo en GET /reports/* (30 req/min por usuario) ✅
- [x] Rate limit activo en GET /reports/export (10 req/min por usuario) ✅
- [x] CORS configurado con ALLOWED_ORIGINS en producción ✅
- [x] Controladores críticos usan PermissionsGuard + @RequirePermission ✅
- [x] Frontend oculta/deshabilita acciones según permisos ✅
- [x] Frontend muestra mensajes claros ante 403 usando getErrorMessage ✅

## Stripe y pagos

- [x] Webhook Stripe verifica firma ✅
- [x] Idempotencia por event.id (guardar StripeEvent y verificar antes de procesar) ✅
- [x] Manejo de reintentos: webhook responde 200 aunque falle procesamiento interno (log + retry manual) ✅
- [ ] Tests E2E de webhooks (invoice.paid, payment_failed, subscription.deleted) — Pendiente

## Flujos SaaS

- [ ] Tests E2E: crear tenant + admin + subscription
- [ ] Tests E2E: cambiar plan
- [ ] Tests E2E: renovar suscripción
- [ ] Tests E2E: suspensión automática por impago
- [ ] Tests E2E: reactivación tras pago

## Operación

- [ ] Monitor externo configurado (GET /health cada 1–2 min)
- [ ] Alertas: 5xx rate > 1%, health failed, colas con failed > 10
- [ ] Rotación de secretos documentada en runbook
- [ ] Prueba de restore de backup calendarizada (mensual)

---

# Conclusión y recomendaciones

## Nivel real del sistema

**Early SaaS** (camino a Production-ready).  
**Con correcciones críticas y altas:** **Production-ready para clientes pagos** (con responsabilidad operativa y monitoreo).

## Qué hacer antes de escalar clientes

**Obligatorio (Sprint 1):**
1. Corregir getStats y getDashboard (filtro tenantId)
2. Activar rate limiting en login y reportes
3. Idempotencia en webhooks Stripe
4. CORS estricto en producción

**Recomendado (Sprint 2):**
5. Tests E2E de flujos SaaS (provider, billing)
6. Alertas básicas (health, 5xx, colas)
7. Documentar rotación de secretos

**Opcional (mejoras):**
8. Métricas persistentes (Prometheus)
9. Correlation ID en logs
10. Pruebas de restore calendarizadas

## Riesgos técnicos a 3–6 meses

- **Escalado de datos:** Auditoría y reportes sin archivado pueden crecer indefinidamente. Planificar retención (ej. 12 meses) y archivado a almacenamiento frío.
- **Dependencias:** Mantener `npm audit` y Dependabot activos; actualizar críticas (ej. Prisma, NestJS) con pruebas.
- **Deuda técnica:** ReportsService muy grande; refactorizar por dominio cuando haya tiempo (no urgente).

## Evaluación final

**¿Listo para clientes pagos?**  
✅ **Sí, tras corregir críticos (C1–C4) y altos (A1–A3).**  
⏱️ **Tiempo estimado:** 1–2 semanas de trabajo enfocado.

**¿Listo para escalar a decenas de clientes?**  
✅ **Sí, tras Sprint 1 + Sprint 2 (tests E2E, alertas).**  
⏱️ **Tiempo estimado:** 2–3 semanas.

**¿Listo para facturación electrónica legal en Colombia?**  
❌ **No, hasta completar Sprint 3 (DIAN):** 3–4 semanas adicionales.

---

**Última actualización:** Febrero 2026
