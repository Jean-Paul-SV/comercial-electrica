# Qué falta de todo el software – Revisión completa

> **Fecha:** Febrero 2026  
> **Objetivo:** Lista verificada contra el código de todo lo que falta en el proyecto (y lo que ya está hecho).  
> **Fuente:** Documentación existente + revisión de `apps/api` y `apps/web`.

---

## Resumen ejecutivo

| Área | Estado | Qué falta (resumen) |
|------|--------|--------------------|
| **DIAN (facturación electrónica)** | 🔴 Crítico | Envío real a API DIAN, PDF de factura, consulta estado real, CUFE según anexo |
| **Frontend** | 🟢 Listado completo | Vistas de detalle (producto/venta/cliente/… por ID), toasts en mutaciones, pequeño pulido UX |
| **API / Backend** | 🟢 Muy completo | Nada crítico; opcional: más tests E2E, índices/cache fino |
| **Seguridad / Operación** | 🟢 Cubierto | Rate limiting, validación límites, CORS, health, backups y auditoría implementados |
| **Despliegue** | 🟢 Documentado | `render.yaml` existe; guía Vercel+Render en `DEPLOY_VERCEL_RENDER.md` |

**Nota:** En `RECUENTO_PENDIENTES.md` se indica “no hay frontend” y “módulo de backups no implementado”. Eso está **desactualizado**: el frontend tiene todas las pantallas principales y el módulo de backups (servicio + endpoints + S3) está implementado.

---

## 1. DIAN – Facturación electrónica (Colombia)

**Requisito legal** si vas a facturar electrónicamente en Colombia. Hoy la API tiene estructura (cola, worker, modelos) y parte implementada; lo siguiente **sí falta**:

| Componente | Estado en código | Qué falta |
|------------|------------------|-----------|
| **Generación XML UBL 2.1** | ✅ Implementado | Ajustes menores si la DIAN cambia normativa; CUFE real (ver abajo). |
| **Firma digital** | ✅ Implementado | Certificado .p12, xml-crypto, RSA-SHA256. Opcional: validar vencimiento de certificado. |
| **Envío a API DIAN** | ❌ Simulado | Cliente HTTP a Web Service DIAN (habilitación/producción), `softwareId`/`softwarePin`, manejo ACEPTADO/RECHAZADO y reintentos. |
| **Generación de PDF** | ❌ Placeholder | Generar PDF de factura (pdfkit/puppeteer), plantilla estándar, QR + CUFE, guardar en disco o S3. |
| **Consulta estado real** | ❌ Solo local | Consumir Web Service de consulta DIAN y sincronizar estado en BD. |
| **CUFE** | ⚠️ Simulado | Calcular CUFE según Anexo Técnico DIAN e incluirlo en XML (hoy se devuelve mock en respuesta). |

**Archivos:** `apps/api/src/dian/dian.service.ts` — métodos `sendToDian()`, `generatePDF()`, `queryDocumentStatus()`.

**Documentación:** `docs/DIAN_INTEGRACION_ESTADO.md`, `docs/QUE_HACE_FALTA.md`.

**Tiempo estimado:** 3–4 semanas para envío real + PDF + consulta estado + CUFE.

---

## 2. Frontend (Next.js)

**Ya implementado (verificado):**

- Login, dashboard, onboarding, plan-required.
- Listados/pantallas: productos, clientes, ventas, cotizaciones, caja, movimientos de caja, inventario, gastos, devoluciones, proveedores, compras, facturas proveedor, reportes, auditoría, usuarios.
- Navegación por permisos/módulos, resiliencia (offline, reintentos), indicadores y resumen del día (IA/fallback), clusters K-means en reportes.

**Lo que falta (mejoras, no bloqueante):**

| Pendiente | Descripción | Prioridad |
|-----------|-------------|-----------|
| **Vistas de detalle** | Páginas por ID: `/products/[id]`, `/sales/[id]`, `/customers/[id]`, `/quotes/[id]`, etc. (ver detalle de un registro, editar desde ahí si aplica). | Media |
| **Toasts en mutaciones** | Feedback visual (toast) al crear/editar en cotizaciones, compras, facturas proveedor y demás formularios que no lo tengan. | Baja |
| **Pulido UX** | Mensajes de error más claros, estados de carga consistentes, responsive y accesibilidad donde falte. | Baja |

