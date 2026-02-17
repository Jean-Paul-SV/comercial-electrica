# Tests corregidos después de auditoría de seguridad

**Fecha:** 2026-02-11  
**Contexto:** Correcciones de seguridad implementadas; tests actualizados para reflejar cambios.

---

## ✅ Tests que pasan

### 1. **auth.service.spec.ts** - ✅ 12/12 tests pasando

**Cambios realizados:**
- Añadido mock de `PlanLimitsService` (validateUserLimit, getTenantLimits).
- Añadidos mocks de `prisma.tenant` (findUnique, update) y `prisma.$transaction`.
- Payload JWT en tests **sin** `email` (seguridad).
- Resultado de login incluye `isPlatformAdmin`.
- `select` de `user.findUnique` incluye `isActive`.

**Estado:** ✅ Todos los tests pasan.

---

### 2. **cash.service.spec.ts** - ✅ 10/10 tests pasando

**Cambios realizados:**
- Añadido mock de `TenantContextService` (ensureTenant).
- Añadido `validateClosingAmount` al mock de `ValidationLimitsService`.
- Expectativas actualizadas para incluir `tenantId` en `create` de sesiones.
- Mock de `findFirst` para `getSession` en test de `listMovements`.

**Estado:** ✅ Todos los tests pasan.

---

### 3. **inventory.service.spec.ts** - ✅ 9/9 tests pasando

**Cambios realizados:**
- Añadido mock de `TenantContextService` (ensureTenant).

**Estado:** ✅ Todos los tests pasan.

---

### 4. **sales.service.spec.ts** - ✅ 11/11 tests pasando

**Cambios realizados:**
- Uso del **use case real** `CreateSaleUseCase` (no mock) y mock de `DianService` (getConfigStatusForTenant).
- Mock de Prisma con `cashSession.findFirst`, `customer.findFirst`; expectativa de `dianQueue.add` con `jobId`.
- Mock de `CacheService.get` para listSales; `inventoryMovement.create` en mocks de transacción.
- Tests de sesión/cliente que reemplazaban el objeto completo ahora solo asignan `findFirst`.
- Expectativa de error de productos sin `missingProductIds` (seguridad).

**Estado:** ✅ Todos los tests pasan.

---

### 5. **quotes.service.spec.ts** - ✅ 18/18 tests pasando

**Cambios realizados:**
- Mock de `TenantContextService` y `DianService`.
- Prisma: `quote.findFirst`, `customer.findFirst`, `cashSession.findFirst` en el mock y por defecto.
- Todas las asignaciones `prisma.quote.findUnique` sustituidas por `prisma.quote.findFirst` (getQuoteById usa findFirst).
- Test "cliente no existe" usa `customer.findFirst`; expectativa de createQuote usa `findFirst` con tenantId.
- Mock de `AuditService` con método `log` para updateQuoteStatus.

**Estado:** ✅ Todos los tests pasan.

---

### 6. **billing.service.spec.ts** - ✅ Pasando

**Cambios realizados:**
- Mock de `$transaction` (recibe array de operaciones) y `subscription.updateMany`.
- Test "customer.subscription.deleted" actualizado para usar y comprobar `updateMany` en lugar de `update`.

**Estado:** ✅ Todos los tests pasan.

---

### 7. **validation-limits.service.spec.ts** - ✅ Pasando

**Cambios realizados:**
- Tests que llamaban a `validateSaleItems` / `validateQuoteItems` actualizados a la API actual: `validateItemsCount(count, 'sale'|'quote')` y `validateItemQty(qty)`.

**Estado:** ✅ Todos los tests pasan.

---

## 📊 Resumen

| Spec | Estado | Tests pasando |
|------|--------|---------------|
| `auth.service.spec.ts` | ✅ | 12/12 |
| `cash.service.spec.ts` | ✅ | 10/10 |
| `inventory.service.spec.ts` | ✅ | 9/9 |
| `sales.service.spec.ts` | ✅ | 11/11 |
| `quotes.service.spec.ts` | ✅ | 18/18 |
| `billing.service.spec.ts` | ✅ | 4/4 |
| `validation-limits.service.spec.ts` | ✅ | 12/12 |
| Otros (dian, plan-limits, app.controller) | ✅ | 30/30 |

**Total:** 10 suites, **106 tests pasando**.

---

## 🔧 Patrón de corrección aplicado

Para specs que fallan por dependencias faltantes:

1. **Identificar dependencias faltantes** del error de Jest.
2. **Añadir imports** de los servicios necesarios.
3. **Añadir mocks** en el array de `providers`:
   ```typescript
   {
     provide: TenantContextService,
     useValue: {
       ensureTenant: jest.fn((tenantId) => tenantId || 'tenant-default'),
     },
   },
   {
     provide: PlanLimitsService,
     useValue: {
       validateUserLimit: jest.fn().mockResolvedValue(undefined),
       getTenantLimits: jest.fn().mockResolvedValue({ maxUsers: null, currentUsers: 0, canAddUsers: true }),
     },
   },
   ```
4. **Actualizar expectativas** si el comportamiento cambió (ej. `tenantId` en creates, payload JWT sin email).

---

## 📝 Notas

- Los tests de `SalesService` y `QuotesService` pueden requerir reescritura más profunda si la arquitectura cambió significativamente (uso de use cases).
- Los mocks de `TenantContextService` y `PlanLimitsService` son comunes y pueden extraerse a un helper si hay muchos specs.
- Considerar crear un archivo `test-helpers.ts` con mocks reutilizables.
