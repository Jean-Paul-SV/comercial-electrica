# Cómo empezar con DIAN (en base a lo que ya tenemos)

> **Objetivo:** Orden práctico para cerrar la facturación electrónica con la DIAN usando la estructura que ya existe en el proyecto.  
> **Referencias:** `DIAN_PASOS_IMPLEMENTACION.md`, `DIAN_INTEGRACION_ESTADO.md`, `GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md`.

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

- Hoy: simula respuesta exitosa.
- Objetivo: llamar al Web Service de recepción de la DIAN (ambiente habilitación primero).
- Necesitas:
  - **Credenciales:** `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN` (ya se leen en el constructor).
  - **URL del WS:** según documentación DIAN (habilitación vs producción).
  - **Autenticación:** según el manual técnico DIAN (token, WSSE, etc.).
  - **Manejo de respuesta:** ACEPTADO → actualizar estado y guardar CUFE; RECHAZADO → guardar motivo y reintentos si aplica.

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
- `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN` (obligatorios para envío real)
- `DIAN_CERT_PATH`, `DIAN_CERT_PASSWORD` (certificado .p12 para la firma)
- Opcionales: `DIAN_RESOLUTION_NUMBER`, `DIAN_PREFIX`, `DIAN_RANGE_FROM`, `DIAN_RANGE_TO`

Detalle y troubleshooting: **`GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md`**.

---

## Resumen

1. **Primer paso concreto:** Implementar la llamada HTTP real en **`sendToDian()`** (habilitación), con las credenciales y la URL del manual DIAN, y actualizar estados según la respuesta.
2. Luego: CUFE (cálculo o uso del que devuelva la DIAN) y PDF.
3. Por último: consulta de estado real en **`queryDocumentStatus()`**.

Todo el flujo (venta → documento DIAN → cola → procesamiento) ya está; solo falta sustituir las partes simuladas por las llamadas reales a la DIAN y la generación del PDF.
