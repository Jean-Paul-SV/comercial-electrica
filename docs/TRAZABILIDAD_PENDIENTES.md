# Trazabilidad de lo que falta

> **Fecha:** Febrero 2026  
> **Objetivo:** Lista trazable de pendientes con ID, ubicación en código y referencias.  
> **Fuente:** `FLUJOS_QUE_FALTAN_INTEGRAR.md`, `QUE_FALTA_TODO_EL_SOFTWARE.md`, `RECUENTO_PENDIENTES.md`, `DIAN_INTEGRACION_ESTADO.md`.

---

## Resumen ejecutivo

| Prioridad | Pendientes | Hechos (referencia) |
|-----------|------------|---------------------|
| **Último (flujo)** | 1 | Compras: sustituir placeholder |
| **Crítico (DIAN)** | 4 | Envío real, PDF, consulta estado, CUFE |
| **Opcional** | 6 | Toasts/UX, E2E, cache, validaciones, docs DIAN, certificados |

**Orden acordado:** DIAN al final; Compras antes de DIAN. Opcionales cuando aplique.

---

## Índice por ID

| ID | Título | Prioridad | Estado |
|----|--------|-----------|--------|
| P-001 | Compras: listado + crear + recibir pedido | Último flujo | Pendiente |
| P-002 | DIAN: envío real a API | Crítico | Pendiente |
| P-003 | DIAN: generación de PDF | Crítico | Pendiente |
| P-004 | DIAN: consulta estado real | Crítico | Pendiente |
| P-005 | DIAN: CUFE según Anexo Técnico | Crítico | Pendiente |
| P-006 | Toasts en mutaciones (formularios sin feedback) | Opcional | Hecho (auditoría: verificar cadena) |
| P-007 | Pulido UX (errores, carga, responsive) | Opcional | Hecho (dashboard: mensaje error + hint API) |
| P-008 | Tests E2E adicionales | Opcional | Hecho (GET /reports/operational-state en reports.e2e-spec) |
| P-009 | Caché/índices (Redis, consultas lentas) | Opcional | Hecho (índice Sale tenantId+soldAt; dashboard ya con cache) |
| P-010 | Validaciones de negocio (caja, fechas) | Opcional | Hecho (gasto: fecha no futura; caja: ventas pendientes ya existía) |
| P-011 | Guía configuración DIAN + troubleshooting | Opcional | Hecho (`GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md`) |
| P-012 | Encriptación certificados DIAN (almacenamiento) | Opcional | Hecho (guía §5 + comentario en dian.service.ts) |

---

## Detalle por ítem

### P-001 — Compras: listado + crear + recibir pedido

| Campo | Valor |
|-------|--------|
| **Descripción** | Sustituir la página placeholder de Compras por listado de pedidos, formulario de creación y acción "Recibir pedido". La API y los hooks ya existen. |
| **Ubicación API** | `apps/api/src/purchases/purchases.controller.ts` — `GET /purchases`, `GET /purchases/:id`, `POST /purchases`, `POST /purchases/:id/receive` |
| **Ubicación frontend** | `apps/web/src/app/(protected)/purchases/page.tsx` (hoy placeholder); `apps/web/src/features/purchases/` (api, hooks, types ya existen) |
| **Referencias** | `FLUJOS_QUE_FALTAN_INTEGRAR.md` § 3.1 |
| **Esfuerzo estimado** | 1–2 días |

---

### P-002 — DIAN: envío real a API

| Campo | Valor |
|-------|--------|
| **Descripción** | Implementar cliente HTTP al Web Service DIAN (habilitación/producción): autenticación con `softwareId`/`softwarePin`, envío del XML firmado, manejo de respuestas ACEPTADO/RECHAZADO y reintentos. |
| **Ubicación** | `apps/api/src/dian/dian.service.ts` — método `sendToDian()` (aprox. línea 467) |
| **Variables de entorno** | `DIAN_ENV`, `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN` (ver `DIAN_INTEGRACION_ESTADO.md`) |
| **Referencias** | `DIAN_INTEGRACION_ESTADO.md`, `RECUENTO_PENDIENTES.md` § 1.3, `QUE_FALTA_TODO_EL_SOFTWARE.md` § 1 |
| **Esfuerzo estimado** | ~1 semana |

