# 📋 Qué falta por hacer

**Última actualización:** 2026-02-20  
**Estado:** Todo lo implementable en código está hecho. Lo que sigue son **acciones manuales** y **configuración**.  
**Facturación:** Solo **Wompi** (Nequi, PSE, tarjeta). Stripe fue eliminado.

---

## 🎯 Resumen en una página

| Área | Qué falta | Prioridad | Tiempo aprox. |
|------|-----------|-----------|----------------|
| **Infraestructura** | Migrar Render free → starter + monitoreo externo | 🔴 Crítico | ~1 h |
| **Wompi** | Cuenta + webhook/callback en producción + env (WOMPI_*) | 🔴 Crítico (cuando cobres) | ~30 min |
| **DIAN** | Validación en habilitación con certificados reales | 🟠 Alto | 2-3 sem |
| **Pruebas** | Ejecutar pruebas de carga (k6/Artillery) | 🟠 Alto | 1-2 días |
| **Config** | Alertas por email (SMTP + ALERT_EMAIL) | 🟡 Medio | ~10 min |
| **Config** | Archivado automático (ARCHIVE_ENABLED=true) | 🟡 Medio | 5 min |

---

## 🔴 Crítico (hacer primero)

### 1. Render: pasar de Free a Starter

- **Guía:** `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md` (pasos 1–3: `render.yaml` → Dashboard → verificar).
- Migrar plan Render (free → starter o superior).
- Tiempo: 30–45 min · Costo: ~$7–25/mes.
- **Cuando hagas la migración:** puedes crear un **nuevo** servicio de API con el nombre que quieras (ej. `orion-app-cloud-api`) para tener la URL nueva; el checklist incluye el paso opcional 3b (nueva URL).

### 2. Monitoreo: UptimeRobot

- **Guía rápida (hacer ahora):** `docs/CONFIGURAR_MONITOREO_AHORA.md`
- **Guía detallada:** `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md` (sección “Configuración de Monitoreo Externo”) o `docs/GUIA_MONITOREO_EXTERNO.md`.
- **URL:** `https://TU-API.onrender.com/health`
- **Intervalo:** 5 min. **Alertas:** a tu email cuando el health falle o no responda.

### 3. Wompi (facturación – cuando vayas a cobrar)

La app **solo usa Wompi** para pagos (Nequi, PSE, tarjeta). No hay Stripe.

