# 📊 Monitoreo de Performance de Queries

**Fecha:** 2026-02-16  
**Propósito:** Guía para monitorear y optimizar queries de base de datos

---

## 📋 Índice

1. [Configuración](#configuración)
2. [Query Logging en Prisma](#query-logging-en-prisma)
3. [Detección de Queries Lentas](#detección-de-queries-lentas)
4. [Análisis de Performance](#análisis-de-performance)
5. [Optimización de Queries](#optimización-de-queries)

---

## ⚙️ Configuración

### Variables de Entorno

```env
# Habilitar monitoreo de queries (default: false)
QUERY_PERFORMANCE_MONITORING=true

# Umbral para considerar query lenta en milisegundos (default: 1000ms)
SLOW_QUERY_THRESHOLD_MS=1000

# Habilitar logging de queries en Prisma (solo desarrollo)
# En producción, usar solo 'error', 'warn'
NODE_ENV=development
```

### Logging de Prisma

El `PrismaService` ya está configurado para logging automático:

**Desarrollo:**
```typescript
log: ['query', 'error', 'warn']
```

**Producción:**
```typescript
log: ['error', 'warn']
```

---

## 🔍 Query Logging en Prisma

### Ver Queries en Desarrollo

Cuando `NODE_ENV=development`, Prisma registra todas las queries:

```bash
# Ver logs en tiempo real
npm run dev:api | grep "prisma:query"
```

**Ejemplo de log:**
```
prisma:query SELECT "Sale".* FROM "Sale" WHERE "Sale"."tenantId" = $1 ORDER BY "Sale"."soldAt" DESC LIMIT $2 OFFSET $3
prisma:query SELECT "Customer".* FROM "Customer" WHERE "Customer"."id" IN ($1)
```

### Analizar Queries Lentas

1. **Habilitar query logging:**
   ```typescript
   // Ya configurado en PrismaService
   log: process.env.NODE_ENV === 'development' 
     ? ['query', 'error', 'warn'] 
     : ['error', 'warn']
   ```

2. **Revisar logs:**
   ```bash
   # Filtrar queries que tardan mucho
   tail -f logs/app.log | grep "prisma:query" | grep -i "slow"
   ```

3. **Usar EXPLAIN ANALYZE:**
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM "Sale" 
   WHERE "tenantId" = 'uuid' 
   ORDER BY "soldAt" DESC 
   LIMIT 20;
   ```

---

## 🐌 Detección de Queries Lentas

### Servicio de Monitoreo

El `QueryPerformanceService` detecta y registra queries lentas:

```typescript
// Registrar query lenta manualmente
queryPerformance.recordSlowQuery(
  'SELECT * FROM Sale WHERE tenantId = ?',
  1500, // duración en ms
  { tenantId: 'uuid' }
);

// Obtener queries lentas
const slowQueries = queryPerformance.getSlowQueries(20);

// Analizar y obtener recomendaciones
const analysis = queryPerformance.analyzeSlowQueries();
```

### Endpoint de Métricas

**GET** `/metrics/slow-queries`

**Response:**
```json
{
  "total": 15,
  "averageDuration": 1250,
  "maxDuration": 3500,
  "recommendations": [
    "Considerar agregar índices adicionales",
    "Query pattern frecuente detectado: SELECT * FROM Sale..."
  ],
  "queries": [
    {
      "query": "SELECT * FROM Sale WHERE tenantId = ?",
      "duration": 1500,
      "timestamp": "2026-02-16T10:00:00Z"
    }
  ]
}
```

---

## 📈 Análisis de Performance

### 1. Detectar N+1 Queries

**Síntoma:** Múltiples queries similares en secuencia

**Ejemplo de problema:**
```typescript
// ❌ Mal: N+1 queries
const sales = await prisma.sale.findMany({ where: { tenantId } });
for (const sale of sales) {
  const customer = await prisma.customer.findUnique({ 
    where: { id: sale.customerId } 
  });
}
```

**Solución:**
```typescript
// ✅ Bien: 1 query con include
const sales = await prisma.sale.findMany({
  where: { tenantId },
  include: { customer: true }
});
```

### 2. Analizar Índices

**Verificar índices existentes:**
```sql
-- Listar índices de una tabla
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'Sale';
```

**Verificar uso de índices:**
```sql
EXPLAIN ANALYZE 
SELECT * FROM "Sale" 
WHERE "tenantId" = 'uuid' 
ORDER BY "soldAt" DESC;
```

**Si no usa índice:**
- Verificar que el índice existe
- Verificar que la query puede usar el índice
- Considerar índice compuesto

### 3. Optimizar SELECT

**Problema:** Seleccionar todos los campos cuando solo se necesitan algunos

```typescript
// ❌ Mal: Selecciona todos los campos
const products = await prisma.product.findMany();

// ✅ Bien: Selecciona solo campos necesarios
const products = await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    price: true,
    // Solo campos necesarios
  }
});
```

---

## 🚀 Optimización de Queries

### Checklist de Optimización

- [ ] **Usar `include` estratégicamente** para evitar N+1
- [ ] **Usar `select`** para limitar campos retornados
- [ ] **Verificar índices** con EXPLAIN ANALYZE
- [ ] **Agregar índices compuestos** para queries frecuentes
- [ ] **Usar paginación** en todos los listados
- [ ] **Implementar caché** para queries frecuentes
- [ ] **Archivar datos antiguos** para reducir volumen

### Índices Recomendados

Ver `docs/OPTIMIZACION_QUERIES.md` para índices específicos recomendados.

### Caché

Ver `docs/OPTIMIZACION_QUERIES.md` para estrategias de caché.

---

## 🔗 Referencias

- Optimización de queries: `docs/OPTIMIZACION_QUERIES.md`
- Optimizaciones avanzadas: `docs/OPTIMIZACIONES_AVANZADAS.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`

---

**Última actualización:** 2026-02-16
