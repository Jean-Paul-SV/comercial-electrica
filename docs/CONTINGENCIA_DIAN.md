# Contingencia DIAN – Colas, reintentos y modo contingencia

> **Objetivo:** Qué hacer cuando la DIAN no responde o está en mantenimiento, y cómo están configuradas las colas y reintentos en Orion.

---

## 1. Cola y reintentos (BullMQ)

- Cada factura electrónica genera un **DianDocument** en estado `DRAFT` y se encola un job en la cola **`dian`** con tipo **`send`** y payload `{ dianDocumentId }`.
- El **worker** (`DianProcessor`) procesa el job: genera XML, firma, envía a la DIAN y actualiza el estado del documento.
- **Reintentos:** Los jobs se encolan con **10 intentos** y **backoff exponencial** (delay inicial 5 s). Si la DIAN no responde o devuelve error temporal, BullMQ reintenta automáticamente.
- Si tras agotar los intentos el job sigue fallando, el documento queda en **REJECTED** con `lastError` y el job queda en estado **failed** en la cola (visible en Redis/BullBoard si lo tienes instalado).

---

## 2. Cuándo activar “modo contingencia”

- La DIAN anuncia mantenimiento o caída del servicio.
- Errores masivos (timeout, 503, 500) al enviar facturas.
- Necesidad de no saturar reintentos mientras el servicio está caído.

En esos casos puedes activar el **modo contingencia** para que la API **no envíe** a la DIAN pero **siga generando y firmando** el XML. Los documentos permanecen en **DRAFT** y podrán enviarse cuando desactives el modo.

---

## 3. Variable de entorno: modo contingencia

| Variable | Valor | Efecto |
|----------|--------|--------|
| `DIAN_CONTINGENCY_MODE` | `true` o `1` | No se envía a la DIAN. El worker no genera XML ni llama al Web Service; el documento queda en **DRAFT** y el job termina sin error (no consume reintentos). Al desactivar el modo, los jobs se pueden reintentar. |
| No definida o `false` | — | Comportamiento normal: se envía a la DIAN. |

**Uso recomendado:**

1. Ante mantenimiento DIAN: en Render (o tu entorno), añadir `DIAN_CONTINGENCY_MODE=true` y redeploy (o reiniciar).
2. Las ventas siguen creando facturas y documentos DIAN; los jobs se procesan sin enviar.
3. Cuando la DIAN vuelva: quitar la variable o poner `DIAN_CONTINGENCY_MODE=false` y redeploy.
4. Los documentos que quedaron en DRAFT se pueden **reencolar** manualmente (por ejemplo con un script que busque `DianDocument` con `status = DRAFT` y vuelva a añadir el job a la cola) o esperar a que implementes un “Reintentar pendientes” desde la UI.

---

## 4. Reintentar documentos en DRAFT

Hoy no hay pantalla para “reintentar envío” de documentos en DRAFT. Opciones:

- **Script puntual:** Consultar en BD los `DianDocument` con `status = DRAFT` y, para cada uno, añadir de nuevo el job a la cola `dian` con `dianQueue.add('send', { dianDocumentId: id })`.
- **Futuro:** Botón “Reintentar envíos pendientes” en Facturación electrónica o en el listado de facturas que llame a un endpoint que reencole los DRAFT del tenant.

---

## 5. Resumen

| Tema | Comportamiento |
|------|----------------|
| Cola | BullMQ, cola `dian`, job tipo `send` con `dianDocumentId`. |
| Reintentos | 10 intentos, backoff exponencial 5 s. |
| Modo contingencia | `DIAN_CONTINGENCY_MODE=true`: no envía a DIAN, documento queda DRAFT. |
| Tras contingencia | Quitar variable y, si aplica, reencolar documentos DRAFT. |

---

---

## 6. Alertas por email (certificado / rango)

Un **cron diario** (todos los días a las 08:00) ejecuta el envío de alertas a los usuarios con permiso `dian:manage` (o `dian:manage_certificate`) de cada tenant que tenga:

- Certificado por vencer en **menos de 30 días**, o
- **Menos de 500 números** restantes en el rango autorizado.

**Requisito:** SMTP configurado (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` en el entorno). Si no está configurado, el cron no envía correos y solo registra en log. Ver `env.example` (sección Forgot password / SMTP).

**Referencias:** `apps/api/src/dian/dian.service.ts` (método `sendDianAlertsForTenants`), `apps/api/src/dian/dian-alerts.scheduler.ts`.

---

**Referencias (contingencia):** `apps/api/src/dian/dian.processor.ts`, `apps/api/src/dian/dian.service.ts` (método `processDocument`), `apps/api/src/sales/sales.service.ts` (encolado al crear venta).
