# Observabilidad – Métricas y logging

> **Referencia:** `QUE_HACE_FALTA.md` (mejoras opcionales).

---

## 1. Métricas

### 1.1 Endpoints

| Endpoint | Descripción | Autenticación |
|----------|-------------|---------------|
| **GET /metrics** | Snapshot en JSON: totalRequests, statusBuckets (2xx, 3xx, 4xx, 5xx), latencia (avg/max), top rutas. | JWT + permiso `metrics:read` |
| **GET /metrics/prometheus** | Formato exposition de Prometheus (text/plain). Para scraping con Prometheus/Grafana. | JWT + permiso `metrics:read` |

Si `METRICS_ENABLED=false`, ambos responden 404.

### 1.2 Variables de entorno

| Variable | Descripción | Uso |
|----------|-------------|-----|
| `METRICS_ENABLED` | `true` \| `false` | Si `false`, GET /metrics y GET /metrics/prometheus responden 404. |

### 1.3 Formato Prometheus

Las métricas expuestas en `/metrics/prometheus` incluyen:

- `api_http_requests_total` – Total de peticiones HTTP.
- `api_http_request_duration_seconds_avg` / `_max` – Latencia.
- `api_uptime_seconds` – Uptime del proceso.
- `api_http_requests_by_status{status="2xx|3xx|4xx|5xx|unknown"}` – Peticiones por bucket de estado.

Para configurar Prometheus (ej. `prometheus.yml`):

```yaml
scrape_configs:
  - job_name: 'comercial-electrica-api'
    metrics_path: /metrics/prometheus
    bearer_token: '<JWT o token de servicio>'
    static_configs:
      - targets: ['localhost:3000']
```

---

## 2. Logging estructurado (JSON)

Cuando `LOG_FORMAT=json`, el logger de la API escribe **una línea JSON por evento** en stdout/stderr. Campos:

- `timestamp` – ISO 8601.
- `level` – log, error, warn, debug, verbose.
- `context` – Contexto Nest (nombre del módulo/servicio).
- `message` – Mensaje del log.
- `trace` – (solo en error) Stack trace si existe.

Útil para agregadores (ELK, Datadog, CloudWatch) y búsqueda por nivel/contexto.

### 2.1 Variable de entorno

| Variable | Descripción | Uso |
|----------|-------------|-----|
| `LOG_FORMAT` | `json` \| (cualquier otro o no definido) | Si `json`, los logs se emiten en una línea JSON por evento. |

---

## 3. Correlation (Request ID)

Todas las peticiones reciben un **request ID**:

- **Header de respuesta:** `x-request-id`.
- Si el cliente envía `x-request-id`, se reutiliza; si no, se genera un UUID.

Útil para correlacionar logs de la misma petición en distintos servicios. El request ID se incluye en AuditLog (`requestId`) cuando se registra auditoría.

---

## 4. Resumen

| Tema | Implementado |
|------|--------------|
| Métricas JSON | GET /metrics (snapshot) |
| Métricas Prometheus | GET /metrics/prometheus (text/plain) |
| Logging JSON | LOG_FORMAT=json → una línea JSON por log |
| Request ID | x-request-id en request/response y en AuditLog |

**Futuro (opcional):** Alertas (Prometheus Alertmanager), dashboards (Grafana), tracing distribuido (OpenTelemetry).
