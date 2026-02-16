# DIAN – Pasos para implementación (facturación electrónica Colombia)

> **Cuándo usar este doc:** Cuando quieras cerrar la integración real con la DIAN (envío, PDF, consulta, CUFE). El sistema ya tiene estructura XML, firma digital y flujo simulado; falta conectar con los servicios reales.

**Referencias:** `DIAN_INTEGRACION_ESTADO.md`, `GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md`, `QUE_FALTA_HASTA_LA_FECHA.md` §1.

---

## Orden sugerido de implementación

| # | Tarea | Descripción | Estado |
|---|--------|-------------|--------|
| 1 | **Envío a API DIAN** | Conectar `sendToDian()` con el Web Service real (habilitación/producción). Autenticación con softwareId/softwarePin. Manejar respuestas ACEPTADO/RECHAZADO y reintentos. | ✅ Implementado (SOAP ReceiveInvoice; cuando `DIAN_USE_DEFAULT_URL=true` o `DIAN_API_BASE_URL` está definida). |
| 2 | **CUFE** | Calcular CUFE según Anexo Técnico DIAN e incluirlo en el XML (antes de firmar si aplica). | ✅ Implementado: `computeCufe()` SHA384 sobre cadena (número, fecha, hora, NIT emisor, NIT cliente, total, moneda); se incluye en `<cac:AdditionalDocumentReference>` con schemeID CUFE. |
| 3 | **PDF de factura** | Implementar `generatePDF()`: plantilla estándar, QR, CUFE, guardar en disco o S3. | ✅ Implementado: pdfkit + qrcode; guarda en `storage/invoice-pdfs/`; actualiza `dianDocument.pdfPath`. |
| 4 | **Consulta estado real** | Consumir Web Service de consulta DIAN y sincronizar estado en BD. | ✅ Implementado: `syncDocumentStatusFromDian()` llama GetStatus (SOAP o REST); `queryDocumentStatus()` sincroniza cuando status=SENT y hay CUFE, luego retorna estado. |

---

## Variables de entorno necesarias

- `DIAN_ENV` = `HABILITACION` | `PRODUCCION`
- `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN` (obligatorios para envío real)
- `DIAN_CERT_PATH`, `DIAN_CERT_PASSWORD` (firma digital; ya en uso)
- Opcionales: `DIAN_RESOLUTION_NUMBER`, `DIAN_PREFIX`, `DIAN_RANGE_FROM`, `DIAN_RANGE_TO`

Ver **`GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md`** para detalle.

---

## Documentación oficial DIAN

- Documentación técnica: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/
- Anexo Técnico FE 1.9: estructura UBL 2.1, validaciones y cálculo del CUFE.

---

**Tiempo estimado:** 3–4 semanas para envío + CUFE + PDF + consulta. Sin esto se puede vender el sistema como gestión comercial, pero no como facturación electrónica legal en Colombia.