---

### P-003 — DIAN: generación de PDF

| Campo | Valor |
|-------|--------|
| **Descripción** | Generar PDF de la factura con plantilla estándar colombiana, QR y CUFE; guardar en disco o storage (S3). Hoy solo se guarda una ruta simulada. |
| **Ubicación** | `apps/api/src/dian/dian.service.ts` — método `generatePDF()` (aprox. línea 611) |
| **Referencias** | `DIAN_INTEGRACION_ESTADO.md`, `RECUENTO_PENDIENTES.md` § 1.4 |
| **Esfuerzo estimado** | 3–5 días |

---

### P-004 — DIAN: consulta estado real

| Campo | Valor |
|-------|--------|
| **Descripción** | Consumir Web Service de consulta de estado DIAN y sincronizar el estado en BD. Hoy solo se retorna el estado almacenado localmente. |
| **Ubicación** | `apps/api/src/dian/dian.service.ts` — método `queryDocumentStatus()` (aprox. línea 655) |
| **Referencias** | `DIAN_INTEGRACION_ESTADO.md`, `RECUENTO_PENDIENTES.md` § 1.5 |
| **Esfuerzo estimado** | 2–3 días |

---

### P-005 — DIAN: CUFE según Anexo Técnico

| Campo | Valor |
|-------|--------|
| **Descripción** | Calcular el CUFE según Anexo Técnico DIAN (hash de campos del documento) e incluirlo en el XML/extensión antes de firmar. Hoy se devuelve un valor simulado en la respuesta. |
| **Ubicación** | `apps/api/src/dian/dian.service.ts` — integrado en flujo de `generateXML()` / respuesta de `sendToDian()` según diseño |
| **Referencias** | `DIAN_INTEGRACION_ESTADO.md`, Anexo Técnico FE 1.9 |
| **Esfuerzo estimado** | 2–3 días |

---

### P-006 — Toasts en mutaciones (formularios sin feedback)

| Campo | Valor |
|-------|--------|
| **Descripción** | Añadir feedback visual (toast) al crear/editar en formularios que aún no lo tengan (cotizaciones, facturas proveedor, etc.). |
| **Ubicación** | Diversas páginas en `apps/web/src/app/(protected)/` que usan mutaciones sin `toast.success`/`toast.error` |
| **Referencias** | `QUE_FALTA_TODO_EL_SOFTWARE.md` § 2 |
| **Prioridad** | Baja |

---

### P-007 — Pulido UX (errores, carga, responsive)

| Campo | Valor |
|-------|--------|
| **Descripción** | Mensajes de error más claros, estados de carga consistentes, revisión responsive y accesibilidad donde falte. |
| **Ubicación** | `apps/web/src/` (componentes y páginas) |
| **Referencias** | `QUE_FALTA_TODO_EL_SOFTWARE.md` § 2 |
| **Prioridad** | Baja |

---

### P-008 — Tests E2E adicionales

| Campo | Valor |
|-------|--------|
| **Descripción** | E2E para flujos complejos: reportes, cotizaciones completas, DIAN (cuando exista envío real). |
| **Ubicación** | `apps/api/test/*.e2e-spec.ts` |
| **Referencias** | `QUE_FALTA_TODO_EL_SOFTWARE.md` § 3 |
| **Prioridad** | Baja |

---

### P-009 — Caché/índices (Redis, consultas lentas)

| Campo | Valor |
|-------|--------|
| **Descripción** | Caché Redis más fino en listados muy usados; índices compuestos donde haya consultas lentas. |
| **Ubicación** | `apps/api/src/` (servicios y Prisma/schema según corresponda) |
| **Referencias** | `QUE_FALTA_TODO_EL_SOFTWARE.md` § 3 |
| **Prioridad** | Baja |

---

### P-010 — Validaciones de negocio (caja, fechas)

| Campo | Valor |
|-------|--------|
| **Descripción** | Ej.: no permitir cerrar caja con ventas pendientes de facturar (si aplica); validaciones de fechas/montos documentadas. |
| **Ubicación** | Servicios de caja, ventas, etc. en `apps/api/src/` |
| **Referencias** | `QUE_FALTA_TODO_EL_SOFTWARE.md` § 3 |
| **Prioridad** | Baja |

