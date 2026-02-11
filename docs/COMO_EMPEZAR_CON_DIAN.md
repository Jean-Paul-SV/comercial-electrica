# Cómo empezar con DIAN (en base a lo que ya tenemos)

> **¿Primera vez y no entiendes nada?** Abre **`DIAN_GUIA_PASO_A_PASO.md`**: ahí está explicado paso a paso qué hacer en la web de la DIAN y qué poner en el `.env` de Orion.  
> **Objetivo:** Orden práctico para cerrar la facturación electrónica con la DIAN usando la estructura que ya existe en el proyecto.  
> **Referencias:** `DIAN_GUIA_PASO_A_PASO.md`, `DIAN_PASOS_IMPLEMENTACION.md`, `DIAN_INTEGRACION_ESTADO.md`, `GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md`.

---

## Lo que ya está hecho

| Componente | Estado | Dónde está |
|------------|--------|------------|
| **XML UBL 2.1** | ✅ | `apps/api/src/dian/dian.service.ts` → `generateXML()` |
| **Firma digital** | ✅ | `signDocument()` con certificado .p12 (xml-crypto + node-forge) |
| **Cola de procesamiento** | ✅ | BullMQ en `dian.processor.ts`; cada venta crea `DianDocument` y encola el job |
| **Flujo completo (simulado)** | ✅ | `processDocument()` → genera XML → firma → `sendToDian()` (simula) → `handleDianResponse()` → opcional `generatePDF()` (placeholder) |
| **Consulta estado** | Solo local | `queryDocumentStatus()` lee de BD; no llama a DIAN |

Falta conectar con los servicios **reales** de la DIAN y generar el PDF de la factura.

---

## Por dónde empezar (orden recomendado)

### 1. Envío real a la API DIAN

**Archivo:** `apps/api/src/dian/dian.service.ts` → método **`sendToDian()`**.

- **Comportamiento:** Si `DIAN_API_BASE_URL` está definida o `DIAN_USE_DEFAULT_URL=true`, se hace POST con **sobre SOAP** (operación ReceiveInvoice: `fileName` + `contentFile` en base64). Timeout 30 s, 3 reintentos. Si no hay URL configurada, se simula respuesta.
- **SOAP:** Por defecto `DIAN_USE_SOAP=true`: se construye un envelope SOAP 1.1 con `soap:Header` (SoftwareID, SoftwarePIN) y `soap:Body` con `wcf:ReceiveInvoice` (namespace `http://wcf.dian.colombia`). Content-Type: text/xml y SOAPAction de ReceiveInvoice.
- **Variables:** `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN`; para envío real: `DIAN_API_BASE_URL` o `DIAN_USE_DEFAULT_URL=true`. Opcional: `DIAN_USE_SOAP`, `DIAN_SEND_PATH`, `DIAN_HTTP_TIMEOUT_MS`, `DIAN_HTTP_MAX_RETRIES`, `DIAN_HTTP_RETRY_DELAY_MS`.
- **Respuesta:** Se parsea XML o JSON (IsValid, CUFE, Description/Message) y se actualiza estado y CUFE en BD.
- **Producción (Render):** Para que la API desplegada en Render envíe a la DIAN, configura las mismas variables en el panel de Render y redepliega. Guía: **`DIAN_PRODUCCION_RENDER.md`**.

Documentación oficial: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/

### 2. CUFE

- El CUFE lo puede devolver la DIAN en la respuesta o debe calcularse según el Anexo Técnico FE 1.9.
- Incluirlo en el XML (extensión/atributo que indique la normativa) y/o guardarlo en `DianDocument` para el PDF y la consulta.

### 3. PDF de la factura

**Archivo:** mismo `dian.service.ts` → método **`generatePDF()`**.

- Hoy: solo log / placeholder.
- Objetivo: plantilla de factura (pdfkit, puppeteer o similar), con QR, CUFE y datos obligatorios; guardar en disco o en tu storage (S3, etc.) y actualizar la ruta en BD si aplica.

### 4. Consulta de estado real

**Archivo:** `dian.service.ts` → **`queryDocumentStatus()`**.

- Hoy: devuelve solo el estado almacenado en BD.
- Objetivo: llamar al Web Service de consulta de estado de la DIAN y sincronizar el estado (y CUFE si aplica) en `DianDocument` / `DianEvent`.

---

## Variables de entorno que ya usa el código

- `DIAN_ENV` = `HABILITACION` | `PRODUCCION`
- `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN` (obligatorios para envío)
- `DIAN_API_BASE_URL`: si está definida, se hace envío real; si no y `DIAN_USE_DEFAULT_URL=true`, se usan URLs por defecto (hab/prod); si no, se simula.
- `DIAN_USE_DEFAULT_URL`: `true` para usar vpfe-hab o vpfe según DIAN_ENV sin definir DIAN_API_BASE_URL.
- `DIAN_USE_SOAP`: `true` (por defecto) envía sobre SOAP ReceiveInvoice; `false` envía el XML firmado en crudo.
- `DIAN_SEND_PATH`: ruta del servicio (por defecto `/WcfDianCustomerServices.svc`)
- `DIAN_HTTP_TIMEOUT_MS`, `DIAN_HTTP_MAX_RETRIES`, `DIAN_HTTP_RETRY_DELAY_MS`: timeout y reintentos del POST
- `DIAN_CERT_PATH`, `DIAN_CERT_PASSWORD` (certificado .p12 para la firma)
- Opcionales: `DIAN_RESOLUTION_NUMBER`, `DIAN_PREFIX`, `DIAN_RANGE_FROM`, `DIAN_RANGE_TO`

Detalle y troubleshooting: **`GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md`**. Listado completo en **`env.example`**.

---

## Resumen

1. **Primer paso concreto:** Implementar la llamada HTTP real en **`sendToDian()`** (habilitación), con las credenciales y la URL del manual DIAN, y actualizar estados según la respuesta.
2. Luego: CUFE (cálculo o uso del que devuelva la DIAN) y PDF.
3. Por último: consulta de estado real en **`queryDocumentStatus()`**.

Todo el flujo (venta → documento DIAN → cola → procesamiento) ya está; solo falta sustituir las partes simuladas por las llamadas reales a la DIAN y la generación del PDF.
