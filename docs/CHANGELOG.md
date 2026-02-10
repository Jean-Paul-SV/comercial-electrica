# 📝 Changelog - Orion

Todos los cambios notables del proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Sin Versión] - 2026-02-03

### ✅ Agregado
- **Documentación**
  - README principal: sección "Inicio rápido (uso diario)" con enlace a `docs/LEVANTAR_PROYECTO.md`
  - `docs/LEVANTAR_PROYECTO.md`: sección sobre errores `ERR_CONNECTION_REFUSED` y 500 en consola
  - `docs/README.md`: enlace destacado a LEVANTAR_PROYECTO y fecha Febrero 2026

### 🔧 Corregido
- **Gastos (expenses):** el frontend dejó de enviar la propiedad `kind` en `POST /expenses` (la API no la acepta), evitando 400 "property kind should not exist"
- **Facturas proveedor:** al registrar un pago se crea el gasto asociado con `tenantId`; corregido "Argument `tenant` is missing" en `expenseDelegate.create()`

### 🛡️ Mantenimiento y optimización
- **Rate limiting (API):** en desarrollo (`NODE_ENV !== 'production'`) el throttle no aplica límites para evitar 429; límites aumentados (short/medium/long) para producción
- **Login (frontend):** interfaz refinada (fondo con gradiente, tarjeta con acento, mejor jerarquía visual)
- **Dashboard (frontend):** `useMemo` para datos del gráfico KPI; imports de lucide-react unificados
- **React Query:** `staleTime` 60 s global, `gcTime` 5 min; reportes/dashboard con `staleTime` 90 s
- **Next.js:** `optimizePackageImports: ['lucide-react']`; páginas `reset-password` y `accept-invite` envueltas en `Suspense` por `useSearchParams`
- **Dialog (UI):** soporte de `onPointerDownOutside` y `onEscapeKeyDown` en `DialogContent` (ChangePasswordDialog con `forceOpen`)
- **Recharts:** dimensiones mínimas en `KpiBarChart`, `CashInOutChart`, `SalesByDayChart`, `TopCustomersChart` para evitar warning width/height -1
- **Layout (frontend):** `data-scroll-behavior="smooth"` en `<html>` para advertencia de Next.js

---

## [Sin Versión] - 2026-01-28

### ✅ Agregado
- **Observabilidad básica**
  - `GET /metrics` (requiere JWT + rol ADMIN; se puede deshabilitar con `METRICS_ENABLED=false`)
  - Header `x-request-id` para correlación de requests (incluido en respuestas de error)
- **Health check mejorado**: `GET /health` ahora incluye **DB + Redis + colas** (BullMQ)
- **Documento de estado**: `docs/ESTADO_ACTUAL_2026-01-28.md` como fuente de verdad del estado actual

### 🛡️ Seguridad / Hardening
- **CORS por entorno**: producción restringida con `ALLOWED_ORIGINS`
- **Validación/fail-fast de envs críticos** al arrancar (producción más segura)
- **JWT sin fallbacks inseguros** (falla si falta `JWT_ACCESS_SECRET`)

### 🧩 Calidad
- **Manejo de errores más profesional**
  - Mapeo ampliado de errores Prisma → HTTP (409/404/400/503/500)
  - Mensajes de validación anidados con rutas (`items[0].qty`)
- **Swagger/DTOs**: mejoras en ejemplos, required/optional consistentes y validaciones de arrays (`ArrayMinSize(1)`)

### ⚡ Performance/Operación
- **Redis**: invalidación por patrón sin `KEYS` (se usa `SCAN` para evitar bloqueo)

### 📚 Documentación
- README y `docs/README.md` actualizados con fase y enlaces al documento de estado

---

## [Sin Versión] - 2026-01-27

### ✅ Agregado
- **Endpoint `/health`** - Health check del sistema con información de estado, uptime y versión
- **Documentación actualizada** - Nuevo documento `OPINION_SENIOR_ACTUAL.md` con evaluación completa del proyecto
- **Correcciones de tests** - Documento `CORRECCIONES_TESTS.md` con resumen de correcciones aplicadas
- **Índice de documentación mejorado** - Referencias actualizadas a nuevos documentos

### 🔧 Corregido
- **Tests unitarios** - Corregidos mocks faltantes en:
  - `sales.service.spec.ts` - Agregados mocks de `customer.findUnique`
  - `quotes.service.spec.ts` - Agregados mocks de `product.findMany` en transacciones
  - `inventory.service.spec.ts` - Agregado mock de productos múltiples
  - `cash.service.spec.ts` - Corregido import dinámico de `BadRequestException`
  - `app.controller.spec.ts` - Actualizado mensaje esperado y agregado test de `/health`
- **Mocks de transacciones** - Completados mocks para transacciones complejas en QuotesService
- **Mensajes de error** - Corregidos mensajes esperados en tests (ej: "convertida" → "CONVERTED")

### 📚 Documentación
- **README principal** - Actualizado con:
  - Estado del proyecto (8.5/10 - EXCELENTE)
  - Referencias a nuevos documentos
  - Endpoint `/health` documentado
  - Sección de solución de problemas mejorada
- **docs/README.md** - Índice actualizado con nuevos documentos
- **Consistencia** - Todas las referencias cruzadas actualizadas

### 🎯 Mejoras
- **Calidad de tests** - Cobertura mejorada con mocks completos
- **Developer Experience** - Documentación más clara y organizada
- **Estado del proyecto** - Evaluación completa disponible en `OPINION_SENIOR_ACTUAL.md`

---

## [Anterior] - 2026-01-26

### ✅ Agregado
- Módulo de Cotizaciones completo
- Sistema de Reportes
- Estructura básica del procesador DIAN
- Validaciones robustas de reglas de negocio
- Manejo de errores mejorado
- Documentación Swagger/OpenAPI completa
- Tests unitarios y E2E extensos

---

**Nota:** Este changelog se actualiza conforme avanza el proyecto. Para ver el estado actual completo, consulta [OPINION_SENIOR_ACTUAL.md](./OPINION_SENIOR_ACTUAL.md).