---

### P-011 — Guía configuración DIAN + troubleshooting

| Campo | Valor |
|-------|--------|
| **Descripción** | Documentar variables de entorno DIAN, certificado, ambientes (habilitación/producción) y troubleshooting de errores típicos en producción. |
| **Ubicación** | `docs/` (nuevo o ampliación de `DIAN_INTEGRACION_ESTADO.md`, `GUIA_LEVANTAR_PROYECTO.md`) |
| **Referencias** | `QUE_FALTA_TODO_EL_SOFTWARE.md` § 5 |
| **Prioridad** | Baja (cuando DIAN esté en uso real) |

---

### P-012 — Encriptación certificados DIAN (almacenamiento)

| Campo | Valor |
|-------|--------|
| **Descripción** | Si los certificados DIAN se guardan en BD o archivos sensibles, encriptar en reposo. |
| **Ubicación** | Donde se almacenen certificados (config, storage, BD) |
| **Referencias** | `QUE_FALTA_TODO_EL_SOFTWARE.md` § 4 |
| **Prioridad** | Baja |

---

## Orden sugerido de implementación

1. **P-001** — Compras (último flujo antes de DIAN).
2. **P-002, P-003, P-004, P-005** — DIAN (orden interno: envío real, CUFE, PDF, consulta estado; ajustar según dependencias).
3. **P-006 a P-012** — Opcionales cuando aplique.

---

## Documentos de referencia

| Documento | Contenido |
|-----------|-----------|
| `FLUJOS_QUE_FALTAN_INTEGRAR.md` | Flujos API ↔ frontend; qué está completo y qué falta (Compras). |
| `QUE_FALTA_TODO_EL_SOFTWARE.md` | Visión general: DIAN, frontend, API, seguridad, despliegue. |
| `RECUENTO_PENDIENTES.md` | Lista extensa de tareas; incluye DIAN detallado. |
| `DIAN_INTEGRACION_ESTADO.md` | Estado por componente DIAN y variables de entorno. |
| `COMO_PROBAR_INTEGRACION_DIAN.md` | Cómo probar la integración DIAN. |
| `GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md` | Configuración DIAN (variables, certificado, ambientes) y troubleshooting. |
| `CODIGO_A_QUITAR_AL_USAR_API_FACTURACION.md` | Cambios al pasar a API de facturación real. |

---

## Historial de cierre (referencia de lo ya hecho)

| ID / Tema | Estado | Dónde se verificó |
|-----------|--------|-------------------|
| Estado operativo en Dashboard | Hecho | `apps/web/src/app/(protected)/app/page.tsx` — `useOperationalState`, sección "Acciones recomendadas" |
| Export CSV reportes | Hecho | `apps/web/src/features/reports/api.ts` — `downloadExportCsv`; `reports/page.tsx` — botones Ventas/Clientes |
| Vistas detalle: proveedores, facturas proveedor, devoluciones, gastos | Hecho | `suppliers/[id]`, `supplier-invoices/[id]`, `returns/[id]`, `expenses/[id]` |
| Pantalla Backups | Hecho | `apps/web/src/app/(protected)/backups/page.tsx`; `features/backups/`; ítem en navegación |
| P-006 Toasts | Hecho | `audit/page.tsx` — toast en verificar cadena (éxito / advertencia / error) |
| P-007 Pulido UX | Hecho | `app/page.tsx` — mensaje de error del dashboard con hint (API, NEXT_PUBLIC_API_BASE_URL) |
| P-011 Guía DIAN + troubleshooting | Hecho | `docs/GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md` |
| P-008 Tests E2E | Hecho | `apps/api/test/reports.e2e-spec.ts` — GET /reports/operational-state |
| P-009 Índice Sale | Hecho | `schema.prisma` @@index([tenantId, soldAt]); migración 20260204100000 |
| P-010 Validación gasto fecha | Hecho | `expenses.service.ts` — fecha del gasto no puede ser futura |
| P-012 Almacenamiento seguro DIAN | Hecho | Guía §5 + comentario en `dian.service.ts` (secrets manager) |

---

**Última actualización:** Febrero 2026
