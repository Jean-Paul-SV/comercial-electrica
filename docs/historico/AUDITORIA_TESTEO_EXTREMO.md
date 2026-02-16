# Auditoría de testeo extremo — SaaS multi-tenant

**Rol:** CTO externo / Auditor técnico senior / Performance engineer  
**Criterio:** Sistema con clientes pagos mañana; evaluación práctica, no teórica.  
**Fecha:** Febrero 2026.

---

## Resumen ejecutivo

**Estado:** Early SaaS con base sólida. **Sprint 1 cerrado (feb 2026):** los hallazgos críticos y altos listados abajo están **resueltos**.

**Hallazgos críticos (✅ implementados):**
- ✅ **Fugas multi-tenant** (getStats, getDashboard, getOperationalState, getSalesReport, inventory, cash, customers, export, etc.) — Filtro por tenantId en controller y servicio.
- ✅ **Rate limiting** — Activo en producción (login, forgot-password, reports).
- ✅ **CORS** — En producción exige ALLOWED_ORIGINS configurado.
- ✅ **Webhook Stripe** — Idempotencia por event.id (tabla StripeEvent); migración pendiente de ejecutar en cada entorno.
- ✅ **PermissionsGuard** — En cash (create/update), sales (create/update), expenses (create/delete).
- ✅ **Reportes** — Todos filtran por tenantId (dashboard, operational-state, sales, inventory, cash, customers, actionable-indicators, etc.).

**Tests E2E:** Suite unificada con multi-tenant (11 suites, 55 tests); multi-tenant-reports, permissions, stripe-idempotency cubiertos. Ver `QUE_FALTA_DESPUES_SPRINT1.md`.

---

# 1️⃣ Testeo del Backend (API)

## 🔐 Seguridad y multi-tenant

### Hallazgo C1: GET /stats devuelve datos globales — ✅ RESUELTO

**Ubicación:** `apps/api/src/app.service.ts:103-171`

**Problema:**
```typescript
async getStats() {
  const totalUsers = await this.prisma.user.count(); // ❌ Sin tenantId
  const totalProducts = await this.prisma.product.count({ where: { isActive: true } }); // ❌ Sin tenantId
  const totalCustomers = await this.prisma.customer.count(); // ❌ Sin tenantId
  const totalSales = await this.prisma.sale.count({ where: { status: 'PAID' } }); // ❌ Sin tenantId
  // ...
}
```

**Impacto:** Cualquier usuario con `reports:read` ve conteos de TODOS los tenants.

**Test automatizado propuesto:**
```typescript
// apps/api/test/security/multi-tenant-leaks.e2e-spec.ts
describe('Multi-tenant isolation', () => {
  it('GET /stats debe filtrar por tenantId', async () => {
    // Crear tenant A y tenant B con datos
    const tenantA = await createTenant('tenant-a');
    const tenantB = await createTenant('tenant-b');
    await createSales(tenantA.id, 5);
    await createSales(tenantB.id, 10);
    
    // Usuario de tenant A
    const tokenA = await loginAs(tenantA.adminEmail);
    const statsA = await request(app)
      .get('/stats')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    
    // Verificar que solo ve datos de tenant A
    expect(statsA.body.sales.total).toBe(5);
    expect(statsA.body.customers.total).toBeLessThanOrEqual(tenantA.customersCount);
    
    // Usuario de tenant B
    const tokenB = await loginAs(tenantB.adminEmail);
    const statsB = await request(app)
      .get('/stats')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    
    // Verificar que solo ve datos de tenant B
    expect(statsB.body.sales.total).toBe(10);
  });
});
```

**Fix requerido:**
- Modificar `AppController.getStats()` para recibir `@Req() req` y extraer `tenantId`.
- Modificar `AppService.getStats(tenantId: string)` para filtrar TODOS los `count()` y `aggregate()` por `tenantId`.
- O restringir a platform admin con `@UseGuards(PlatformAdminGuard)`.

---

### Hallazgo C2: GET /reports/dashboard devuelve datos globales — ✅ RESUELTO

**Ubicación:** `apps/api/src/reports/reports.service.ts:609-755`

