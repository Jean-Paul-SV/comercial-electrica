# Frontend para lo implementado (resumen)

> Resumen de qué necesita UI en el frontend para lo que ya está en la API.

---

## Lo que **no** necesita frontend

| Implementación | Motivo |
|----------------|--------|
| **Observabilidad** (GET /metrics, GET /metrics/prometheus, LOG_FORMAT=json) | Uso operativo: Prometheus, logs, admins. No es pantalla de usuario. |
| **Políticas de retención** (POLITICA_RETENCION_AUDITORIA.md, AUDIT_RETENTION_DAYS) | Solo documentación y variable de referencia. |
| **DIAN (firma digital, XML)** | Flujo actual (cola, estados) ya tiene UI; la firma es interna al proceso. |

---

## Lo que **ya** se ve en el frontend (sin cambios)

| API | Dónde se usa | Comportamiento |
|-----|----------------|----------------|
| **GET /reports/actionable-indicators** | Dashboard → sección "Sugerencias" | Los **nuevos** indicadores (SALES_ANOMALY_TODAY, MARGIN_BELOW_AVERAGE, REORDER_SUGGESTION) se muestran igual: título, insight, métrica y enlace. No hace falta cambio para que aparezcan. |

---

## Lo que **sí** conviene añadir en frontend

| Implementación | Qué falta | Dónde |
|----------------|-----------|--------|
| ~~**Precio sugerido** (`suggestedPrice` en ítems)~~ | ✅ Hecho: tipo ya existía; se muestra "Precio sug. 15%: $X" en ítems de indicadores en el dashboard. | Dashboard → Sugerencias: lista de ítems por indicador con `suggestedPrice` cuando exista. |
| ~~**Resumen en lenguaje natural** (GET /reports/dashboard-summary)~~ | ✅ Hecho: tarjeta "Resumen del día" con `summary` y badge "IA" cuando `source === 'llm'`. | Dashboard: tarjeta ya integrada con `useDashboardSummary`. |

---

## Resumen en una frase

**No todo lo implementado necesita frontend.** Métricas, logs y política de retención no. Los indicadores nuevos (incl. DEMAND_FORECAST, CUSTOMER_SEGMENTS, SUPPLIER_SCORE) se ven en "Sugerencias". Precio sugerido y resumen del día ya están integrados en el dashboard. **Clusters K-means:** pestaña "Clusters (K-means)" en Reportes con GET /reports/customer-clusters (days, k). Resumen del día: badge "Resumen automático" cuando source es fallback; estados de carga y error.
