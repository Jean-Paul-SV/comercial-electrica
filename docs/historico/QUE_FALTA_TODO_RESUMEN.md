# Qué falta: resumen completo (plan de negocio, técnico, operación)

> **Estado actual (2026-02-16):** Todo lo identificado en este documento como pendiente en su momento ya fue abordado en el proyecto.  
> El estado consolidado y actualizado está en `ESTADO_PROYECTO.md` y `IMPLEMENTACIONES_PRODUCCION.md`.  
> Este archivo se mantiene como **histórico** para entender cómo fuimos cerrando los huecos.

> **Objetivo original:** Una sola lista de **todo** lo que falta por hacer, teniendo en cuenta lo ya implementado (DIAN real, SaaS, panel proveedor, 3 usuarios/seed, móvil, etc.).  
> **Fecha (histórica):** Febrero 2026.  
> **Referencias:** `TRAZABILIDAD_FALTA_IMPLEMENTAR.md`, `QUE_FALTA_HASTA_LA_FECHA.md`, `PARA_PRODUCCION_Y_VENTA_COMERCIAL.md`, `SAAS_MODELO_NEGOCIO_Y_OPERACION.md`.

---

## Resumen en una tabla

| Área | Prioridad | Qué falta (resumen) |
|------|-----------|---------------------|
| **DIAN (Colombia)** | Validación | Código listo; falta **validar en habilitación/producción** con certificado y credenciales reales. |
| **Funcionalidad** | Media | Compras: listado + crear pedido + "Recibir pedido" en `/purchases`. |
| **Configuración** | Baja | Límite de login configurable por env (`LOGIN_THROTTLE_LIMIT`). |
| **Contingencia DIAN** | Opcional | Botón “Reintentar envíos pendientes” en UI. |
| **UX / producto** | Opcional | Toasts donde falten, pulido responsive/accesibilidad. |
| **Negocio / comercial** | Según venta | Soporte definido, onboarding opcional, contrato/licencia, dominio propio. |
| **Operación** | Según venta | Validar DIAN con cliente real; backups y monitoreo ya documentados. |

---

## 1. Técnico / funcional (lo que falta en código)

### 1.1 Pendientes con ID (trazabilidad)

| ID | Título | Prioridad | Esfuerzo | Dónde |
|----|--------|-----------|----------|--------|
| **F-001** | Compras: listado + crear pedido + “Recibir pedido” | Media | 1–2 días | `apps/web/.../purchases/page.tsx` (placeholder); API y hooks existen. |
| **F-002** | Límite de login configurable (`LOGIN_THROTTLE_LIMIT`) | Baja | < 1 día | `ThrottlerModule` y `POST /auth/login` en API. |
| **F-003** | Reintentar envíos DIAN pendientes (botón + endpoint) | Opcional | 0,5–1 día | Nuevo `POST /dian/documents/retry-pending` + UI facturación electrónica. |
| **F-004** | Toasts y pulido UX donde falte | Opcional | Según auditoría | Formularios en `apps/web/.../(protected)/`. |

Detalle: **`TRAZABILIDAD_FALTA_IMPLEMENTAR.md`**.

### 1.2 DIAN (facturación electrónica Colombia)

- **Estado:** Envío real, CUFE (SHA384), PDF (pdfkit + QR), consulta de estado están **implementados**. Ver `DIAN_INTEGRACION_ESTADO.md`.
- **Falta:** Validar el flujo completo en **ambiente de habilitación/producción** con certificado .p12 y credenciales DIAN reales (Software ID, PIN, NIT emisor, etc.). Sin eso no se puede vender como facturación electrónica legal en Colombia.

---

## 2. Plan de negocio / comercial (qué falta para vender y operar)

### 2.1 Para poder vender el producto

| Aspecto | Estado | Qué falta |
|---------|--------|-----------|
| **Producto técnico** | ✅ | API, frontend, multi-tenant, SaaS, DIAN (código), Stripe, panel proveedor, 3 usuarios/seed, móvil. |
| **Despliegue** | ✅ | Render (API + BD + Redis), Vercel (web); migraciones en deploy. |
| **Primer uso** | ✅ | Seed crea plan, tenant, usuario Panel proveedor y admin tenant; doc en `historico/RENDER_SOLO_3_USUARIOS.md`. |
| **Seguridad** | ✅ | CORS, JWT, rate limiting, ALLOWED_LOGIN_EMAILS; secrets por env. |
| **Documentación de uso** | ✅ | `GUIA_USO_APLICACION.md` para el cliente final. |
| **Alta de clientes** | ✅ | Runbook `RUNBOOK_ALTA_CLIENTE.md`; política retención suspendidos. |

### 2.2 Pendiente de negocio / comercial