**Problema:**
```typescript
async getDashboard() {
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

**Test automatizado propuesto:**
```typescript
it('GET /reports/dashboard debe filtrar por tenantId', async () => {
  const tenantA = await createTenant('tenant-a');
  const tenantB = await createTenant('tenant-b');
  await createSales(tenantA.id, 3);
  await createSales(tenantB.id, 7);
  
  const tokenA = await loginAs(tenantA.adminEmail);
  const dashboardA = await request(app)
    .get('/reports/dashboard')
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(200);
  
  expect(dashboardA.body.sales.today.count).toBe(3);
  expect(dashboardA.body.customers.total).toBeLessThanOrEqual(tenantA.customersCount);
});
```

**Fix requerido:**
- Modificar `ReportsController.getDashboard()` para recibir `@Req() req` y extraer `tenantId`.
- Modificar `ReportsService.getDashboard(tenantId: string)` para filtrar TODAS las consultas por `tenantId`.
- Actualizar clave de caché: `cache:dashboard:${tenantId}`.

---

### Hallazgo C3: GET /reports/operational-state sin filtro tenantId — ✅ RESUELTO

**Ubicación:** `apps/api/src/reports/reports.service.ts:762-854`

**Problema:**
```typescript
async getOperationalState(): Promise<OperationalStateResponse> {
  const [
    openCashSessions,
    lowStockProducts,
    // ...
  ] = await Promise.all([
    this.prisma.cashSession.findMany({
      where: { closedAt: null }, // ❌ Sin tenantId
    }),
    this.prisma.product.findMany({
      where: { isActive: true, stock: { qtyOnHand: { lte: LOW_STOCK_THRESHOLD } } }, // ❌ Sin tenantId
    }),
    // ...
  ]);
}
```

**Impacto:** Estado operativo muestra datos de TODOS los tenants.

**Fix requerido:**
- Modificar `ReportsController.getOperationalState()` para recibir `@Req() req` y extraer `tenantId`.
- Modificar `ReportsService.getOperationalState(tenantId: string)` para filtrar TODAS las consultas por `tenantId`.

---

### Hallazgo C4: GET /reports/sales sin filtro tenantId — ✅ RESUELTO

**Ubicación:** `apps/api/src/reports/reports.service.ts:71-167`

**Problema:**
```typescript
async getSalesReport(dto: SalesReportDto) {
  const where: Prisma.SaleWhereInput = {
    status: 'PAID', // ❌ Sin tenantId
  };
  // ...
  const sales = await this.prisma.sale.findMany({ where, /* ... */ });
}
```

**Impacto:** Reporte de ventas muestra datos de TODOS los tenants.

**Fix requerido:**
- Modificar `ReportsController.getSalesReport()` para recibir `@Req() req` y extraer `tenantId`.
- Modificar `ReportsService.getSalesReport(dto, tenantId: string)` para añadir `tenantId` al `where`.

---

### Test automatizado genérico para detectar fugas multi-tenant

**Propuesta:** Script que escanea todos los endpoints y verifica que las queries Prisma incluyan `tenantId` cuando corresponda.

```typescript
// scripts/audit-multi-tenant-leaks.ts
import { readFileSync } from 'fs';
import { glob } from 'glob';

