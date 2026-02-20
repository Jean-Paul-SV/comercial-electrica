# 📋 Qué falta por hacer

**Última actualización:** 2026-02-20  
**Estado:** Todo lo implementable en código está hecho. Lo que sigue son **acciones manuales** y **configuración**.

---

## 🎯 Resumen en una página

| Área | Qué falta | Prioridad | Tiempo aprox. |
|------|-----------|-----------|----------------|
| **Infraestructura** | Migrar Render free → starter + monitoreo externo | 🔴 Crítico | ~1 h |
| **Stripe** | Webhook en producción + `STRIPE_WEBHOOK_SECRET` + Price IDs en planes | 🔴 Crítico | ~30 min |
| **Stripe** | Probar un pago real (checkout + webhook) | 🟠 Alto | ~15 min |
| **DIAN** | Validación en habilitación con certificados reales | 🟠 Alto | 2-3 sem |
| **Pruebas** | Ejecutar pruebas de carga (k6/Artillery) | 🟠 Alto | 1-2 días |
| **Config** | Alertas por email (SMTP + ALERT_EMAIL) | 🟡 Medio | ~10 min |
| **Config** | Archivado automático (ARCHIVE_ENABLED=true) | 🟡 Medio | 5 min |

---

## 🔴 Crítico (hacer primero)

### 1. Infraestructura

- **Migrar plan Render** (free → starter o superior)  
  - Guía: `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md`  
  - Tiempo: 30-45 min · Costo: ~$7-25/mes  

- **Monitoreo externo** (saber cuando la API cae)  
  - UptimeRobot (o similar) apuntando a `GET /health`  
  - Alertas por email cuando falle  
  - Guía: dentro del checklist de Render  

### 2. Stripe (facturación SaaS)

