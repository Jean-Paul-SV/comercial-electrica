# Qué hace falta – Estado actual del plan

> **Última actualización:** 2026-02-02  
> Resumen de lo ya implementado y lo que queda por hacer.

---

## ✅ Ya implementado (resumen)

| Área | Estado |
|------|--------|
| **RBAC y permisos** | PermissionsService, PermissionsGuard, @RequirePermission; GET /auth/me con permisos; navegación por permisos en frontend |
| **Multi-tenant** | Tenant, User.tenantId; plan por defecto en seed |
| **SaaS modular** | Plan, PlanFeature, TenantModule, AddOn; TenantModulesService; @RequireModule + ModulesGuard; nav por módulos; página “Plan requerido” |
| **Onboarding** | User.onboardingStatus; GET/PATCH /onboarding/status; flujo y panel en dashboard |
| **Estados operativos y alertas** | GET /reports/operational-state; panel de alertas en dashboard; tarjeta stock bajo mejorada |
| **Indicadores accionables** | GET /reports/actionable-indicators (incl. proveedores menos competitivos, ventas por empleado) |
| **Resiliencia** | Reintentos + backoff en apiClient; useOnlineStatus; banner “Sin conexión”; cola offline + Idempotency-Key; OfflineQueueBell |
| **Auditoría** | AuditLog con requestId, ip, userAgent; cadena de integridad (previousHash/entryHash); GET /audit-logs/verify-chain; UI “Verificar cadena” |
| **Backups** | Copia off-site a S3 (si env configurado) |
| **Autorización** | Migración a permisos: @Roles deprecado; POST /auth/users con @RequirePermission('users:create'); RolesGuard quitado de controladores |
| **Frontend** | Login, dashboard, productos, clientes, ventas, cotizaciones, caja, inventario, reportes, auditoría, gastos, devoluciones, proveedores, compras, facturas proveedor, onboarding, plan-required |
| **Otros** | Rate limiting (ThrottlerModule); validación de env; health DB/Redis; EADDRINUSE y hydration documentados/corregidos |

---

## 🔴 Crítico – Falta implementar

### 1. **DIAN real (facturación electrónica)**

Requisito legal en Colombia. Hoy la API tiene estructura (DianDocument, cola, worker) pero **no** integración real con la DIAN.

| Tarea | Descripción | Ref. |
|-------|-------------|------|
| ~~**XML UBL**~~ | ✅ Hecho: UBL 2.1 en `generateXML()`, escape de textos, líneas como hermanas. CUFE real pendiente. | `dian.service.ts` → `generateXML()` |
| ~~**Firma digital**~~ | ✅ Hecho: certificado .p12 (DIAN_CERT_PATH/PASSWORD), xml-crypto + node-forge, RSA-SHA256. | `signDocument()` |
| **Envío a API DIAN** | Conectar con API real (habilitación/producción); softwareId/softwarePin; manejo ACEPTADO/RECHAZADO y reintentos | `sendToDian()` |
| **Generación de PDF** | PDF de factura (pdfkit/puppeteer); plantilla estándar; QR y CUFE; guardado local/cloud | `generatePDF()` |
| **Consulta estado real** | Consultar estado en DIAN y sincronizar estados locales | `queryDocumentStatus()` |

**Tiempo estimado:** 3–4 semanas.  
**Documentación:** `docs/RECUENTO_PENDIENTES.md` (sección DIAN), `docs/ESTADO_ACTUAL_2026-01-28.md`.

---

## 🟡 Opcional / Mejoras

| Tema | Descripción |
|------|-------------|
| ~~**Políticas de retención (auditoría)**~~ | ✅ Hecho: `POLITICA_RETENCION_AUDITORIA.md` (5 años fiscal, resto configurable); `AUDIT_RETENTION_DAYS` en env.example como referencia. |
| ~~**Observabilidad avanzada**~~ | ✅ Hecho: GET /metrics/prometheus (formato Prometheus); LOG_FORMAT=json (logging JSON); `OBSERVABILIDAD.md`. Alertas/dashboards externos (Prometheus/Grafana) opcionales. |
| **Indicadores con IA** | Fase 2 ✅; Fase 3: precio sugerido ✅, resumen NL (dashboard-summary) ✅, reorden (REORDER_SUGGESTION) ✅; opcionales: pronóstico demanda (DEMAND_FORECAST) ✅, segmentación clientes (CUSTOMER_SEGMENTS) ✅, score proveedores (SUPPLIER_SCORE) ✅. Ver `INDICADORES_Y_ACCIONES.md` §4. |
| ~~**Eliminar código deprecado**~~ | ✅ Hecho: eliminados `roles.decorator.ts` y `roles.guard.ts`; autorización solo vía `@RequirePermission` + PermissionsGuard. |

---

## Indicadores con IA (resumen)

- **Fase 1:** Indicadores con reglas fijas (umbrales, top N) — ya implementado (productos con pérdida, sin rotación, proveedores menos competitivos, ventas por empleado).
- **Fase 2:** Anomalías simples (estadística descriptiva, sin ML): ventas del día vs media 7 días ✅; margen de producto vs media ✅. Ver `INDICADORES_Y_ACCIONES.md` §4.2–4.3.
- **Fase 3:** Precio sugerido ✅ (suggestedPrice en indicadores PRODUCTS_LOSS y PRODUCTS_LOW_MARGIN, margen objetivo 15 %). Resumen NL ✅ (GET /reports/dashboard-summary: LLM con OPENAI_API_KEY o fallback). Pronóstico demanda ✅ (DEMAND_FORECAST, media ponderada). Clustering ✅ (CUSTOMER_SEGMENTS + GET /reports/customer-clusters K-means). Futuro: modelos ARIMA/Prophet, dashboards externos.

**Documento de diseño:** `docs/INDICADORES_Y_ACCIONES.md`.

---

## 📁 Documentos de referencia

- **DIAN y facturación:** `RECUENTO_PENDIENTES.md` (prioridad crítica), `ESTADO_ACTUAL_2026-01-28.md`
- **Indicadores e IA:** `INDICADORES_Y_ACCIONES.md`
- **Arquitectura y roles:** `ROLES_Y_PERMISOS_DISEÑO.md`, `ARQUITECTURA_MODULAR_SAAS.md`
- **Auditoría:** `AUDITORIA_Y_TRAZABILIDAD.md`, `POLITICA_RETENCION_AUDITORIA.md`
- **Resiliencia:** `RESILIENCIA_Y_SINCRONIZACION.md`
- **Observabilidad:** `OBSERVABILIDAD.md`
- **Levantar proyecto:** `LEVANTAR_PROYECTO.md`
- **Qué falta + cómo probar todo:** `COMO_PROBAR_Y_QUE_FALTA.md`
- **Frontend para lo implementado:** `FRONTEND_PENDIENTES_IMPLEMENTACION.md`
- **Errores y verificación:** `VERIFICACION_ERRORES.md`

---

## Resumen en una frase

**Crítico (pendiente para más adelante):** Completar la integración real con la DIAN (envío a API, PDF, consulta de estado). Se retomará al final del plan.  
**Opcional (futuro):** Pronóstico con modelos (ARIMA/Prophet), dashboards externos (Prometheus/Grafana). Pronóstico de demanda y clustering de clientes (reglas + K-means) ya implementados.
