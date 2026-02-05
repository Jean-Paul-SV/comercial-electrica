# Para producción y venta comercial

> **Objetivo:** Checklist de lo que el producto **debe tener** cuando salga de fase de prueba y se ofrezca a venta en producción.  
> **Fecha:** Febrero 2026

---

## Resumen ejecutivo

| Área | Obligatorio para venta | Opcional / mejora |
|------|------------------------|-------------------|
| **Legal (Colombia)** | DIAN real (facturación electrónica) | — |
| **Seguridad** | Secrets en prod, CORS, HTTPS | 2FA, política de contraseñas |
| **Infraestructura** | API + BD + Redis + frontend desplegados | Plan pago Render, dominio propio |
| **Operación** | Primer usuario, backups, health | Sentry, métricas Prometheus |
| **Comercial** | Documentación de uso, soporte básico | Contratos, SLA, onboarding guiado |

---

## 1. Obligatorio para venta (Colombia)

### 1.1 Facturación electrónica DIAN

Si vendes el sistema a negocios en **Colombia**, la facturación electrónica debe ser **real** (no simulada).

| Tarea | Estado actual | Qué hacer |
|------|----------------|-----------|
| **XML UBL** | ✅ Generación UBL 2.1 | Ajustar según resolución vigente si cambia |
| **Firma digital** | ✅ Certificado .p12, xml-crypto | Certificado de producción, rotación segura |
| **Envío a API DIAN** | ❌ Simulado | Conectar API real (habilitación → producción) |
| **PDF de factura** | ❌ Placeholder | Generar PDF con plantilla, QR, CUFE |
| **Consulta estado** | ❌ Local | Consultar estado real en DIAN |

**Documentos:** `RECUENTO_PENDIENTES.md` (sección DIAN), `COMO_PROBAR_INTEGRACION_DIAN.md`, `CODIGO_A_QUITAR_AL_USAR_API_FACTURACION.md`.

Sin DIAN real puedes vender el sistema como **gestión comercial** (ventas, inventario, reportes), pero **no** como solución de facturación electrónica legal en Colombia.

---

## 2. Seguridad

| Requisito | Descripción |
|-----------|-------------|
| **Secrets en producción** | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` distintos a los de desarrollo; nunca valores de ejemplo. |
| **CORS** | `ALLOWED_ORIGINS` en la API con la(s) URL(s) del frontend de producción. |
| **HTTPS** | Frontend y API servidos por HTTPS (Vercel y Render lo ofrecen). |
| **Variables sensibles** | `.env` y archivos con claves **no** en el repositorio; usar variables de entorno del proveedor (Vercel/Render). |
| **Backups** | Base de datos con backups automáticos (Render) o uso del endpoint/script de backups de la API; definir retención. |

---

## 3. Infraestructura (despliegue)

| Componente | Dónde | Variables clave |
|-------------|--------|------------------|
| **API (NestJS)** | Render (u otro) | `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `ALLOWED_ORIGINS`, `FRONTEND_URL` |
| **Base de datos** | PostgreSQL (Render u otro) | `DATABASE_URL` |
| **Redis** | Upstash u otro | `REDIS_URL` (BullMQ y cache) |
| **Frontend (Next.js)** | Vercel (u otro) | `NEXT_PUBLIC_API_BASE_URL` = URL de la API |

**Migraciones:** En producción usar `prisma migrate deploy` (no `migrate dev`). Incluirlo en el build de la API.

**Documento:** `PASOS_CUANDO_FINALICE.md`, y si existe `DEPLOY_VERCEL_RENDER.md`.

---

## 4. Puesta en marcha (primera vez en producción)

| Paso | Acción |
|------|--------|
| **Primer usuario** | `POST /auth/bootstrap-admin` (solo si no hay usuarios) o seed controlado. Ver `USUARIOS_PRODUCCION.md`. |
| **CORS y frontend** | Configurar `ALLOWED_ORIGINS` y `FRONTEND_URL` con la URL del frontend en producción. |
| **Verificación** | Login desde el frontend, flujo básico (dashboard, una venta, listados). |
| **Health** | `GET /health` para comprobar API, BD y Redis. |