- **Webhook en producción**  
  - En Stripe Dashboard: **Developers** → **Webhooks** → **Add endpoint**  
  - URL: `https://TU-API-RENDER/billing/webhooks/stripe`  
  - Eventos mínimos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`  
  - Copiar **Signing secret** (`whsec_...`)  

- **Variable de entorno**  
  - En Render (o tu host): `STRIPE_WEBHOOK_SECRET=whsec_...`  
  - Sin esto, los pagos en Stripe no activan el plan en la app.  

- **Price IDs en los planes**  
  - Stripe Dashboard → Products: crear producto/precio por plan (mensual/anual).  
  - En tu app: Panel proveedor → Planes → editar cada plan y asignar `stripePriceId` y `stripePriceIdYearly` (según corresponda).  
  - Guía: `docs/CONFIGURACION_STRIPE_CHECKOUT.md`  

- **Claves Stripe en producción**  
  - `STRIPE_SECRET_KEY=sk_live_...` (y no `sk_test_...` cuando quieras cobrar de verdad).  

---

## 🟠 Importante (próximas 2 semanas)

### 3. Stripe – Validar que todo funciona

- Hacer **una compra de prueba** de punta a punta:  
  - Usuario sin plan → elige plan → Checkout Stripe → pago (tarjeta de test en modo test).  
  - Comprobar que el webhook responde 200 y que el plan queda activo en la app.  
- Guía: `docs/GUIA_TESTEO_PAGOS_STRIPE.md`  

- **(Opcional)** Customer Portal de Stripe para que los clientes cambien tarjeta o vean facturas:  
  - Stripe Dashboard → Settings → Billing → Customer portal.  
  - La app ya tiene flujo para abrir el portal si está configurado.  

### 4. DIAN (facturación electrónica Colombia)

- Obtener **credenciales reales** por tenant (certificado .p12, Software ID, PIN).  
- Validar en **habilitación** con 10-20 facturas de prueba.  
- Guía: `docs/GUIA_VALIDACION_DIAN.md`  

### 5. Pruebas de carga

- Instalar k6 o Artillery y ejecutar escenarios (50 / 100 / 200 tenants).  
- Guía: `docs/GUIA_PRUEBAS_CARGA.md`  

---

## 🟡 Configuración recomendada

### 6. Alertas por email

- **SMTP** ya usado por la app: configurar `SMTP_*` en producción si no está.  
- **Destinatarios:**  
  - `ALERT_EMAIL=tu@email.com`  
  - o `ALERT_EMAILS=admin@empresa.com,soporte@empresa.com`  
- **(Opcional)** Recibir también alertas “warning”:  
  - `ALERT_EMAIL_INCLUDE_WARNING=true`  
- Las alertas **críticas** (BD, Redis, certificados DIAN, backups, pagos no reconocidos) ya se envían por email si SMTP y ALERT_EMAIL/ALERT_EMAILS están configurados.  
- Guía: `docs/ALERTAS_CONFIGURACION.md`  

### 7. Archivado automático

- Para controlar crecimiento de la base de datos en producción:  
  - `ARCHIVE_ENABLED=true`  
  - `AUDIT_RETENTION_DAYS=730`  
  - `SALES_RETENTION_YEARS=2`  
- El `/health` en producción te recordará si no está activado.  

### 8. Verificación multi-tenant (opcional)

- Ejecutar una vez (o en CI):  
  - `npm run verify:tenant-isolation`  

---

## 📄 Checklist único “qué falta”

### Crítico

- [ ] Migrar Render a plan starter (o superior)  
- [ ] Configurar monitoreo externo (UptimeRobot) a `/health`  
- [ ] Crear webhook Stripe en producción → URL + eventos  
- [ ] Poner `STRIPE_WEBHOOK_SECRET` en variables de entorno de la API  
- [ ] Tener productos/precios en Stripe y asignar Price IDs a los planes en la app  
- [ ] Usar `STRIPE_SECRET_KEY` de live cuando vayas a cobrar real  

### Importante

- [ ] Hacer al menos una compra de prueba (checkout → webhook → plan activo)  
- [ ] Validar DIAN en habilitación con certificados reales  
- [ ] Ejecutar pruebas de carga y revisar resultados  

### Configuración

- [ ] SMTP + `ALERT_EMAIL` o `ALERT_EMAILS` para alertas por email  
- [ ] (Opcional) `ALERT_EMAIL_INCLUDE_WARNING=true`  
- [ ] (Opcional) `ARCHIVE_ENABLED=true` y retenciones  

---

## 📚 Documentos de referencia

| Tema | Documento |
|------|-----------|
| Pendientes técnicos detallados | `docs/PENDIENTES_POR_IMPLEMENTAR.md` |
| Migración Render + monitoreo | `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md` |
| Stripe Checkout y webhook | `docs/CONFIGURACION_STRIPE_CHECKOUT.md` |
| Testeo de pagos Stripe | `docs/GUIA_TESTEO_PAGOS_STRIPE.md` |
| Validación DIAN | `docs/GUIA_VALIDACION_DIAN.md` |
| Pruebas de carga | `docs/GUIA_PRUEBAS_CARGA.md` |
| Alertas (email, Slack, webhook) | `docs/ALERTAS_CONFIGURACION.md` |
| Resumen ejecutivo del proyecto | `docs/RESUMEN_EJECUTIVO_FINAL.md` |

---

## ✅ Lo que ya está hecho (no te falta implementar)

- Connection pool, reconciliación Stripe cada hora, detección de pagos no reconocidos.  
- Métricas de conexiones en `/health`, aviso de archivado en health.  
- Validación de backups (checksums + restauración de prueba).  
- Validación NIT en certificados DIAN, rate limiting por tenant y por IP (login, bootstrap, reset, accept-invite).  
- Auditoría de queries sin tenantId (middleware Prisma).  
- Dashboard de métricas de negocio en Panel proveedor.  
- Límites de plan (maxUsers + enabledModules) y endpoint `GET /tenant/limits`.  
- Alertas por email (críticas + opcional warning), varios destinatarios (`ALERT_EMAILS`).  
- Checklist migración Render, guías DIAN, pruebas de carga, documentación de alertas.  

Todo lo anterior está en código y/o documentación; lo que falta es **configuración y pasos manuales** (Render, Stripe Dashboard, DIAN, SMTP, etc.).
