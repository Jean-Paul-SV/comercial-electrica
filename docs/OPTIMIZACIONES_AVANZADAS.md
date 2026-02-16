# 🚀 Optimizaciones Avanzadas

**Fecha:** 2026-02-16  
**Estado:** Guía de optimizaciones avanzadas para producción

---

## 📋 Índice

1. [Materialized Views](#materialized-views)
2. [Índices Parciales](#índices-parciales)
3. [Pre-computación de Reportes](#pre-computación-de-reportes)
4. [Caché Distribuido Avanzado](#caché-distribuido-avanzado)
5. [Particionamiento de Tablas](#particionamiento-de-tablas)

---

## 📊 Materialized Views

### Concepto

Las materialized views son tablas pre-computadas que almacenan resultados de queries complejas. Se actualizan periódicamente y mejoran significativamente el rendimiento de reportes frecuentes.

### Casos de Uso

#### 1. Dashboard Agregado Mensual

**Problema:** El dashboard calcula agregaciones en tiempo real (ventas del día, productos, clientes).

**Solución:** Crear materialized view con agregaciones diarias.

```sql
-- Crear materialized view
CREATE MATERIALIZED VIEW mv_daily_sales_summary AS
SELECT
  "tenantId",
  DATE("soldAt") as sale_date,
  COUNT(*) as total_sales,
  SUM("grandTotal") as total_revenue,
  COUNT(DISTINCT "customerId") as unique_customers
FROM "Sale"
WHERE "status" = 'PAID'
GROUP BY "tenantId", DATE("soldAt");

-- Crear índice único
CREATE UNIQUE INDEX idx_mv_daily_sales_summary_unique 
  ON mv_daily_sales_summary("tenantId", sale_date);

-- Actualizar periódicamente (ejecutar diariamente)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales_summary;
```

**Uso en código:**
```typescript
// En lugar de calcular en tiempo real:
const todaySales = await prisma.$queryRaw`
  SELECT COUNT(*), SUM("grandTotal")
  FROM "Sale"
  WHERE "tenantId" = ${tenantId}
    AND DATE("soldAt") = CURRENT_DATE
    AND "status" = 'PAID'
`;

// Usar materialized view:
const todaySales = await prisma.$queryRaw`
  SELECT total_sales, total_revenue
  FROM mv_daily_sales_summary
  WHERE "tenantId" = ${tenantId}
    AND sale_date = CURRENT_DATE
`;
```

#### 2. Top Productos Vendidos

```sql
CREATE MATERIALIZED VIEW mv_top_products_monthly AS
SELECT
  s."tenantId",
  DATE_TRUNC('month', s."soldAt") as month,
  si."productId",
  p.name as product_name,
  SUM(si.qty) as total_quantity,
  SUM(si."lineTotal") as total_revenue
FROM "Sale" s
JOIN "SaleItem" si ON s.id = si."saleId"
JOIN "Product" p ON si."productId" = p.id
WHERE s."status" = 'PAID'
GROUP BY s."tenantId", DATE_TRUNC('month', s."soldAt"), si."productId", p.name;

CREATE UNIQUE INDEX idx_mv_top_products_unique 
  ON mv_top_products_monthly("tenantId", month, "productId");
```

### Actualización Automática

**Opción 1: Job programado (NestJS)**
```typescript
@Cron('0 1 * * *') // Diario a la 1:00 AM
async refreshMaterializedViews() {
  await this.prisma.$executeRaw`
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales_summary;
  `;
  await this.prisma.$executeRaw`
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_products_monthly;
  `;
}
```

**Opción 2: Trigger de PostgreSQL (avanzado)**
```sql
-- Crear función que actualiza la view cuando hay cambios
CREATE OR REPLACE FUNCTION refresh_sales_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger (solo para cambios significativos)
CREATE TRIGGER sales_summary_refresh
AFTER INSERT OR UPDATE ON "Sale"
FOR EACH ROW
WHEN (NEW."status" = 'PAID')
EXECUTE FUNCTION refresh_sales_summary();
```

---

## 🎯 Índices Parciales

### Concepto

Los índices parciales solo indexan un subconjunto de filas que cumplen una condición. Son más pequeños y eficientes que índices completos.

### Ejemplos

#### 1. Índice para Ventas Pagadas

**Problema:** Las queries frecuentes filtran por `status = 'PAID'`.

**Solución:** Índice parcial solo para ventas pagadas.

```sql
-- Índice parcial (más pequeño y rápido)
CREATE INDEX idx_sale_paid_tenant_date 
ON "Sale"("tenantId", "soldAt")
WHERE "status" = 'PAID';

-- En lugar de índice completo:
-- CREATE INDEX idx_sale_tenant_date ON "Sale"("tenantId", "soldAt");
```

**Beneficios:**
- Menor tamaño (solo indexa ventas pagadas)
- Más rápido para queries que filtran por status
- Menos overhead en INSERT/UPDATE

#### 2. Índice para Productos Activos

```sql
CREATE INDEX idx_product_active_tenant_name
ON "Product"("tenantId", "name")
WHERE "isActive" = true;
```

#### 3. Índice para Cotizaciones Activas

```sql
CREATE INDEX idx_quote_active_tenant_valid
ON "Quote"("tenantId", "validUntil")
WHERE "status" IN ('DRAFT', 'SENT');
```

### Migración

```sql
-- Migration: add_partial_indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_paid_tenant_date 
ON "Sale"("tenantId", "soldAt")
WHERE "status" = 'PAID';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_active_tenant_name
ON "Product"("tenantId", "name")
WHERE "isActive" = true;
```

---

## 📈 Pre-computación de Reportes

### Estrategia

Pre-calcular reportes frecuentes durante horas de bajo tráfico y almacenar resultados.

### Implementación

#### 1. Servicio de Pre-computación

```typescript
@Injectable()
export class ReportPrecomputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Cron('0 2 * * *') // Diario a las 2:00 AM
  async precomputeDailyReports() {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      // Pre-calcular dashboard
      const dashboard = await this.computeDashboard(tenant.id);
      await this.cache.set(
        `precomputed:dashboard:${tenant.id}`,
        dashboard,
        86400, // 24 horas
      );

      // Pre-calcular top productos
      const topProducts = await this.computeTopProducts(tenant.id);
      await this.cache.set(
        `precomputed:top-products:${tenant.id}`,
        topProducts,
        86400,
      );
    }
  }

  private async computeDashboard(tenantId: string) {
    // Cálculos pesados aquí
    // ...
  }
}
```

#### 2. Uso en Endpoints

```typescript
async getDashboard(tenantId: string) {
  // Intentar obtener pre-computado
  const cached = await this.cache.get(`precomputed:dashboard:${tenantId}`);
  if (cached) {
    return cached;
  }

  // Fallback a cálculo en tiempo real
  return this.computeDashboardRealTime(tenantId);
}
```

---

## 💾 Caché Distribuido Avanzado

### Estrategias de Invalidación

#### 1. Invalidación por Eventos

```typescript
// Al crear venta
async createSale(dto: CreateSaleDto) {
  const sale = await this.prisma.sale.create({ ... });
  
  // Invalidar cachés relacionados
  await this.cache.invalidate('sales', sale.tenantId);
  await this.cache.invalidate('dashboard', sale.tenantId);
  await this.cache.invalidate('reports', sale.tenantId);
  
  return sale;
}
```

#### 2. TTL Inteligente

```typescript
// Caché más corto para datos que cambian frecuentemente
const TTL_SHORT = 60; // 1 minuto
const TTL_MEDIUM = 300; // 5 minutos
const TTL_LONG = 3600; // 1 hora

// Dashboard: TTL corto (cambia frecuentemente)
await cache.set(key, data, TTL_SHORT);

// Listado de productos: TTL medio
await cache.set(key, data, TTL_MEDIUM);

// Configuración: TTL largo
await cache.set(key, data, TTL_LONG);
```

#### 3. Caché por Capas

```typescript
// Capa 1: Caché en memoria (muy rápido, pequeño)
const memoryCache = new Map();

// Capa 2: Redis (rápido, distribuido)
const redisCache = new RedisCache();

// Capa 3: Base de datos (lento, persistente)
async getData(key: string) {
  // 1. Intentar memoria
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  
  // 2. Intentar Redis
  const redisData = await redisCache.get(key);
  if (redisData) {
    memoryCache.set(key, redisData); // Populate memoria
    return redisData;
  }
  
  // 3. Consultar BD
  const dbData = await this.fetchFromDB(key);
  await redisCache.set(key, dbData);
  memoryCache.set(key, dbData);
  return dbData;
}
```

---

## 🗂️ Particionamiento de Tablas

### Concepto

Dividir tablas grandes en particiones más pequeñas basadas en rangos (ej. por fecha). Mejora rendimiento de queries y mantenimiento.

### Ejemplo: Particionar Ventas por Mes

```sql
-- Tabla principal particionada
CREATE TABLE "Sale" (
  id UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "soldAt" TIMESTAMP NOT NULL,
  -- ... otros campos
) PARTITION BY RANGE ("soldAt");

-- Crear particiones mensuales
CREATE TABLE "Sale_2024_01" PARTITION OF "Sale"
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE "Sale_2024_02" PARTITION OF "Sale"
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- ... más particiones

-- Crear partición automáticamente (función)
CREATE OR REPLACE FUNCTION create_sale_partition(month_date DATE)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  start_date := DATE_TRUNC('month', month_date);
  end_date := start_date + INTERVAL '1 month';
  partition_name := 'Sale_' || TO_CHAR(start_date, 'YYYY_MM');
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF "Sale"
     FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;

-- Crear partición para el próximo mes (ejecutar mensualmente)
SELECT create_sale_partition(CURRENT_DATE + INTERVAL '1 month');
```

### Beneficios

- **Queries más rápidas:** PostgreSQL solo escanea particiones relevantes
- **Mantenimiento más fácil:** Eliminar particiones antiguas es rápido
- **Índices más pequeños:** Cada partición tiene sus propios índices

### Migración

```sql
-- 1. Crear nueva tabla particionada
CREATE TABLE "Sale_new" (LIKE "Sale" INCLUDING ALL)
PARTITION BY RANGE ("soldAt");

-- 2. Migrar datos por lotes
INSERT INTO "Sale_new" SELECT * FROM "Sale" WHERE "soldAt" >= '2024-01-01';

-- 3. Renombrar tablas
ALTER TABLE "Sale" RENAME TO "Sale_old";
ALTER TABLE "Sale_new" RENAME TO "Sale";

-- 4. Eliminar tabla antigua (después de verificar)
DROP TABLE "Sale_old";
```

---

## 🔗 Referencias

- [PostgreSQL Materialized Views](https://www.postgresql.org/docs/current/sql-creatematerializedview.html)
- [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [PostgreSQL Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [Redis Caching Strategies](https://redis.io/docs/manual/patterns/cache/)

---

**Última actualización:** 2026-02-16