- **Cuenta Wompi:** crear y completar verificación en [Wompi](https://wompi.co) (o el portal que uses).
- **Webhook / callback en producción:**  
  - En el panel de Wompi: configurar URL de notificación (ej. `https://TU-API-RENDER/billing/webhooks/wompi` o el path que exponga tu API).  
  - Asegurar que los eventos de pago aprobado lleguen a la API para activar el plan.
- **En Render (o tu host):**  
  - Variables de entorno Wompi: `WOMPI_*` según tu integración (clave privada, evento de confirmación, etc.).  
  - Ver en código: `apps/api` y docs de Wompi para los nombres exactos.
- **Planes en la app:**  
  - Panel proveedor → Planes → precios y productos alineados con lo que ofreces en Wompi (no hay `stripePriceId`; los montos/planes se gestionan en tu BD y en el flujo Wompi).

Cuando tengas la cuenta Wompi lista: configurar webhook/callback en producción + variables `WOMPI_*` en Render; después, una prueba de punta a punta (elegir plan → pagar con Wompi → ver plan activo).

---

## 🟠 Importante (próximas 2 semanas)

| Tarea | Guía |
|-------|------|
| Probar flujo Wompi punta a punta | Checkout en app → pago (Nequi/PSE/tarjeta) → callback 200 → plan activo en la app. |
| DIAN: credenciales reales y validación | `docs/GUIA_VALIDACION_DIAN.md` |
| Pruebas de carga | `docs/GUIA_PRUEBAS_CARGA.md` (k6 o Artillery) |

---

## 🟡 Recomendado (cuando puedas)

- **Alertas por email:** guía rápida `docs/CONFIGURAR_ALERTAS_EMAIL_AHORA.md`; detallada `docs/ALERTAS_CONFIGURACION.md` (SMTP, ALERT_EMAIL, opcional `ALERT_EMAIL_INCLUDE_WARNING=true`).
- **Archivado:** `ARCHIVE_ENABLED=true`, `AUDIT_RETENTION_DAYS=730`, `SALES_RETENTION_YEARS=2`.
- **Multi-tenant:** ya tienes `npm run verify:tenant-isolation`; ejecutarlo de vez en cuando o en CI.

---

## 📄 Checklist único “qué falta”

### Crítico

- [ ] **Render:** pasar de Free a Starter (`docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md`, pasos 1–3).
- [ ] **UptimeRobot:** monitor a `GET https://TU-API.onrender.com/health`, intervalo 5 min, alertas a tu email.
- [ ] **Wompi (cuando cobres):** cuenta lista, webhook/callback en producción, variables `WOMPI_*` en Render, prueba de pago punta a punta.

### Importante

- [ ] Probar flujo Wompi punta a punta (pago → plan activo).
- [ ] Validar DIAN en habilitación con certificados reales.
- [ ] Ejecutar pruebas de carga y revisar resultados.

### Configuración

- [ ] SMTP + `ALERT_EMAIL` o `ALERT_EMAILS` para alertas por email.
- [ ] (Opcional) `ALERT_EMAIL_INCLUDE_WARNING=true`.
- [ ] (Opcional) `ARCHIVE_ENABLED=true` y retenciones.

---

## 📚 Documentos de referencia

| Tema | Documento |
|------|------------|
| Pendientes técnicos detallados | `docs/PENDIENTES_POR_IMPLEMENTAR.md` |
| Migración Render + monitoreo | `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md` |
| Monitoreo (UptimeRobot) – guía rápida | `docs/CONFIGURAR_MONITOREO_AHORA.md` |
| Configurar pagos (Wompi) | `docs/CONFIGURAR_PAGOS_WOMPI_STRIPE.md` (solo sección Wompi) |
| Validación DIAN | `docs/GUIA_VALIDACION_DIAN.md` |
| Pruebas de carga | `docs/GUIA_PRUEBAS_CARGA.md` |
| Alertas por email – guía rápida | `docs/CONFIGURAR_ALERTAS_EMAIL_AHORA.md` |
| Alertas (email, Slack, webhook) | `docs/ALERTAS_CONFIGURACION.md` |
| Resumen ejecutivo del proyecto | `docs/RESUMEN_EJECUTIVO_FINAL.md` |

*(Las guías de Stripe – checkout, webhook, testeo – quedan archivadas; la facturación en producción es solo Wompi.)*

---

## ✅ Lo que ya está hecho (no te falta implementar)

- **Facturación solo Wompi:** flujo de pago en la app (Nequi, PSE, tarjeta); Stripe eliminado del código.
- Connection pool, métricas en `/health`, aviso de archivado en health.
- Validación de backups (checksums + restauración de prueba).
- Validación NIT en certificados DIAN, rate limiting por tenant y por IP (login, bootstrap, reset, accept-invite).
- Auditoría de queries sin tenantId (middleware Prisma).
- Dashboard de métricas de negocio en Panel proveedor.
- Límites de plan (maxUsers + enabledModules) y endpoint `GET /tenant/limits`.
- Alertas por email (críticas + opcional warning), varios destinatarios (`ALERT_EMAILS`).
- Checklist migración Render, guías DIAN, pruebas de carga, documentación de alertas.

Todo lo anterior está en código y/o documentación; lo que falta es **configuración y pasos manuales** (Render, Wompi, DIAN, SMTP, etc.).

---

## Resumen: “qué sigue” en una frase

**Siguiente paso concreto:**  
1) Migrar Render a Starter y 2) Configurar UptimeRobot a `GET /health`, siguiendo `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md`.  
Cuando vayas a cobrar: configurar Wompi en producción (webhook/callback + variables `WOMPI_*` en Render) y hacer una prueba de pago punta a punta.