No hay un “frontend por hacer desde cero”; el sistema es usable con lo actual. Las vistas de detalle mejoran la experiencia pero no son obligatorias para cerrar un primer release.

---

## 3. API / Backend (NestJS)

**Ya implementado (verificado):**

- Módulos: auth (JWT, bootstrap, usuarios, permisos, módulos/tenant), catalog, customers, sales, quotes, cash, inventory, expenses, returns, suppliers, purchases, supplier-invoices, reports, audit, backups, dian, onboarding, metrics.
- Rate limiting (ThrottlerModule), validación de límites (ValidationLimitsService en ventas, caja, inventario, cotizaciones, compras, gastos), CORS por entorno, health (DB, Redis, colas), métricas, request-id, auditoría, backups con pg_dump y opción S3.

**Lo que falta (opcional o menor):**

| Pendiente | Descripción | Prioridad |
|-----------|-------------|-----------|
| **Tests E2E adicionales** | E2E para flujos complejos de reportes, cotizaciones completas o DIAN (cuando exista envío real). | Baja |
| **Caché/índices** | Caché Redis más fino en listados muy usados; índices compuestos donde haya consultas lentas. | Baja |
| **Validaciones de negocio** | Ej.: no permitir cerrar caja con ventas pendientes de facturar (si aplica); validaciones de fechas/montos donde se documentó. | Baja |

Nada de esto bloquea un cierre “de negocio”; son mejoras de robustez y rendimiento.

---

## 4. Seguridad y operación

**Ya implementado:**

- Autenticación JWT, permisos por recurso, multi-tenant, módulos/planes.
- Rate limiting (Throttler), validación de DTOs, CORS en producción con `ALLOWED_ORIGINS`, validación de env al arranque (fail-fast en producción).
- Auditoría (eventos críticos), cadena de integridad en logs de auditoría, backups (servicio + endpoints + S3 opcional).

**Opcional (mejora):**

- Encriptación de certificados DIAN en almacenamiento (si se guardan en BD o archivos sensibles).
- Alertas automáticas (Sentry u otro) en producción.

---

## 5. Despliegue y documentación

**Ya disponible:**

- `render.yaml` en la raíz para Render (API + PostgreSQL).
- Guía `DEPLOY_VERCEL_RENDER.md` (Vercel frontend + Render API + Upstash Redis).
- Guía `PASOS_CUANDO_FINALICE.md` (cierre desarrollo, despliegue, primer usuario, operación).
- `GUIA_LEVANTAR_PROYECTO.md`, `USUARIOS_PRODUCCION.md`, `env.example`.

**Opcional:**

- Guía específica de configuración DIAN (variables, certificado, ambientes) cuando el envío real esté listo.
- Troubleshooting avanzado (errores típicos en producción).

---

## 6. Resumen: qué falta “de todo” el software

### Crítico (para facturación electrónica legal en Colombia)

1. **DIAN – Envío real** a la API de la DIAN (habilitación/producción) desde `sendToDian()`.
2. **DIAN – PDF** de la factura con QR/CUFE en `generatePDF()`.
3. **DIAN – Consulta estado** real en DIAN en `queryDocumentStatus()`.
4. **DIAN – CUFE** calculado según Anexo Técnico (no simulado).

### Opcional / mejora

5. **Frontend:** Vistas de detalle por entidad (`/products/[id]`, `/sales/[id]`, etc.).
6. **Frontend:** Toasts y pulido UX en formularios.
7. **API:** Más tests E2E; caché/índices donde haga falta.
8. **Docs:** Guía de configuración DIAN y troubleshooting producción cuando aplique.

---

## 7. Documentos de referencia

| Documento | Contenido |
|-----------|-----------|
| `QUE_HACE_FALTA.md` | Resumen corto de pendientes (alineado con este doc). |
| `DIAN_INTEGRACION_ESTADO.md` | Estado detallado DIAN (XML, firma, envío, PDF, consulta). |
| `RECUENTO_PENDIENTES.md` | Lista larga de tareas; **ojo:** dice que no hay frontend ni backups — están implementados. |
| `ESTADO_ACTUAL_2026-01-28.md` | Estado general del proyecto. |
| `PASOS_CUANDO_FINALICE.md` | Pasos al finalizar: despliegue, primer usuario, operación. |
| `DEPLOY_VERCEL_RENDER.md` | Despliegue en Vercel + Render. |

---

**Última actualización:** Febrero 2026
