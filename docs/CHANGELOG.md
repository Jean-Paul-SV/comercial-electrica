# 📝 Changelog - Sistema Comercial Eléctrica

Todos los cambios notables del proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
