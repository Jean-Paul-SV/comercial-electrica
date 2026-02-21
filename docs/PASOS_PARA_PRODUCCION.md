# Los 7 pasos para llevar el proyecto a producción

**Última actualización:** 2026-02-21  
Todo lo que falta es **configuración y acciones manuales**; el código ya está listo.

---

## Resumen

| # | Paso | Prioridad | Tiempo aprox. | Guía |
|---|------|------------|----------------|------|
| 1 | Render: Free → Starter | 🔴 Crítico | 30–45 min | Checklist migración |
| 2 | UptimeRobot (monitoreo) | 🔴 Crítico | ~10 min | CONFIGURAR_MONITOREO_AHORA.md |
| 3 | Wompi (cuando cobres) | 🔴 Crítico | ~30 min | CONFIGURAR_PAGOS_WOMPI_STRIPE.md |
| 4 | DIAN: credenciales reales | 🟠 Importante | 2–3 sem | GUIA_VALIDACION_DIAN.md |
| 5 | Pruebas de carga | 🟠 Importante | 1–2 días | GUIA_PRUEBAS_CARGA.md |
| 6 | Alertas por email | 🟡 Recomendado | ~10 min | CONFIGURAR_ALERTAS_EMAIL_AHORA.md |
| 7 | Archivado automático | 🟡 Recomendado | ~5 min | Variables en Render |

---

## Paso 1: Render – pasar de Free a Starter

**Qué hacer:** Migrar el plan de la API (y si aplica, la base de datos) de free a starter en Render para evitar suspensiones y tener mejor disponibilidad.

- Editar `render.yaml`: cambiar `plan: free` a `plan: starter` en el servicio de la API.
- En Render Dashboard: Settings → Plan → elegir **Starter**.
- Verificar que el servicio queda en "Live" y que `GET /health` responde OK.
- **Opcional (paso 3b del checklist):** Crear un nuevo Web Service con el nombre deseado (ej. `orion-app-cloud-api`) para tener una URL nueva; actualizar frontend, UptimeRobot y Wompi con esa URL.

**Guía:** `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md` (pasos 1–3).

**Costo:** ~$7–25/mes.

---

## Paso 2: UptimeRobot (monitoreo)

**Qué hacer:** Tener un monitor externo que haga GET a `/health` cada 5 minutos y te avise por email si la API deja de responder.

- Crear cuenta en [uptimerobot.com](https://uptimerobot.com).
- Añadir contacto de alerta (tu email).
- Crear monitor: tipo HTTP(s), URL `https://TU-API.onrender.com/health`, intervalo 5 min, asignar el contacto.

**Guía:** `docs/CONFIGURAR_MONITOREO_AHORA.md`.

**Costo:** Gratis (plan free de UptimeRobot).

---

## Paso 3: Wompi (cuando vayas a cobrar)

**Qué hacer:** La facturación en la app es solo Wompi (Nequi, PSE, tarjeta). Cuando quieras cobrar a clientes, configurar cuenta y webhook en producción.

- Crear y verificar cuenta en [Wompi](https://wompi.co) (o el portal que uses).
- En el panel de Wompi: configurar URL de notificación (ej. `https://TU-API.onrender.com/billing/webhooks/wompi` o el path que exponga tu API).
- En Render: añadir variables de entorno `WOMPI_*` (clave, etc.) según tu integración.
- Panel proveedor → Planes: alinear precios/productos con lo que ofreces en Wompi.
- Hacer una prueba de pago punta a punta (elegir plan → pagar → comprobar que el plan queda activo).

**Guía:** `docs/CONFIGURAR_PAGOS_WOMPI_STRIPE.md` (solo sección Wompi).

---

## Paso 4: DIAN – credenciales reales y validación

**Qué hacer:** Para facturación electrónica en Colombia con la DIAN, usar certificados y credenciales reales y validar en habilitación (10–20 facturas de prueba).

- Obtener certificado .p12, Software ID y PIN por tenant (o los que use tu flujo).
- Configurar en la app (variables o panel) las credenciales reales.
- Validar en ambiente de habilitación de la DIAN según su proceso.

**Guía:** `docs/GUIA_VALIDACION_DIAN.md`.

**Tiempo:** 2–3 semanas (trámites y pruebas).

---

## Paso 5: Pruebas de carga

**Qué hacer:** Ejecutar pruebas de carga con k6 o Artillery para ver cómo se comporta la API con 50, 100 o más tenants/usuarios simulados.

- Instalar k6 o Artillery.
- Seguir los escenarios de la guía (login, listados, creación de registros, etc.).
- Revisar resultados (tiempos de respuesta, errores, cuellos de botella).

**Guía:** `docs/GUIA_PRUEBAS_CARGA.md`.

**Tiempo:** 1–2 días.

---

## Paso 6: Alertas por email

**Qué hacer:** Recibir por correo las alertas críticas (BD, Redis, DIAN, pagos no reconocidos) en la dirección que configures.

- En Render: configurar SMTP (Gmail con contraseña de aplicación u otro proveedor) y variables `ALERTS_ENABLED=true`, `ALERT_EMAIL=tu@email.com`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- Opcional: `ALERT_EMAIL_INCLUDE_WARNING=true` para recibir también alertas de tipo warning.
- Probar con la consola del navegador (fetch a `POST /metrics/alerts/test?severity=critical` con token `ce_access_token`) o con Postman.

**Guía:** `docs/CONFIGURAR_ALERTAS_EMAIL_AHORA.md`.

**Tiempo:** ~10 min.

---

## Paso 7: Archivado automático

**Qué hacer:** Activar el archivado para controlar el crecimiento de la base de datos en producción.

- En Render (Environment del servicio API) añadir o editar:
  - `ARCHIVE_ENABLED=true`
  - `AUDIT_RETENTION_DAYS=730` (opcional)
  - `SALES_RETENTION_YEARS=2` (opcional)
- Guardar; el redeploy aplicará los cambios. El endpoint `/health` puede recordarte si el archivado no está activado.

**Tiempo:** ~5 min.

---

## Orden sugerido

1. **Paso 1** (Render Starter) y **Paso 2** (UptimeRobot) para tener infraestructura y monitoreo sólidos.
2. **Paso 4** (DIAN) y **Paso 5** (pruebas de carga) en las próximas dos semanas.
3. **Paso 3** (Wompi) cuando vayas a cobrar a clientes.
4. **Paso 6** (alertas) y **Paso 7** (archivado) cuando puedas; no bloquean el “salir a producción”.

---

## Checklist rápido

- [ ] Paso 1: Render Free → Starter
- [ ] Paso 2: UptimeRobot configurado
- [ ] Paso 3: Wompi (cuando cobres)
- [ ] Paso 4: DIAN credenciales reales y validación
- [ ] Paso 5: Pruebas de carga ejecutadas
- [ ] Paso 6: Alertas por email configuradas
- [ ] Paso 7: Archivado activado

---

**Documentos relacionados:** `docs/QUE_FALTA_POR_HACER.md`, `docs/CHECKLIST_MIGRACION_RENDER_COMPLETO.md`.
