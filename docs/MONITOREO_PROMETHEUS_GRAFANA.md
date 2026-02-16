# 📊 Configuración de Monitoreo con Prometheus y Grafana

**Fecha:** 2026-02-16  
**Estado:** Documentación de configuración

---

## 📋 Índice

1. [Visión General](#visión-general)
2. [Configuración de Prometheus](#configuración-de-prometheus)
3. [Configuración de Grafana](#configuración-de-grafana)
4. [Dashboards Recomendados](#dashboards-recomendados)
5. [Alertas](#alertas)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Visión General

El sistema expone métricas en formato Prometheus en el endpoint `/metrics/prometheus`. Estas métricas pueden ser scrapeadas por Prometheus y visualizadas en Grafana.

### Métricas Disponibles

- `api_http_requests_total`: Total de requests HTTP
- `api_http_requests_by_status{status="..."}`: Requests por bucket de status (2xx, 3xx, 4xx, 5xx)
- `api_http_requests_by_tenant{tenant_id="..."}`: Requests por tenant
- `api_http_request_duration_seconds_avg`: Duración promedio de requests
- `api_http_request_duration_seconds_max`: Duración máxima de requests
- `api_uptime_seconds`: Tiempo de actividad del proceso

---

## ⚙️ Configuración de Prometheus

### 1. Instalación

```bash
# Docker
docker run -d \
  --name=prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# O usando docker-compose (recomendado)
```

### 2. Archivo `prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'comercial-electrica-api'
    scrape_interval: 15s
    metrics_path: '/metrics/prometheus'
    scheme: 'https'  # o 'http' si no usas SSL
    basic_auth:
      username: 'tu-usuario'  # Usuario con permiso metrics:read
      password: 'tu-password'
    static_configs:
      - targets:
          - 'api.tudominio.com:443'  # Ajusta según tu despliegue
        labels:
          environment: 'production'
          service: 'api'
```

### 3. Variables de Entorno para Autenticación

El endpoint `/metrics/prometheus` requiere autenticación JWT. Para scraping automático, puedes:

**Opción A: Usar un token de servicio permanente**
```bash
# Crear usuario de servicio con permiso metrics:read
# Usar su JWT token en el header Authorization
```

**Opción B: Usar basic auth (si configuras un proxy)**
```nginx
# nginx.conf
location /metrics/prometheus {
    proxy_pass http://api:3000/metrics/prometheus;
    proxy_set_header Authorization "Bearer $token";
}
```

**Opción C: Deshabilitar autenticación solo para este endpoint (NO recomendado en producción)**
```typescript
// Solo para desarrollo/testing
@Get('prometheus')
@Public()  // Si tienes un decorador @Public()
```

---

## 📈 Configuración de Grafana

### 1. Instalación

```bash
docker run -d \
  --name=grafana \
  -p 3001:3000 \
  grafana/grafana
```

### 2. Agregar Prometheus como Data Source

1. Ir a `Configuration > Data Sources`
2. Click en `Add data source`
3. Seleccionar `Prometheus`
4. URL: `http://prometheus:9090` (o la URL de tu Prometheus)
5. Click en `Save & Test`

### 3. Importar Dashboard Básico

Crea un dashboard nuevo y agrega estos paneles:

#### Panel 1: Requests Totales por Minuto
```
Query: rate(api_http_requests_total[1m])
Legend: Requests/min
```

#### Panel 2: Requests por Status
```
Query: rate(api_http_requests_by_status[1m])
Legend: {{status}}
```

#### Panel 3: Latencia Promedio
```
Query: api_http_request_duration_seconds_avg
Legend: Latencia promedio (s)
```

#### Panel 4: Top 10 Tenants por Requests
```
Query: topk(10, rate(api_http_requests_by_tenant[1m]))
Legend: {{tenant_id}}
```

#### Panel 5: Uptime
```
Query: api_uptime_seconds / 3600
Legend: Uptime (horas)
```

---

## 🎨 Dashboards Recomendados

### Dashboard 1: Visión General del Sistema

**Paneles:**
- Requests totales por minuto (gráfico de línea)
- Requests por status (gráfico de barras apiladas)
- Latencia promedio y máxima (gráfico de línea)
- Top 10 tenants por uso (gráfico de barras)
- Uptime del servicio (estadística)

**Query de ejemplo:**
```promql
# Requests por minuto
sum(rate(api_http_requests_total[1m]))

# Requests por status
sum by (status) (rate(api_http_requests_by_status[1m]))

# Top tenants
topk(10, sum by (tenant_id) (rate(api_http_requests_by_tenant[1m])))
```

### Dashboard 2: Métricas por Plan

**Nota:** Este dashboard requiere combinar métricas Prometheus con datos de BD usando el endpoint `/metrics/by-plan`.

**Paneles:**
- Requests agregados por plan (gráfico de barras)
- Distribución de tenants por plan (gráfico de pie)
- Uso promedio por tenant por plan (gráfico de barras)

**Query de ejemplo (usando métricas Prometheus):**
```promql
# Agregar por plan requiere join con BD
# Usar el endpoint /metrics/by-plan para obtener datos agregados
```

### Dashboard 3: Alertas y Límites

**Paneles:**
- Tenants cerca de límite (tabla)
- Porcentaje de uso por tenant vs límite (gráfico de barras)
- Alertas críticas (estadística)

**Query de ejemplo:**
```promql
# Requests por minuto por tenant
sum by (tenant_id) (rate(api_http_requests_by_tenant[1m]))

# Comparar con límites requiere datos de BD
# Usar el endpoint /metrics/rate-limit-alerts
```

---

## 🚨 Alertas

### Configuración de Alertas en Prometheus

Crea un archivo `alerts.yml`:

```yaml
groups:
  - name: api_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(api_http_requests_by_status{status=~"4xx|5xx"}[5m])) 
          / 
          sum(rate(api_http_requests_total[5m])) 
          > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tasa de errores alta (>10%)"
          description: "La tasa de errores es {{ $value | humanizePercentage }}"

      - alert: HighLatency
        expr: api_http_request_duration_seconds_avg > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Latencia alta detectada"
          description: "Latencia promedio: {{ $value }}s"

      - alert: ServiceDown
        expr: up{job="comercial-electrica-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Servicio caído"
          description: "El servicio API no responde"
```

Agrega el archivo a `prometheus.yml`:

```yaml
rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - 'alertmanager:9093'
```

### Alertas de Límites por Plan

Para alertas específicas de límites por tenant, usa el endpoint `/metrics/rate-limit-alerts`:

```bash
# Ejemplo de script de monitoreo
#!/bin/bash
ALERTS=$(curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.tudominio.com/metrics/rate-limit-alerts)

echo "$ALERTS" | jq '.[] | select(.status == "critical")' | \
  while read alert; do
    # Enviar notificación (Slack, email, etc.)
    send_slack_notification "$alert"
  done
```

---

## 🔧 Troubleshooting

### Problema: Prometheus no puede scrapear métricas

**Solución:**
1. Verificar que el endpoint `/metrics/prometheus` responde:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://api.tudominio.com/metrics/prometheus
   ```

2. Verificar configuración de autenticación en `prometheus.yml`

3. Revisar logs de Prometheus:
   ```bash
   docker logs prometheus
   ```

### Problema: Métricas no aparecen en Grafana

**Solución:**
1. Verificar que Prometheus está scrapeando:
   - Ir a `http://prometheus:9090/targets`
   - Verificar que el job está "UP"

2. Verificar queries en Grafana:
   - Usar el explorador de Prometheus para probar queries
   - Ir a `http://prometheus:9090/graph`

### Problema: Cardinalidad alta en métricas por tenant

**Solución:**
- El sistema limita a 500 tenants en memoria
- Para más tenants, considerar agregación en Prometheus:
  ```promql
  # Agregar por plan en lugar de por tenant
  sum by (plan) (api_http_requests_by_tenant)
  ```

---

## 📚 Referencias

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- Endpoint de métricas: `GET /metrics/prometheus`
- Endpoint de métricas por plan: `GET /metrics/by-plan`
- Endpoint de alertas: `GET /metrics/rate-limit-alerts`

---

**Última actualización:** 2026-02-16