| Aspecto | Qué falta |
|---------|-----------|
| **Soporte** | Definir canal (email, chat, teléfono) y tiempos de respuesta. |
| **Onboarding del cliente** | Opcional: guía inicial, videollamada o tutorial para el primer uso (el sistema ya tiene onboarding en app). |
| **Contrato / licencia** | Si vendes el software: tipo de licencia, garantías, límites de uso. |
| **Facturación del servicio (SaaS)** | ✅ Ya implementado (Stripe, planes, webhook, suspensión por impago). Falta solo configurar precios/planes en Stripe y en la app. |
| **Dominio propio** | Opcional: `app.tuempresa.com` y `api.tuempresa.com`; actualizar `ALLOWED_ORIGINS` y `FRONTEND_URL`. |

---

## 3. Operación (producción y venta)

### 3.1 Obligatorio para venta en Colombia con facturación electrónica

| Tarea | Estado |
|-------|--------|
| **Validar DIAN en habilitación** | Pendiente: obtener credenciales DIAN (certificado, Software ID, PIN), configurar env en Render y probar envío/consulta/PDF en ambiente de habilitación. |
| **DIAN en producción** | Tras habilitación, pasar a URL producción y certificado de producción. |

### 3.2 Operación continua (ya documentado)

- **Backups:** Estrategia en Render o endpoint/script de la API; retención definida.
- **Health:** `GET /health` para API, BD y Redis.
- **Usuarios:** Crear desde app (Usuarios → Invitar) o API; doc `PRIMER_USUARIO_PRODUCCION.md` y `historico/RENDER_SOLO_3_USUARIOS.md`.

---

## 4. Opcionales / mejoras (no bloquean venta)

| Área | Qué falta |
|------|-----------|
| **Observabilidad** | Sentry (errores), métricas Prometheus, alertas (el sistema ya tiene `GET /metrics` y health). |
| **Tests** | Más E2E en flujos concretos (cotizaciones, reportes ya cubiertos); tests DIAN cuando se use en real. |
| **Performance** | Caché e índices ya implementados en listados clave; mejoras finas según uso real. |
| **Frontend** | Vistas de detalle donde falten; mensajes de error y estados de carga uniformes. |
| **@next/swc** | Alinear versión con Next.js (ej. 15.5.7 → 15.5.11) para quitar el warning de build. |

---

## 5. Orden sugerido (qué hacer primero)

1. **Si vendes en Colombia con facturación electrónica:** Validar DIAN en habilitación (certificado, env, una factura de prueba).
2. **Si quieres el flujo completo de compras:** Implementar F-001 (listado/compras/recibir pedido).
3. **Producción cómoda:** F-002 (límite de login configurable); en Render definir `ALLOWED_LOGIN_EMAILS` si solo quieres 3 usuarios.
4. **Negocio:** Definir soporte y, si aplica, contrato/licencia; opcional dominio propio y onboarding guiado.
5. **Opcional:** F-003 (reintentar DIAN), F-004 (toasts/UX), alinear @next/swc.

---

## 6. Ya hecho (referencia rápida)

- **DIAN:** XML UBL 2.1, firma digital, envío real (SOAP), CUFE, PDF, consulta estado. Ver `DIAN_INTEGRACION_ESTADO.md`.
- **SaaS:** Tenant, Plan, Subscription, Stripe (webhook, suspensión), panel proveedor (empresas, planes, alta cliente). Ver `QUE_FALTA_HASTA_LA_FECHA.md` § 2 y § 7.
- **Auth y usuarios:** JWT, RBAC, invitación, olvidé contraseña, cambio obligatorio, `ALLOWED_LOGIN_EMAILS` (solo 3 usuarios), seed con `platform@proveedor.local` y `admin@negocio.local`. Ver `historico/RENDER_SOLO_3_USUARIOS.md`.
- **Móvil:** PWA (manifest, viewport), barra inferior, tablas con scroll táctil, área táctil 44px en botones icon.
- **Flujos UI:** Dashboard, estado operativo, export CSV, vistas detalle (proveedores, facturas proveedor, devoluciones, gastos), backups, productos (fix tipo minStock).
- **Operación:** Runbook alta cliente, política retención suspendidos, guía de uso, hardening (CORS, rate limit, etc.).

---

## Documentos de referencia

| Documento | Contenido |
|-----------|-----------|
| **`TRAZABILIDAD_FALTA_IMPLEMENTAR.md`** | IDs F-001 a F-004, detalle técnico y referencias. |
| **`QUE_FALTA_HASTA_LA_FECHA.md`** | Resumen ejecutivo; SaaS/Stripe/operación ya hechos. |
| **`PARA_PRODUCCION_Y_VENTA_COMERCIAL.md`** | Checklist venta (DIAN, seguridad, despliegue, comercial). |
| **`SAAS_MODELO_NEGOCIO_Y_OPERACION.md`** | Modelo de negocio, flujo de alta, usuarios, soporte. |
| **`DIAN_INTEGRACION_ESTADO.md`** | Estado DIAN y variables de entorno. |
| **`historico/RENDER_SOLO_3_USUARIOS.md`** | Solo 3 usuarios en Render, credenciales de prueba. |

---

**Última actualización:** Febrero 2026
