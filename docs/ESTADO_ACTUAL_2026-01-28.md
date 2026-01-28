# 📌 Estado Actual del Proyecto (Actualización)

> **Proyecto:** Sistema de Gestión Comercial Eléctrica  
> **Fecha:** 2026-01-28  
> **Objetivo de este documento:** ser la **fuente de verdad** del estado actual (fase, qué está listo, qué falta, y qué sigue).

---

## 🧭 Fase actual

✅ **Core API lista (módulos comerciales) + hardening de producción + observabilidad básica**

- **Core listo**: inventario, ventas, caja, clientes, catálogo, cotizaciones, reportes, backups, auditoría, auth.
- **Pendiente crítico**: 🔴 **DIAN real** (requisito legal): XML UBL, firma digital, envío real, CUFE, PDF/QR, trazabilidad completa.
- **Pendiente importante**: 🟡 **Frontend** (UI para operación real).

---

## ✅ Qué está listo (resumen)

- **API NestJS + Prisma**: arquitectura modular estable.
- **Swagger**: documentación disponible en `GET /api/docs`.
- **Validaciones**: DTOs con `class-validator` + `ValidationPipe` global (whitelist + transform + forbidNonWhitelisted).
- **Errores consistentes**: filtro global + mapeo de Prisma → HTTP (reduce 500 “raros”).
- **Backups**: módulo y endpoints + job automático (configurable por env).
- **Colas (BullMQ)**: colas `dian`, `backup`, `reports`.
- **Caché**: Redis con invalidación; se evita `KEYS` (se usa `SCAN`) para no bloquear Redis en datasets grandes.
- **Testing**: suites unitarias y E2E cubriendo flujos críticos.
- **CI**: pipeline con Postgres/Redis en GitHub Actions.

---

## 🧱 Hardening (lo que se “endureció”)

- **CORS por entorno**:
  - Dev: permisivo.
  - Prod: lista blanca con `ALLOWED_ORIGINS` (separado por comas).

- **Fail-fast (producción)**:
  - Validación de envs críticos (BD, Redis, JWT, etc.) al arrancar.
  - JWT sin fallbacks inseguros.
  - Prisma no “inventa” conexión en prod si falta `DATABASE_URL`.

- **Health check operativo**:
  - `GET /health` reporta **DB + Redis + colas**.

---

## 📈 Observabilidad (básica)

- **`x-request-id`**:
  - Cada request obtiene un ID de correlación (si el cliente no lo envía, se genera).
  - Se incluye en respuestas de error para trazabilidad.

- **Métricas simples**:
  - `GET /metrics` devuelve snapshot (requests, buckets por status, latencias, top rutas).
  - **Seguridad**: requiere **JWT + rol ADMIN**.
  - **Toggle**: `METRICS_ENABLED=false` lo deshabilita (responde 404).

---

## 🔌 Endpoints operativos clave

- `GET /health`: salud del sistema (DB/Redis/colas).
- `GET /metrics`: métricas simples (ADMIN).
- `GET /api/docs`: Swagger.

---

## ⚙️ Variables de entorno relevantes (nuevas/clave)

```env
# Producción (CORS)
ALLOWED_ORIGINS="https://tu-dominio.com,https://admin.tu-dominio.com"

# Observabilidad
METRICS_ENABLED=true
```

> Ver `env.example` para el listado completo.

---

## 🔴 Qué falta (prioridad)

### 1) DIAN real (crítico / requisito legal)

Pendiente implementar (alto nivel):
- Generación **XML UBL 2.1** completo (según normativa vigente).
- Firma digital con certificado (p12/pfx) y validación.
- Envío real a DIAN (habilitación/producción), manejo de respuestas y reintentos.
- Generación de PDF con QR/CUFE y almacenamiento.
- Auditoría/eventos DIAN completos (trazabilidad legal).

### 2) Frontend (importante)
- UI mínima para operación real (login, catálogo, inventario, caja, ventas, reportes).

### 3) Observabilidad avanzada (mejora)
- Métricas Prometheus, alertas, dashboards.
- Logging estructurado (JSON) + correlation/tracing.

---

## ✅ Próximo sprint recomendado (1–2 semanas)

- Completar checklist de producción (headers, rate limit por endpoint si aplica, políticas de despliegue).
- Fortalecer DIAN: separar servicios (XML generator, signer, client, PDF generator).
- Definir el alcance y stack del frontend (web admin).