const patterns = [
  /\.count\(\)/g,
  /\.aggregate\(/g,
  /\.findMany\(/g,
  /\.findFirst\(/g,
  /\.findUnique\(/g,
];

const excludeTenantId = [
  'User', // User puede no tener tenantId (platform admin)
  'Tenant',
  'Plan',
  'PlanFeature',
];

function auditFile(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  
  // Buscar queries Prisma sin tenantId en servicios de negocio
  patterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const line = content.substring(0, match.index).split('\n').length;
      // Verificar si el contexto incluye tenantId
      const context = content.substring(Math.max(0, match.index - 200), match.index + 200);
      if (!context.includes('tenantId') && !excludeTenantId.some(model => context.includes(`prisma.${model.toLowerCase()}`))) {
        issues.push(`${filePath}:${line} - Query sin tenantId: ${match[0]}`);
      }
    }
  });
  
  return issues;
}

// Ejecutar auditoría
const serviceFiles = glob.sync('apps/api/src/**/*.service.ts');
const allIssues: string[] = [];
serviceFiles.forEach(file => {
  const issues = auditFile(file);
  allIssues.push(...issues);
});

console.log('Hallazgos de fugas multi-tenant:');
allIssues.forEach(issue => console.log(`  - ${issue}`));
```

---

## 🔑 Autenticación y autorización

### Hallazgo A1: Endpoints críticos sin PermissionsGuard — ✅ RESUELTO

**Ubicación:**
- `apps/api/src/cash/cash.controller.ts` — Solo `@UseGuards(JwtAuthGuard)`
- `apps/api/src/sales/sales.controller.ts` — Solo `@UseGuards(JwtAuthGuard)`
- `apps/api/src/expenses/expenses.controller.ts` — Solo `@UseGuards(JwtAuthGuard)`

**Problema:** Cualquier usuario autenticado puede:
- Abrir/cerrar caja (`POST /cash/sessions`, `POST /cash/sessions/:id/close`)
- Crear ventas (`POST /sales`)
- Crear gastos (`POST /expenses`)

**Impacto:** Usuario con rol USER puede realizar operaciones que deberían requerir permisos específicos.

**Test automatizado propuesto:**
```typescript
// apps/api/test/security/permissions.e2e-spec.ts
describe('Permissions enforcement', () => {
  it('POST /cash/sessions debe requerir permiso cash:create', async () => {
    const userToken = await createUserWithRole('USER'); // Sin permisos especiales
    await request(app)
      .post('/cash/sessions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ openingAmount: 1000 })
      .expect(403); // Debe fallar sin permiso
  });
  
  it('POST /sales debe requerir permiso sales:create', async () => {
    const userToken = await createUserWithRole('USER');
    await request(app)
      .post('/sales')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ /* ... */ })
      .expect(403);
  });
  
  it('POST /expenses debe requerir permiso expenses:create', async () => {
    const userToken = await createUserWithRole('USER');
    await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ /* ... */ })
      .expect(403);
  });
});
```

**Fix requerido:**
```typescript
// cash.controller.ts
@Post('sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('cash:create')
async open(/* ... */) { /* ... */ }

@Post('sessions/:id/close')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('cash:update')
close(/* ... */) { /* ... */ }

// sales.controller.ts
@Post()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('sales:create')
create(/* ... */) { /* ... */ }

// expenses.controller.ts
@Post()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('expenses:create')
create(/* ... */) { /* ... */ }
```

---

### Hallazgo A2: JWT sin refresh token

**Ubicación:** `apps/api/src/auth/auth.service.ts`

**Problema:** Solo hay `JWT_ACCESS_SECRET`; no hay refresh token. Los usuarios deben re-login cuando expira el token.

**Impacto:** UX degradada; usuarios activos pierden sesión tras expiración.

**Recomendación:** Implementar refresh token (opcional para MVP, recomendado para producción).

**Test propuesto:**
```typescript
it('JWT debe expirar según JWT_ACCESS_EXPIRES_IN', async () => {
  const token = await login('user@test.com', 'password');
  // Esperar expiración
  await new Promise(resolve => setTimeout(resolve, JWT_ACCESS_EXPIRES_IN_MS + 1000));
  await request(app)
    .get('/auth/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(401);
});
```

---

## 💳 Stripe y facturación SaaS

### Hallazgo B1: Webhook Stripe sin idempotencia por event.id

**Ubicación:** `apps/api/src/billing/billing.service.ts:217-237`

**Problema:**
```typescript
async handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'invoice.paid':
      await this.handleInvoicePaid(invoice);
      break;
    // ❌ No verifica si event.id ya fue procesado
  }
}
```

**Impacto:** Si Stripe reenvía un evento (ej. por timeout), se procesa dos veces:
- `invoice.paid` → prorroga suscripción dos veces (60 días en lugar de 30)
- `invoice.payment_failed` → registra fallo dos veces (puede suspender incorrectamente)

**Test automatizado propuesto:**
```typescript
// apps/api/test/billing/billing.e2e-spec.ts
describe('Stripe webhook idempotency', () => {
  it('debe procesar invoice.paid solo una vez (mismo event.id)', async () => {
    const tenant = await createTenantWithSubscription();
    const subscription = await getSubscription(tenant.id);
    const originalPeriodEnd = subscription.currentPeriodEnd;
    
    const event: Stripe.Event = {
      id: 'evt_test_123',
      type: 'invoice.paid',
      data: { object: { subscription: subscription.stripeSubscriptionId } },
    } as Stripe.Event;
    
    // Primera vez
    await request(app)
      .post('/billing/webhooks/stripe')
      .set('stripe-signature', mockSignature(event))
      .send(event)
      .expect(200);
    
    const afterFirst = await getSubscription(tenant.id);
    const firstPeriodEnd = afterFirst.currentPeriodEnd;
    expect(firstPeriodEnd.getTime()).toBeGreaterThan(originalPeriodEnd.getTime());
    
    // Segunda vez (mismo event.id)
    await request(app)
      .post('/billing/webhooks/stripe')
      .set('stripe-signature', mockSignature(event))
      .send(event)
      .expect(200);
    
    const afterSecond = await getSubscription(tenant.id);
    // Debe ser igual a la primera vez (no prorrogado de nuevo)
    expect(afterSecond.currentPeriodEnd.getTime()).toBe(firstPeriodEnd.getTime());
  });
  
  it('debe suspender tenant tras segundo payment_failed en 30 días', async () => {
    const tenant = await createTenantWithSubscription();
    
    // Primer fallo
    await sendWebhook('invoice.payment_failed', tenant);
    const afterFirst = await getTenant(tenant.id);
    expect(afterFirst.isActive).toBe(true);
    
    // Segundo fallo (dentro de 30 días)
    await sendWebhook('invoice.payment_failed', tenant);
    const afterSecond = await getTenant(tenant.id);
    expect(afterSecond.isActive).toBe(false);
    
    const subscription = await getSubscription(tenant.id);
    expect(subscription.status).toBe('SUSPENDED');
  });
  
  it('debe manejar eventos fuera de orden', async () => {
    // Enviar invoice.paid antes de invoice.payment_failed (si Stripe los envía así)
    // Verificar que el estado final es correcto
  });
});
```

**Fix requerido:**
1. Crear tabla `StripeEvent` (id, eventId, type, processedAt, payload).
2. Antes de procesar, verificar si `event.id` ya existe.
3. Si existe, retornar sin procesar (idempotente).
4. Si no existe, procesar y guardar `event.id`.

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

---

### Hallazgo B2: Manejo de reintentos en webhook

**Ubicación:** `apps/api/src/billing/billing.controller.ts:48-56`

**Problema:**
```typescript
try {
  await this.billing.handleStripeEvent(event);
} catch (err) {
  this.logger.error(/* ... */);
  res.status(500).json({ error: 'Webhook handler failed' });
  return { received: false };
}
```

**Impacto:** Si el procesamiento falla (ej. DB temporalmente desconectada), Stripe reintentará, pero el error se registra sin contexto suficiente.

**Recomendación:**
- Responder 200 si el evento ya fue procesado (idempotencia).
- Responder 500 solo si falla el procesamiento y NO fue procesado antes.
- Loggear con correlation ID y contexto completo.

---

# 2️⃣ Testeo del Frontend

## Flujos completos end-to-end

### Test manual propuesto

**Checklist de flujos críticos:**

1. **Login y autenticación:**
   - [ ] Login con credenciales válidas
   - [ ] Login con credenciales inválidas (mensaje claro)
   - [ ] Token expirado → redirige a login
   - [ ] Logout limpia sesión

2. **Onboarding:**
   - [ ] Usuario nuevo ve onboarding
   - [ ] Completar onboarding marca como completado
   - [ ] Saltar onboarding funciona

3. **Crear venta:**
   - [ ] Seleccionar productos
   - [ ] Calcular totales (subtotal, impuestos, descuentos)
   - [ ] Validar stock insuficiente (mensaje claro)
   - [ ] Crear venta exitosamente
   - [ ] Ver factura generada
   - [ ] Stock actualizado correctamente

4. **Caja:**
   - [ ] Abrir sesión de caja
   - [ ] Ver sesión abierta en dashboard
   - [ ] Registrar movimiento de entrada/salida
   - [ ] Cerrar sesión (validar ventas pendientes)
   - [ ] Ver resumen de cierre

5. **Reportes:**
   - [ ] Dashboard carga datos correctos
   - [ ] Reporte de ventas con filtros (fecha, cliente)
   - [ ] Exportar reporte (CSV)
   - [ ] Reporte de inventario (stock bajo)

6. **Panel proveedor:**
   - [ ] Listar tenants (solo platform admin)
   - [ ] Crear tenant + admin
   - [ ] Cambiar plan de tenant
   - [ ] Suspender/reactivar tenant

---

## Manejo de errores

### Hallazgo F1: Errores silenciosos en algunos flujos

**Revisión manual requerida:**

**Checklist de manejo de errores:**
- [ ] Error 401 → redirige a login con mensaje
- [ ] Error 403 → muestra mensaje "No tienes permiso"
- [ ] Error 404 → muestra mensaje "No encontrado"
- [ ] Error 500 → muestra mensaje genérico + log para soporte
- [ ] Error de red (timeout) → muestra mensaje + botón reintentar
- [ ] Validación de formulario → muestra errores inline

**Archivos a revisar:**
- `apps/web/src/app/(protected)/**/*.tsx` — Verificar uso de `getErrorMessage()` y toasts.

---

## Estados de carga y UX

### Hallazgo F2: Falta de estados de carga consistentes

**Revisión manual requerida:**

**Checklist:**
- [ ] Listados muestran skeleton/spinner mientras cargan
- [ ] Formularios muestran loading al enviar (botón deshabilitado)
- [ ] Navegación bloquea mientras carga (evitar doble submit)
- [ ] Toasts muestran éxito/error claramente
- [ ] Modales/dialogs muestran loading interno

---

## Seguridad frontend

### Hallazgo F3: Acceso a vistas sin permisos

**Test propuesto:**
```typescript
// apps/web/test/e2e/security.spec.ts
describe('Frontend security', () => {
  it('no debe permitir acceso a /provider sin ser platform admin', async () => {
    const userToken = await loginAsRegularUser();
    await page.goto('/provider/tenants');
    // Debe redirigir o mostrar error
    expect(page.url()).not.toContain('/provider');
  });
  
  it('no debe permitir manipulación de IDs en URL', async () => {
    const tenantA = await createTenant('tenant-a');
    const tenantB = await createTenant('tenant-b');
    const tokenA = await loginAs(tenantA.adminEmail);
    
    // Intentar acceder a venta de tenant B
    await page.goto(`/sales/${tenantB.saleId}`);
    // Debe mostrar 404 o error de acceso
    expect(await page.textContent('body')).toContain('No encontrado');
  });
});
```

---

# 3️⃣ Swagger / OpenAPI

## Auditoría de documentación

### Hallazgo S1: Endpoints sin documentar

**Revisión requerida:**

**Checklist:**
- [ ] Todos los endpoints tienen `@ApiOperation`
- [ ] Todos los endpoints tienen `@ApiResponse` para 200, 400, 401, 403, 404, 500
- [ ] DTOs tienen `@ApiProperty` con descripciones
- [ ] Parámetros de query tienen `@ApiQuery` con ejemplos
- [ ] Parámetros de path tienen `@ApiParam`

**Endpoints a revisar:**
- `GET /stats` — Documentado ✅
- `GET /reports/dashboard` — Documentado ✅
- `POST /billing/webhooks/stripe` — `@ApiExcludeEndpoint()` ✅ (correcto, no debe estar en Swagger público)

---

### Hallazgo S2: Inconsistencias DTO vs Swagger

**Revisión manual requerida:**

**Checklist:**
- [ ] Campos `required` en DTO coinciden con Swagger
- [ ] Tipos coinciden (string vs number vs boolean)
- [ ] Ejemplos son realistas
- [ ] Validaciones (`@IsEmail`, `@Min`, `@Max`) están documentadas

**Ejemplo de inconsistencia potencial:**
```typescript
// DTO
export class CreateSaleDto {
  @IsArray()
  @ValidateNested({ each: true })
  items: SaleItemDto[]; // Required en código
}

