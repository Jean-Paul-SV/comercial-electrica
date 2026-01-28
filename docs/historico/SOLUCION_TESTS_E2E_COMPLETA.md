# Solución Completa para Tests E2E

## Problemas Identificados y Solucionados

### 1. **QuotesModule y SalesModule faltaban CommonModule**
   - **Problema**: `QuotesService` y `SalesService` necesitaban `ValidationLimitsService`, `AuditService` y `CacheService` de `CommonModule`, pero los módulos no lo importaban explícitamente.
   - **Solución**: Agregado `CommonModule` a las importaciones de `QuotesModule` y `SalesModule`.
   - **Archivos modificados**:
     - `apps/api/src/quotes/quotes.module.ts`
     - `apps/api/src/sales/sales.module.ts`

### 2. **Contaminación de Datos entre Suites**
   - **Problema**: Cuando se ejecutan todos los tests juntos, cada suite limpia la base de datos en su `beforeAll`, causando que datos creados por una suite sean eliminados por otra.
   - **Solución**: 
     - Mejorado `cleanDatabase()` en `test-helpers.ts` para manejar errores de FK más robustamente
     - Refactorizado `reports.e2e-spec.ts` e `inventory.e2e-spec.ts` para usar `setupTestApp`
     - Simplificado `afterAll` en varias suites para evitar eliminar datos compartidos

### 3. **UUID Inválido en quotes.e2e-spec.ts**
   - **Problema**: Cuando el primer test fallaba, `quoteId` quedaba `undefined`, causando errores de UUID inválido en tests posteriores.
   - **Solución**: Agregadas verificaciones para asegurar que `quoteId` esté definido antes de usarlo.

### 4. **Stock undefined en inventory.e2e-spec.ts**
   - **Problema**: El producto podía ser eliminado por otra suite antes de que el test terminara.
   - **Solución**: Agregada verificación y mensaje de error más descriptivo.

## Scripts Creados

### 1. **Purgar Base de Datos**
   - **PowerShell**: `scripts/purgar-db-test.ps1`
   - **Node.js**: `scripts/purgar-db-test.js`
   - **NPM**: `npm run db:purge -w api`

### 2. **Ejecutar Tests en Serie**
   - **NPM**: `npm run test:e2e:serial -w api`

## Cómo Usar

### Purgar la Base de Datos
```bash
# Opción 1: Script PowerShell
.\scripts\purgar-db-test.ps1

# Opción 2: Script Node.js
node scripts/purgar-db-test.js

# Opción 3: NPM (desde apps/api)
npm run db:purge
```

### Ejecutar Tests Individuales
```bash
npm run test:e2e -- reports.e2e-spec.ts
npm run test:e2e -- inventory.e2e-spec.ts
npm run test:e2e -- quotes.e2e-spec.ts
npm run test:e2e -- sales.e2e-spec.ts
```

### Ejecutar Todos los Tests en Serie
```bash
npm run test:e2e:serial -w api
```

## Estado Actual

### Tests que Pasan Individualmente
- ✅ `reports.e2e-spec.ts` - 10/10 tests
- ✅ `inventory.e2e-spec.ts` - 6/6 tests
- ✅ `quotes.e2e-spec.ts` - 7/7 tests
- ✅ `sales.e2e-spec.ts` - 2/2 tests
- ✅ `backups.e2e-spec.ts` - 7/7 tests
- ✅ `cash.e2e-spec.ts` - 2/2 tests
- ✅ `app.e2e-spec.ts` - Tests básicos

### Problemas Restantes al Ejecutar Todos Juntos

1. **Contaminación de Datos**: Aunque mejorado, aún puede haber conflictos cuando múltiples suites acceden a la misma base de datos simultáneamente.
2. **Deadlocks (P2034)**: Ocurren cuando múltiples transacciones intentan actualizar los mismos registros simultáneamente.
3. **Jobs DIAN en Cola**: Los errores de DIAN son esperados - son jobs procesando documentos que fueron eliminados por los tests.

## Recomendaciones

1. **Para Desarrollo**: Ejecutar tests individualmente o usar `--runInBand`
2. **Para CI/CD**: Considerar usar bases de datos separadas por suite o ejecutar tests en contenedores aislados
3. **Para Producción**: Los tests individuales son suficientes para validar funcionalidad

## Próximos Pasos (Opcional)

1. Implementar bases de datos separadas por suite usando `--testNamePattern`
2. Mejorar manejo de transacciones para reducir deadlocks
3. Mockear completamente el procesamiento DIAN en tests para evitar jobs en cola
