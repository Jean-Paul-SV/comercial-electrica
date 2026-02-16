# Estado de la integración DIAN (facturación electrónica)

> **Última actualización:** 2026-02-10  
> Ref: Resolución 000165/2023, Anexo Técnico Factura Electrónica de Venta v1.9 (mod. Res. 000008, 000119, 000189 de 2024).

---

## Documentación oficial DIAN

- **Documentación técnica:** https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/
- **Normatividad:** https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/normatividad/
- **Anexo Técnico FE 1.9:** Incluye estructura UBL 2.1, validaciones y cálculo del CUFE.

---

## Estado por componente

| Componente | Estado | Ubicación | Notas |
|------------|--------|-----------|--------|
| **Estructura XML UBL 2.1** | ✅ Mejorado | `dian.service.ts` → `generateXML()` | Estructura corregida (líneas de factura como hermanas, sin wrapper); escape XML; emisor usa DIAN_ISSUER_NIT / DIAN_ISSUER_NAME. |
| **Firma digital** | ✅ Implementado | `signDocument()` | xml-crypto + node-forge (.p12). RSA-SHA256, SHA256, C14N. Si no hay certificado retorna XML sin firmar. |
| **Envío a API DIAN** | ✅ Implementado | `sendToDian()` | POST con sobre SOAP ReceiveInvoice cuando `DIAN_USE_DEFAULT_URL=true` o `DIAN_API_BASE_URL` está definida. Reintentos y log de 4xx/5xx. |
| **Estado de configuración** | ✅ Nuevo | `GET /dian/config-status` | Indica si falta algo (Software ID, PIN, certificado, DIAN_ISSUER_NIT, DIAN_ISSUER_NAME, URL) sin revelar secretos. |
| **Generación de PDF** | ✅ Implementado | `generatePDF()` | pdfkit + qrcode; factura con ítems, totales, CUFE y QR; guarda en `storage/invoice-pdfs/`. |
| **Consulta estado real** | ✅ Implementado | `syncDocumentStatusFromDian()`, `queryDocumentStatus()` | GetStatus (SOAP/REST); al consultar estado con doc SENT y CUFE se sincroniza con DIAN y se actualiza BD. |
| **CUFE** | ✅ Implementado | `computeCufe()` + XML | Cálculo SHA384 según Anexo; se incluye en el XML en `<cac:AdditionalDocumentReference>`; DIAN también puede devolverlo en la respuesta. |

---

## Variables de entorno DIAN

| Variable | Descripción | Uso actual |
|----------|-------------|------------|
| `DIAN_ENV` | `HABILITACION` o `PRODUCCION` | Ambiente; define URL por defecto si `DIAN_USE_DEFAULT_URL=true`. |
| `DIAN_SOFTWARE_ID` | Identificador del software ante DIAN | Header SOAP y validación; requerido para envío real. |
| `DIAN_SOFTWARE_PIN` | PIN del software | Header SOAP; requerido para envío real. |
| `DIAN_ISSUER_NIT` | **NIT del emisor (empresa)** | Va en el XML UBL (AccountingSupplierParty). **Obligatorio para evitar 400.** |
| `DIAN_ISSUER_NAME` | **Razón social del emisor** | Va en el XML UBL. **Obligatorio para evitar 400.** |
| `DIAN_USE_DEFAULT_URL` | `true` para usar URL hab/prod según DIAN_ENV | Si no está, no se envía a DIAN (modo simulado). |
| `DIAN_API_BASE_URL` | URL base del API (opcional) | Alternativa a DIAN_USE_DEFAULT_URL. |
| `DIAN_CERT_PATH` | Ruta al certificado .p12 | Usado en `signDocument()`; sin esto el XML va sin firma (DIAN rechaza en real). |
| `DIAN_CERT_PASSWORD` | Contraseña del .p12 | Usado en `signDocument()`. |
| `DIAN_RESOLUTION_NUMBER`, `DIAN_PREFIX`, `DIAN_RANGE_*` | Numeración y resolución | Disponibles en `getDianConfig()`. |

Ver **`env.example`** para el listado completo y comentarios.

---

## Checklist antes de enviar a DIAN (habilitación o producción)

1. **Configurar variables** (ver `env.example`):
   - `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN`
   - **`DIAN_ISSUER_NIT`** (NIT del emisor, no el Software ID)
   - **`DIAN_ISSUER_NAME`** (razón social)
   - `DIAN_USE_DEFAULT_URL=true` o `DIAN_API_BASE_URL`
   - `DIAN_CERT_PATH`, `DIAN_CERT_PASSWORD`
2. **Verificar estado:** `GET /dian/config-status` (con JWT y permiso `dian:manage`). Debe devolver `readyForSend: true` y `missing: []`.
3. **Certificado .p12** vigente y accesible por la API.
4. **Cliente con documento:** La factura debe tener cliente con `docType` y `docNumber` (CC/NIT).

Si la DIAN devuelve **400** con cuerpo vacío o rechazo, revisar logs (cuerpo y headers de la respuesta se registran). Ajustar NIT/razón social, numeración o esquema XML según documentación técnica DIAN.

---

## Próximos pasos recomendados

1. ~~**Firma digital:**~~ ✅ Hecho.
2. ~~**Envío real:**~~ ✅ Hecho (SOAP ReceiveInvoice, reintentos, log de errores).
3. ~~**CUFE:**~~ ✅ Hecho (SHA384 según Anexo; incluido en XML y PDF).
4. ~~**PDF:**~~ ✅ Hecho (pdfkit + QR + CUFE; guarda en `storage/invoice-pdfs/`).
5. ~~**Consulta estado:**~~ ✅ Hecho (GetStatus SOAP/REST; sincronización en `queryDocumentStatus`).
6. **Opcional:** Validar flujo completo en ambiente de habilitación/producción con certificado y credenciales reales. Botón “Reintentar envíos pendientes” en UI (ver `CONTINGENCIA_DIAN.md` y `TRAZABILIDAD_FALTA_IMPLEMENTAR.md`).

---

## Cambios recientes (2026-02-10)

- **getConfigStatus()** y **GET /dian/config-status:** Indica si la configuración está lista para envío y qué variables faltan (sin revelar PIN ni certificado).
- **sendToDian:** Advertencia en log si DIAN_ISSUER_NIT o DIAN_ISSUER_NAME no están configurados (evita 400 por emisor incorrecto).
- **Documentación:** Tabla de estado actualizada (envío real implementado), checklist antes de enviar, variables DIAN_ISSUER_* destacadas.

## Cambios anteriores (2026-02-02)

- **generateXML:** Líneas de factura generadas como elementos hermanos `<cac:InvoiceLine>` (UBL 2.1 correcto). Eliminado wrapper incorrecto.
- **escapeXml:** Añadido escape de textos dinámicos (nombre producto, cliente, número factura, etc.) para evitar XML inválido.
- **Comentarios y referencias:** Actualizada normativa (Res. 000165/2023, Anexo 1.9) y enlace a documentación técnica DIAN.

---

## Guía de configuración y troubleshooting

Para variables de entorno, certificado, ambientes (habilitación/producción) y resolución de errores típicos, ver **`GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md`**.
