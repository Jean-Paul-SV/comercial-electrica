## Operación en producción y alertas mínimas

Este documento resume **cómo operar la API en producción** y qué **alertas mínimas** configurar antes de tener clientes pagos.

---

## 1. Endpoints críticos de operación

- **Healthcheck**
  - **Ruta**: `GET /health`
  - **Qué verifica**:
    - Conexión a **PostgreSQL**
    - Conexión a **Redis**
    - Estado básico de colas **BullMQ** (`dian`, `backup`, `reports`)
  - **Uso recomendado**:
    - Configurar un monitor de uptime (StatusCake, BetterUptime, Pingdom, etc.) apuntando a esta ruta.
    - Marcar el despliegue como **healthy** solo si devuelve **200** en esta ruta.

- **Métricas**
  - **Ruta JSON**: `GET /metrics`
    - Snapshot en JSON (total de requests, buckets por status, latencias promedio/máxima, top routes).
    - Protegida con **JWT + permiso** `metrics:read`.
  - **Ruta Prometheus**: `GET /metrics/prometheus`
    - Formato **exposition text** para Prometheus.
    - Protegida con **JWT + permiso** `metrics:read`.
  - **Variable de control**:
    - `METRICS_ENABLED` = `true` / `false` (por defecto `true`). Si es `false`, ambas rutas devuelven **404**.

- **Logs estructurados**
  - La API usa:
    - `AllExceptionsFilter` para capturar **todas** las excepciones.
    - `Logger` de NestJS, con formato JSON cuando `LOG_FORMAT=json`.
  - Cada error incluye:
    - `statusCode`, `path`, `method`, `userId` (si está disponible), `requestId`, `ip`, `userAgent`.

---

## 2. Monitoreo y alertas recomendadas

### 2.1. Salud general de la API

- **Monitor de uptime (externo)**:
  - Apuntar a: `GET /health`.
  - Alertar cuando:
    - Respuesta ≠ **200**.
    - Tiempo de respuesta > **2–3 s** de forma sostenida.

### 2.2. Errores 5xx y degradación

Usando `GET /metrics/prometheus` (scrapeado por Prometheus/Grafana u otra solución compatible):

- **Errores 5xx**:
  - Métrica: `api_http_requests_by_status{status="5xx"}`.
  - Regla sugerida:
    - Alertar si el incremento en 5 minutos es > **N** (ajustar a tráfico real).

- **Latencia promedio**:
  - Métrica: `api_http_request_duration_seconds_avg`.
  - Regla sugerida:
    - Alertar si se mantiene por encima de **0.5–1 s** durante más de **5–10 min**.

### 2.3. Logs y patrones críticos

Configure un sistema de logs centralizado (ELK, Loki, CloudWatch, etc.) y cree alertas basadas en patrones:

- **DIAN**:
  - Buscar mensajes que contengan:
    - `"Error procesando documento DIAN"`
    - `"Documento DIAN ... rechazado por DIAN"`
  - Alertar si estos mensajes aparecen **N veces en 10 min**.

- **Stripe / pagos**:
  - Buscar mensajes relacionados con fallos de webhooks Stripe:
    - Errores 4xx/5xx en rutas `/billing/webhooks/stripe`.
    - Mensajes de log de `billing.service` con “payment_failed”, “subscription_deleted”, etc.
  - Alertar si:
    - Hay una serie de fallos de webhook.
    - Se incrementan los eventos de tipo “payment_failed” sin recuperación.

- **Backups**:
  - Entidad `BackupRun` almacena los runs de backup por tenant.
  - Crear una alerta si:
    - `BackupRun.status != 'success'` para el último run.
    - No existe ningún run reciente (por ejemplo, en las últimas 24 h).

---

## 3. Consideraciones específicas por módulo

### 3.1. Stripe / suscripciones

- Revisar periódicamente:
  - Tabla `Subscription` (**status**, `currentPeriodEnd`, `lastPaymentFailedAt`).
  - Tabla `StripeEvent` (últimos eventos procesados).
- Recomendación:
  - Programar un **job de reconciliación** periódico:
    - Listar suscripciones desde Stripe.
    - Comparar con `Subscription` local.
    - Generar alerta o corrección cuando haya desviaciones.

### 3.2. DIAN

- Estado actual:
  - Envío a DIAN **simulado** (`sendToDian` con respuesta mock).
  - Aun así, es crítico monitorear:
    - Errores al procesar documentos (`processDocument`).
    - Estados `DianDocument.status = REJECTED` con `lastError` no vacío.
- Recomendación:
  - Crear dashboard simple con:
    - Número de documentos en cada estado (DRAFT, SENT, ACCEPTED, REJECTED).
    - Lista de últimos `REJECTED` con `lastError`.

### 3.3. Backups

- Ver tabla `BackupRun`:
  - Campos clave: `tenantId`, `startedAt`, `finishedAt`, `status`, `storagePath`, `checksum`.
- Recomendación:
  - Tener **tareas de verificación de restore** (no solo que el backup corra, sino que se pueda restaurar).

---

## 4. Variables de entorno relevantes

- **Logs / errores**
  - `LOG_FORMAT=json` → logs estructurados en JSON.

- **Métricas**
  - `METRICS_ENABLED=true|false` → habilitar/deshabilitar `/metrics` y `/metrics/prometheus`.

- **Stripe**
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

- **DIAN (pre-integración)**
  - `DIAN_ENV` (por ejemplo `HABILITACION`)
  - `DIAN_SOFTWARE_ID`
  - `DIAN_SOFTWARE_PIN`
  - `DIAN_CERT_PATH`
  - `DIAN_CERT_PASSWORD`

---

## 5. Checklist previa a “go-live” con clientes pagos

- **Infraestructura**
  - [ ] Base de datos PostgreSQL administrada (backups automáticos habilitados).
  - [ ] Redis administrado para colas y claves de idempotencia.
  - [ ] Contenedores separados para API y workers (BullMQ).

- **Monitoreo**
  - [ ] Monitor de uptime apuntando a `GET /health`.
  - [ ] Scrape de `GET /metrics/prometheus` configurado.
  - [ ] Alertas por:
    - [ ] Aumento de 5xx.
    - [ ] Latencia promedio alta.
    - [ ] Errores DIAN repetidos.
    - [ ] Fallos repetidos en webhooks Stripe.
    - [ ] Backups fallidos o inexistentes en últimas 24 h.

- **Seguridad / multi-tenant**
  - [ ] Tests E2E de aislamiento multi-tenant (incluido DIAN) ejecutados y en verde.
  - [ ] Verificado que tenants suspendidos no pueden operar en módulos críticos.

Este documento debería mantenerse actualizado según se vaya fortaleciendo la integración real con DIAN y se añadan más métricas o jobs de reconciliación.