// Swagger puede mostrar como optional si falta @ApiProperty({ required: true })
```

---

### Hallazgo S3: Swagger público expone endpoints internos

**Revisión requerida:**

**Endpoints que NO deberían estar en Swagger público:**
- `POST /billing/webhooks/stripe` — ✅ Ya excluido con `@ApiExcludeEndpoint()`
- `POST /auth/bootstrap-admin` — Revisar si debe estar
- Endpoints `/provider/*` — Solo para platform admin

**Recomendación:**
- Separar Swagger público (`/api-docs`) vs interno (`/api-docs/internal`) usando tags o módulos separados.

---

# 4️⃣ Base de datos (Prisma + PostgreSQL)

## Modelo Prisma

### Hallazgo D1: Índices faltantes

**Revisión del schema:**

**Índices recomendados:**
```prisma
// AuditLog - búsquedas frecuentes por tenantId + fecha
model AuditLog {
  // ...
  @@index([tenantId, createdAt])
  @@index([entityType, entityId])
}

// Sale - búsquedas por tenantId + fecha + status
model Sale {
  // ...
  @@index([tenantId, soldAt])
  @@index([tenantId, status, soldAt])
}

// Product - búsquedas por tenantId + activo
model Product {
  // ...
  @@index([tenantId, isActive])
}

// CashSession - búsquedas por tenantId + cerrado
model CashSession {
  // ...
  @@index([tenantId, closedAt])
}
```

**Verificar índices existentes:**
```sql
-- Ejecutar en PostgreSQL
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

---

### Hallazgo D2: Relaciones y cascadas

**Revisión del schema:**

**Verificar:**
- [ ] `onDelete: Cascade` en relaciones donde corresponde (ej. Product → SaleItem)
- [ ] `onDelete: SetNull` en relaciones opcionales (ej. User → Tenant)
- [ ] No hay `onDelete: Restrict` que bloquee eliminaciones necesarias

**Ejemplo de revisión:**
```prisma
model Sale {
  tenantId String @db.Uuid
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  // ✅ Correcto: si se elimina tenant, se eliminan sus ventas
}

model User {
  tenantId String? @db.Uuid
  tenant   Tenant? @relation(fields: [tenantId], references: [id], onDelete: SetNull)
  // ✅ Correcto: si se elimina tenant, usuarios quedan sin tenant (platform admin)
}
```

---

## Queries y rendimiento

### Hallazgo D3: Queries N+1 potenciales

**Revisión de código:**

**Ejemplo encontrado:**
```typescript
// apps/api/src/reports/reports.service.ts:116-135
const sales = await this.prisma.sale.findMany({
  where,
  select: {
    // ...
    items: { include: { product: true } }, // ✅ Correcto: incluye producto
    customer: true, // ✅ Correcto: incluye cliente
    invoices: true, // ✅ Correcto: incluye facturas
  },
});
```

**Verificar en otros servicios:**
- [ ] `SalesService.listSales()` — ✅ Usa `include` correctamente
- [ ] `QuotesService.listQuotes()` — ✅ Usa `include` correctamente
- [ ] `ReportsService.getSalesReport()` — ✅ Usa `include` correctamente

**Test de performance:**
```typescript
it('listSales no debe hacer queries N+1', async () => {
  const startQueries = await countPrismaQueries();
  await salesService.listSales({ page: 1, limit: 20 }, tenantId);
  const endQueries = await countPrismaQueries();
  
  // Debe hacer máximo 2 queries: findMany + count
  expect(endQueries - startQueries).toBeLessThanOrEqual(2);
});
```

---

### Hallazgo D4: Queries costosas en reportes

**Revisión de performance:**

**Queries a optimizar:**
1. `ReportsService.getDashboard()` — Múltiples `findMany` y `count` sin caché (excepto dashboard completo).
2. `ReportsService.getOperationalState()` — Múltiples `findMany` y `count` sin caché.

**Recomendación:**
- Caché de resultados parciales (ej. `cache:operational-state:${tenantId}`, TTL 60s).
- Pre-agregados para métricas frecuentes (ej. ventas del día, stock bajo).

---

## Datos a largo plazo

### Hallazgo D5: Crecimiento sin límite

**Tablas que crecerán indefinidamente:**
- `AuditLog` — Cada acción genera un log
- `Sale` — Cada venta genera un registro
- `DianDocument` — Cada factura genera un documento

**Recomendación:**

**Estrategia de retención:**
```prisma
// Opción 1: Soft delete + archivado
model AuditLog {
  // ...
  archivedAt DateTime? @db.Timestamptz
  @@index([archivedAt])
}

// Opción 2: Particionado por fecha (PostgreSQL)
-- Crear particiones mensuales para AuditLog
CREATE TABLE audit_log_2026_02 PARTITION OF audit_log
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

**Plan de archivado:**
- **AuditLog:** Retener 12 meses activos, archivar a S3 después.
- **Sale:** Retener indefinidamente (datos críticos de negocio).
- **DianDocument:** Retener indefinidamente (requisito legal).

**Job de limpieza:**
```typescript
// apps/api/src/backups/cleanup.service.ts
@Cron('0 2 * * 0') // Domingos a las 2 AM
async archiveOldAuditLogs() {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 12);
  
  const logsToArchive = await this.prisma.auditLog.findMany({
    where: { createdAt: { lt: cutoffDate } },
  });
  
  // Exportar a S3
  await this.s3.upload('audit-logs', logsToArchive);
  
  // Eliminar de BD
  await this.prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoffDate } },
  });
}
```

---

# 5️⃣ Performance y carga

## Endpoints más costosos

### Análisis de performance

**Endpoints identificados como costosos:**

1. **GET /reports/dashboard**
   - Múltiples `findMany` y `count`
   - Sin caché por tenant (solo caché global)
   - **Tiempo estimado:** 200–500ms con datos normales

2. **GET /reports/operational-state**
   - Múltiples `findMany` y `count`
   - Sin caché
   - **Tiempo estimado:** 300–800ms con datos normales

3. **GET /reports/sales** (con rango de fechas grande)
   - `findMany` con `include` de relaciones
   - Límite máximo 1000 registros
   - **Tiempo estimado:** 500–2000ms con 1000 ventas

4. **GET /reports/export** (CSV)
   - Similar a reportes pero sin paginación
   - **Tiempo estimado:** 1000–5000ms con muchos datos

---

## Escalado por número de tenants

### Proyección de carga

**Escenario 1: 10 tenants**
- **Carga:** Baja
- **Riesgo:** Ninguno
- **Acción:** Ninguna

**Escenario 2: 100 tenants**
- **Carga:** Media
- **Riesgo:** Dashboard y reportes pueden ser lentos si muchos usuarios acceden simultáneamente
- **Acción:** Implementar caché por tenant en reportes

**Escenario 3: 1.000 tenants**
- **Carga:** Alta
- **Riesgo:**
  - Reportes sin caché → timeout
  - Dashboard sin caché → timeout
  - Queries sin índices → lentas
- **Acción:**
  - Caché obligatorio en reportes (TTL 60–300s)
  - Pre-agregados para métricas frecuentes
  - Jobs async para reportes pesados

---

## Optimizaciones propuestas

### Quick wins (1–2 días)

1. **Caché por tenant en reportes:**
   ```typescript
   // reports.service.ts
   async getDashboard(tenantId: string) {
     const cacheKey = `dashboard:${tenantId}`;
     const cached = await this.cache.get(cacheKey);
     if (cached) return cached;
     
     const result = await this.computeDashboard(tenantId);
     await this.cache.set(cacheKey, result, 60); // TTL 60s
     return result;
   }
   ```

2. **Índices compuestos:**
   ```sql
   CREATE INDEX idx_sale_tenant_status_date ON "Sale"(tenant_id, status, sold_at DESC);
   CREATE INDEX idx_audit_log_tenant_created ON "AuditLog"(tenant_id, created_at DESC);
   ```

### Mejoras estructurales (1 semana)

3. **Pre-agregados para métricas:**
   ```typescript
   // Job que corre cada hora
   @Cron('0 * * * *')
   async aggregateDailyMetrics() {
     const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
     for (const tenant of tenants) {
       const metrics = await this.computeDailyMetrics(tenant.id);
       await this.cache.set(`metrics:daily:${tenant.id}`, metrics, 3600);
     }
   }
   ```

4. **Jobs async para reportes pesados:**
   ```typescript
   // En lugar de generar CSV sincrónicamente
   @Post('reports/export')
   async exportReport(@Body() dto: ExportReportDto) {
     const job = await this.reportsQueue.add('export-csv', { dto, userId });
     return { jobId: job.id, status: 'processing' };
   }
   
   // Cliente consulta estado del job
   @Get('reports/export/:jobId')
   async getExportStatus(@Param('jobId') jobId: string) {
     const job = await this.reportsQueue.getJob(jobId);
     return { status: job.status, result: job.returnvalue };
   }
   ```

---

## Qué NO optimizar todavía

**Evitar over-engineering:**
- ❌ Microservicios (monolito está bien hasta 1000+ tenants)
- ❌ Read replicas (PostgreSQL puede manejar carga actual)
- ❌ CDN para assets estáticos (Next.js ya optimiza)
- ❌ Service mesh (complejidad innecesaria)

**Optimizar solo cuando:**
- P95 latency > 2s en endpoints críticos
- CPU > 80% sostenido
- DB connections > 80% del pool
- Errores 503 por timeout

---

# 6️⃣ Operación y resiliencia

## Backups

### Hallazgo O1: Backups sin pruebas de restore

**Estado actual:**
- Backups automáticos configurados (`apps/api/src/backups/backups.service.ts`)
- Backup a S3 implementado
- **Falta:** Prueba de restore documentada

**Test de restore propuesto:**
```bash
# Mensual en staging
# 1. Crear backup
npm run backup:create

# 2. Restaurar en BD de staging
pg_restore -d staging_db backup-YYYY-MM-DD.sql

# 3. Verificar integridad
npm run test:e2e

# 4. Documentar resultado
```

**Checklist:**
- [ ] Restore probado en staging (mensual)
- [ ] Tiempo de restore documentado
- [ ] Procedimiento de restore documentado en runbook
- [ ] Alertas si backup falla

---

## Logs

### Hallazgo O2: Correlation ID no propagado a todos los logs

**Estado actual:**
- Request ID existe (`x-request-id` header)
- Se propaga en `AllExceptionsFilter`
- **Falta:** Propagación automática a todos los logs de NestJS

**Recomendación:**
- Implementar `LoggerService` personalizado que inyecte `requestId` en cada log.

---

## Alertas

### Hallazgo O3: Alertas faltantes

**Alertas mínimas requeridas:**

1. **Health check failed:**
   - DB desconectado
   - Redis desconectado
   - Colas desconectadas

2. **Error rate alto:**
   - 5xx rate > 1% en últimos 5 minutos
   - 4xx rate > 10% en últimos 5 minutos (posible problema de cliente)

3. **Latencia alta:**
   - P95 latency > 2s en endpoints críticos
   - P99 latency > 5s

4. **Colas bloqueadas:**
   - Failed jobs > 10 en cualquier cola
   - Waiting jobs > 1000 (posible backlog)

5. **Stripe webhooks:**
   - Webhook fallido (500)
   - Evento no procesado después de 3 reintentos

**Implementación:**
- Monitor externo (UptimeRobot, Pingdom) para health checks
- Métricas exportadas a Prometheus + Alertmanager (opcional, avanzado)
- Alertas a Slack/Email/PagerDuty

---

## Manejo de errores

### Hallazgo O4: Qué pasa cuando algo falla

**Escenarios a probar:**

1. **DB desconectado:**
   - [ ] Health check devuelve `status: degraded`
   - [ ] Endpoints devuelven 503 con mensaje claro
   - [ ] Logs registran error con contexto

2. **Redis desconectado:**
   - [ ] Caché falla silenciosamente (continúa sin caché)
   - [ ] Health check devuelve `status: degraded`
   - [ ] Logs registran warning

3. **Stripe API falla:**
   - [ ] Webhook devuelve 500 (Stripe reintentará)
   - [ ] Creación de suscripción falla con mensaje claro
   - [ ] Logs registran error con event.id

4. **DIAN API falla:**
   - [ ] Documento queda en estado SENT
   - [ ] Job de reintento procesa después
   - [ ] Logs registran error con dianDocumentId

**Tests propuestos:**
```typescript
describe('Resilience', () => {
  it('debe manejar DB desconectado gracefully', async () => {
    await disconnectDatabase();
    const health = await request(app).get('/health').expect(200);
    expect(health.body.status).toBe('degraded');
    expect(health.body.services.database).toBe('disconnected');
  });
  
  it('debe manejar Redis desconectado sin fallar', async () => {
    await disconnectRedis();
    // Endpoints deben funcionar sin caché
    const sales = await request(app)
      .get('/sales')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(sales.body.data).toBeDefined();
  });
});
```

---

# Checklist de validación pre-producción

## Seguridad multi-tenant

- [x] GET /stats filtra por tenantId (o solo platform admin) ✅
- [x] GET /reports/dashboard filtra por tenantId ✅
- [x] GET /reports/operational-state filtra por tenantId ✅
- [x] GET /reports/sales filtra por tenantId ✅
- [x] GET /reports/inventory filtra por tenantId ✅
- [x] GET /reports/cash filtra por tenantId ✅
- [x] GET /reports/customers filtra por tenantId ✅
- [x] GET /reports/actionable-indicators filtra por tenantId ✅
- [x] GET /reports/customer-clusters filtra por tenantId ✅
- [x] GET /reports/trending-products filtra por tenantId ✅
- [x] GET /reports/dashboard-summary filtra por tenantId ✅
- [x] Todos los reportes filtran por tenantId ✅
- [x] Auditoría: listado y GET por entidad filtran por tenantId ✅
- [ ] Script automatizado detecta queries sin tenantId (opcional)

## Seguridad de acceso

- [x] Rate limit activo en POST /auth/login (10 req/min por IP) ✅
- [x] Rate limit activo en GET /reports/* (30 req/min por usuario) ✅
- [x] Rate limit activo en GET /reports/export (10 req/min por usuario) ✅
- [x] CORS configurado con ALLOWED_ORIGINS en producción ✅
- [x] Controladores críticos usan PermissionsGuard + @RequirePermission ✅
- [x] Frontend oculta/deshabilita acciones según permisos ✅
- [x] Frontend muestra mensajes claros ante 403 ✅
- [ ] Tests E2E verifican permisos (pendiente)

## Stripe y pagos

- [x] Webhook Stripe verifica firma ✅
- [x] Idempotencia por event.id (guardar StripeEvent y verificar antes de procesar) ✅
- [x] Manejo de reintentos: webhook responde 200 aunque falle procesamiento interno ✅
- [ ] Tests E2E de webhooks (invoice.paid, payment_failed, subscription.deleted) (pendiente)
- [ ] Tests E2E de idempotencia (mismo event.id dos veces) (pendiente)

## Flujos SaaS

- [ ] Tests E2E: crear tenant + admin + subscription
- [ ] Tests E2E: cambiar plan
- [ ] Tests E2E: renovar suscripción
- [ ] Tests E2E: suspensión automática por impago
- [ ] Tests E2E: reactivación tras pago

## Base de datos

- [ ] Índices compuestos en tablas críticas (Sale, AuditLog, Product)
- [ ] Queries N+1 identificadas y corregidas
- [ ] Plan de retención documentado (AuditLog, Sale, DianDocument)
- [ ] Job de archivado implementado (opcional)

## Performance

- [ ] Caché por tenant en reportes críticos
- [ ] Endpoints costosos identificados y optimizados
- [ ] Latencia P95 < 2s en endpoints críticos
- [ ] Load test con 100 tenants simultáneos (opcional)

## Operación

- [ ] Monitor externo configurado (GET /health cada 1–2 min)
- [ ] Alertas: 5xx rate > 1%, health failed, colas con failed > 10
- [ ] Rotación de secretos documentada en runbook
- [ ] Prueba de restore de backup calendarizada (mensual)
- [ ] Correlation ID propagado a logs (opcional)

---

# Conclusión y recomendaciones

## Prioridad de implementación

**Sprint 1 (Críticos — 1 semana):** ✅ **COMPLETADO**
1. ✅ Corregir fugas multi-tenant (getStats, getDashboard, getOperationalState, getSalesReport, inventory, cash, customers, actionable-indicators, customer-clusters, trending-products, dashboard-summary)
2. ✅ Activar rate limiting en login y reportes
3. ✅ Idempotencia en webhooks Stripe
4. ✅ CORS estricto en producción
5. ✅ PermissionsGuard en endpoints críticos (cash, sales, expenses)
6. ✅ Frontend: manejo de 403 y ocultar acciones según permisos

**Sprint 2 (Altos — 1 semana):**
6. Tests E2E de flujos SaaS (provider, billing)
7. Alertas básicas (health, 5xx, colas)
8. Caché por tenant en reportes
9. Índices compuestos en tablas críticas

**Sprint 3 (Medios — opcional):**
10. Correlation ID en logs
11. Métricas persistentes (Prometheus)
12. Pre-agregados para métricas frecuentes
13. Jobs async para reportes pesados

## Evaluación final

**¿Listo para clientes pagos?**  
✅ **Sí, tras Sprint 1 (críticos).**  
⏱️ **Tiempo estimado:** 1 semana.

**¿Listo para escalar a 100+ tenants?**  
✅ **Sí, tras Sprint 1 + Sprint 2.**  
⏱️ **Tiempo estimado:** 2 semanas.

**¿Listo para producción enterprise?**  
⚠️ **Parcialmente.** Requiere Sprint 3 (métricas, pre-agregados, jobs async).  
⏱️ **Tiempo estimado:** 3–4 semanas total.

---

**Última actualización:** Febrero 2026
