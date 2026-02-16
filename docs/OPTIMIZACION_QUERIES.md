# 🚀 Optimización de Queries y Rendimiento

**Fecha:** 2026-02-16  
**Estado:** Documentación y guía de optimización

---

## 📋 Índice

1. [Análisis de Queries](#análisis-de-queries)
2. [Optimización de N+1 Queries](#optimización-de-n1-queries)
3. [Índices Existentes](#índices-existentes)
4. [Índices Recomendados](#índices-recomendados)
5. [Caché y Estrategias](#caché-y-estrategias)
6. [Monitoreo de Performance](#monitoreo-de-performance)

---

## 🔍 Análisis de Queries

### Queries Críticas Identificadas

#### 1. Listado de Ventas (`SalesService.listSales`)

**Query actual:**
```typescript
this.prisma.sale.findMany({
  where: { tenantId },
  select: {
    items: { include: { product: true } },
    customer: true,
    invoices: true,
    createdBy: true,
  },
  skip,
  take: limit,
});
```

**Estado:** ✅ Optimizado - Usa `include` para evitar N+1

**Índices utilizados:**
- `@@index([tenantId])`
- `@@index([tenantId, soldAt])` - Para ordenamiento

**Mejoras aplicadas:**
- Caché para primera página sin búsqueda
- `Promise.all` para queries paralelas (data + count)

---

#### 2. Reporte de Ventas (`ReportsService.getSalesReport`)

**Query actual:**
```typescript
this.prisma.sale.findMany({
  where: {
    tenantId,
    status: 'PAID',
    soldAt: { gte: startDate, lte: endDate },
  },
  select: {
    items: { include: { product: true } },
    customer: true,
    invoices: true,
  },
  orderBy: { soldAt: 'desc' },
  take: limit,
});
```

**Estado:** ✅ Optimizado - Usa índices compuestos

**Índices utilizados:**
- `@@index([tenantId, soldAt])` - Para filtros de fecha
- `@@index([status])` - Para filtro de status

---

#### 3. Dashboard (`ReportsService.getDashboard`)

**Queries múltiples:**
```typescript
// Múltiples queries separadas
const todaySales = await prisma.sale.findMany({ ... });
const totalProducts = await prisma.product.count({ ... });
const totalCustomers = await prisma.customer.count({ ... });
```

**Estado:** ⚠️ Mejorable - Usa caché pero podría optimizarse

**Mejoras aplicadas:**
- Caché de resultados completos (TTL: 60s)
- `Promise.all` para queries paralelas

**Recomendación futura:**
- Considerar materialized views para agregaciones frecuentes
- Caché más granular por componente

---

## 🔧 Optimización de N+1 Queries

### Patrón Correcto (Ya Implementado)

**✅ Buen ejemplo - SalesService.listSales:**
```typescript
const sales = await this.prisma.sale.findMany({
  where: { tenantId },
  include: {
    items: { include: { product: true } }, // ✅ Incluye producto
    customer: true,                         // ✅ Incluye cliente
    invoices: true,                         // ✅ Incluye facturas
  },
});
```

**Resultado:** 1 query principal + joins automáticos (eficiente)

### Patrón Incorrecto (Evitar)

**❌ Mal ejemplo:**
```typescript
const sales = await this.prisma.sale.findMany({ where: { tenantId } });
// Luego iterar y hacer queries individuales:
for (const sale of sales) {
  const customer = await prisma.customer.findUnique({ where: { id: sale.customerId } });
  // ❌ N+1 problem!
}
```

### Verificación de N+1

Para detectar problemas N+1 en desarrollo:

```typescript
// Habilitar logging de queries en Prisma
// apps/api/src/prisma/prisma.service.ts
log: process.env.NODE_ENV === 'development' 
  ? ['query', 'error', 'warn'] 
  : ['error', 'warn']
```

Revisar logs para detectar múltiples queries similares en secuencia.

---

## 📊 Índices Existentes

### Índices por Modelo

#### Sale
```prisma
@@index([tenantId])
@@index([soldAt])
@@index([tenantId, soldAt])  // ✅ Compuesto para queries comunes
@@index([customerId])
@@index([status])
@@index([createdByUserId])
```

#### Product
```prisma
@@index([tenantId])
@@index([name])
@@index([categoryId])
@@index([isActive])
@@index([createdAt])
```

#### Customer
```prisma
@@index([tenantId])
@@index([name])
```

#### AuditLog
```prisma
@@index([tenantId])
@@index([createdAt])
@@index([entity, action])
```

---

## 🎯 Índices Recomendados

### Índices Adicionales Sugeridos

#### 1. Para Búsquedas de Texto

**Customer - Búsqueda por docNumber:**
```prisma
@@index([tenantId, docNumber])  // Para búsquedas por documento
```

**Product - Búsqueda por SKU:**
```prisma
@@index([tenantId, internalCode])  // Ya existe como unique
```

#### 2. Para Reportes por Fecha

**Sale - Reportes mensuales:**
```prisma
// Ya existe: @@index([tenantId, soldAt])
// Considerar índice parcial para ventas pagadas:
// CREATE INDEX idx_sale_paid_date ON "Sale"(tenantId, soldAt) WHERE status = 'PAID';
```

**Invoice - Facturas por fecha:**
```prisma
@@index([tenantId, issuedAt])  // Ya existe
```

#### 3. Para Filtros Comunes

**Quote - Por status y fecha:**
```prisma
@@index([tenantId, status, validUntil])  // Para expiración
```

**PurchaseOrder - Por status:**
```prisma
@@index([tenantId, status, orderDate])  // Para seguimiento
```

### Crear Índices Adicionales

**Migración de ejemplo:**
```sql
-- Migration: add_indexes_for_performance
CREATE INDEX IF NOT EXISTS "Customer_tenantId_docNumber_idx" 
  ON "Customer"("tenantId", "docNumber");

CREATE INDEX IF NOT EXISTS "Sale_tenantId_status_soldAt_idx" 
  ON "Sale"("tenantId", "status", "soldAt") 
  WHERE "status" = 'PAID';
```

---

## 💾 Caché y Estrategias

### Estrategias de Caché Implementadas

#### 1. Caché de Listados
```typescript
// Primera página sin búsqueda: TTL 60s
const cacheKey = cache.buildKey('sales', 'list', tenantId, 1, 20);
```

#### 2. Caché de Dashboard
```typescript
// Dashboard completo: TTL 60s
const cacheKey = cache.buildKey('dashboard', tenantId);
```

#### 3. Invalidación de Caché
```typescript
// Al crear/actualizar venta
cache.invalidate('sales', tenantId);
cache.invalidate('dashboard', tenantId);
```

### Mejoras Futuras

1. **Caché de consultas frecuentes:**
   - Top productos vendidos
   - Clientes más activos
   - Totales mensuales

2. **Caché distribuido (Redis):**
   - Ya implementado con `CacheService`
   - Considerar TTL más largos para datos menos volátiles

3. **Pre-computación:**
   - Materialized views para agregaciones complejas
   - Jobs nocturnos para cálculos pesados

---

## 📈 Monitoreo de Performance

### Métricas Disponibles

1. **Métricas HTTP:**
   - Latencia promedio (`api_http_request_duration_seconds_avg`)
   - Latencia máxima (`api_http_request_duration_seconds_max`)
   - Requests por endpoint

2. **Métricas de BD:**
   - Logs de queries lentas (habilitar en desarrollo)
   - Connection pool usage

### Herramientas Recomendadas

1. **Prisma Studio:**
   ```bash
   npx prisma studio
   ```
   - Explorar datos y probar queries

2. **EXPLAIN ANALYZE:**
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM "Sale" 
   WHERE "tenantId" = '...' 
   ORDER BY "soldAt" DESC 
   LIMIT 20;
   ```

3. **Prometheus/Grafana:**
   - Monitorear latencia de endpoints
   - Alertas cuando latencia > threshold

### Queries Lentas - Troubleshooting

**Síntoma:** Endpoint `/sales` tarda > 1 segundo

**Diagnóstico:**
1. Verificar índices: `EXPLAIN ANALYZE` en la query
2. Revisar caché: ¿está funcionando?
3. Verificar volumen de datos: ¿hay demasiados registros?
4. Revisar joins: ¿hay N+1 queries?

**Solución:**
- Agregar índices faltantes
- Optimizar query (select solo campos necesarios)
- Implementar paginación más eficiente
- Considerar archivado de datos antiguos

---

## 🔗 Referencias

- [Prisma Performance](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Query Optimization](https://www.postgresql.org/docs/current/performance-tips.html)

---

**Última actualización:** 2026-02-16