---

## 5. Operación continua

| Área | Mínimo para venta | Recomendado |
|------|-------------------|-------------|
| **Backups** | Conocer cómo se hacen (Render o script/endpoint) y periodicidad | Automáticos + copia off-site (S3) |
| **Monitoreo** | Health check y revisión manual ante incidencias | Alertas (email/Slack), Sentry, métricas |
| **Actualizaciones** | Deploy automático al hacer push (si está configurado) | Pipeline con tests y migraciones |
| **Usuarios** | Crear desde la app (Usuarios) o API con token admin | Documentar proceso en `USUARIOS_PRODUCCION.md` |

---

## 6. Comercial (para venta como producto)

| Aspecto | Descripción |
|---------|-------------|
| **Documentación de uso** | Guía para el cliente: cómo crear usuarios, ventas, cotizaciones, reportes, caja. Puede basarse en `GUIA_LEVANTAR_PROYECTO.md` (adaptada a “cómo usar” en lugar de “cómo instalar”). |
| **Soporte** | Definir canal (email, chat, teléfono) y tiempos de respuesta aunque sea básicos. |
| **Licencia / contrato** | Si vendes el software: tipo de licencia, garantías, límites de uso. |
| **Facturación del servicio** | Si ofreces SaaS: planes, precios, renovación; el sistema ya tiene estructura multi-tenant y planes (`Plan`, `PlanFeature`). |
| **Onboarding del cliente** | El sistema tiene onboarding en la app; opcional: guía o videollamada inicial para el primer uso. |

---

## 7. Opcional pero recomendado

| Tema | Descripción |
|------|-------------|
| **Dominio propio** | Ej. `app.tuempresa.com` en Vercel y API en `api.tuempresa.com` en Render; actualizar `ALLOWED_ORIGINS` y `FRONTEND_URL`. |
| **IA (resumen del día)** | Configurar `OPENAI_API_KEY` para el resumen en lenguaje natural en el dashboard; si no, se usa resumen automático. |
| **Plan de pago en Render** | El plan gratuito “duerme” el servicio; para clientes de pago conviene plan que mantenga la API activa. |
| **Errores en producción** | Sentry (o similar) en API y/o frontend para ver fallos en tiempo real. |
| **Export CSV reportes** | Ya existe endpoint; asegurar que el frontend tenga botón “Exportar CSV” donde corresponda. |

---

## 8. Checklist resumido “Listo para venta”

- [ ] **DIAN:** Envío real a API DIAN, PDF de factura, consulta de estado (si vendes en Colombia como facturación electrónica).
- [ ] **Seguridad:** Secrets de producción, CORS, HTTPS; sin `.env` en el repo.
- [ ] **Despliegue:** API, BD, Redis y frontend desplegados y accesibles.
- [ ] **Primer uso:** Primer usuario creado, login y flujo básico verificados.
- [ ] **Backups:** Estrategia definida y probada.
- [ ] **Documentación:** Guía de uso para el cliente (y/o soporte definido).
- [ ] **Comercial:** Licencia/contrato y forma de facturación del servicio (si aplica).

---

## 9. Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| `PASOS_CUANDO_FINALICE.md` | Cierre de desarrollo, despliegue, puesta en marcha, operación. |
| `RECUENTO_PENDIENTES.md` | Pendientes detallados (DIAN, frontend, etc.). |
| `QUE_HACE_FALTA.md` | Estado actual y qué falta (crítico/opcional). |
| `FLUJOS_QUE_FALTAN_INTEGRAR.md` | Flujos API ↔ frontend ya integrados y pendientes. |
| `USUARIOS_PRODUCCION.md` | Crear y gestionar usuarios en producción. |
| `GUIA_LEVANTAR_PROYECTO.md` | Cómo levantar el proyecto en local (desarrollo/pruebas). |

---

**Última actualización:** Febrero 2026
