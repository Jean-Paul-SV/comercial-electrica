# Estado de la integración DIAN (facturación electrónica)

> **Última actualización:** 2026-02-02  
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
| **Estructura XML UBL 2.1** | ✅ Mejorado | `dian.service.ts` → `generateXML()` | Estructura corregida (líneas de factura como hermanas, sin wrapper); escape XML en textos dinámicos; referencias a normativa DIAN. |
| **Firma digital** | ✅ Implementado | `signDocument()` | xml-crypto + node-forge (.p12). RSA-SHA256, SHA256, C14N. Si no hay DIAN_CERT_PATH/DIAN_CERT_PASSWORD retorna XML sin firmar. |
| **Envío a API DIAN** | ❌ Pendiente | `sendToDian()` | Requiere autenticación con softwareId/softwarePin, endpoints habilitación/producción, manejo de respuestas y reintentos. Hoy simula respuesta exitosa. |
| **Generación de PDF** | ❌ Pendiente | `generatePDF()` | Requiere librería (pdfkit, puppeteer), plantilla de factura, QR y CUFE. Hoy solo guarda ruta simulada. |
| **Consulta estado real** | ❌ Pendiente | `queryDocumentStatus()` | Requiere consumo del Web Service de consulta DIAN. Hoy retorna solo el estado almacenado en BD. |
| **CUFE** | ⚠️ Parcial | Respuesta simulada en `sendToDian()` | El CUFE real debe calcularse según Anexo Técnico (hash de campos del documento). En producción lo asigna DIAN o se calcula antes de enviar. |

---

## Variables de entorno DIAN

| Variable | Descripción | Uso actual |
|----------|-------------|------------|
| `DIAN_ENV` | `HABILITACION` o `PRODUCCION` | Ambiente para envío (cuando esté implementado). |
| `DIAN_SOFTWARE_ID` | Identificador del software ante DIAN | Incluido en XML como NIT emisor; requerido para envío real. |
| `DIAN_SOFTWARE_PIN` | PIN del software | Requerido para autenticación en API DIAN. |
| `DIAN_RESOLUTION_NUMBER` | Número de resolución (opcional) | Disponible en `getDianConfig()`. |
| `DIAN_PREFIX` | Prefijo de numeración (ej. FAC) | Disponible en config. |
| `DIAN_RANGE_FROM` / `DIAN_RANGE_TO` | Rango de numeración | Disponible en config. |
| `DIAN_CERT_PATH` | Ruta al certificado .p12 de firma electrónica | Usado en `signDocument()`; si no está, XML sin firmar. |
| `DIAN_CERT_PASSWORD` | Contraseña del .p12 | Usado en `signDocument()`. |

---

## Próximos pasos recomendados

1. ~~**Firma digital:**~~ ✅ Hecho: certificado .p12 + xml-crypto (RSA-SHA256, C14N).
2. **Envío real:** Implementar cliente HTTP para el Web Service de recepción DIAN (habilitación y producción); manejar respuestas ACEPTADO/RECHAZADO y reintentos.
3. **CUFE:** Implementar cálculo del CUFE según Anexo Técnico 1.9 e incluirlo en el XML/extensión antes de firmar (si aplica).
4. **PDF:** Generar PDF de la factura con QR y CUFE; guardar en disco o storage (S3).
5. **Consulta estado:** Consumir Web Service de consulta de estado DIAN para sincronizar estados locales.

---

## Cambios recientes (2026-01-29)

- **signDocument:** Firma digital real con certificado .p12 (DIAN_CERT_PATH, DIAN_CERT_PASSWORD). Uso de xml-crypto (SignedXml) y node-forge para cargar PKCS#12. Algoritmos: RSA-SHA256, SHA256, C14N exclusivo, firma enveloped. Si no hay certificado configurado, se retorna XML sin firmar con advertencia en log.

## Cambios anteriores (2026-02-02)

- **generateXML:** Líneas de factura generadas como elementos hermanos `<cac:InvoiceLine>` (UBL 2.1 correcto). Eliminado wrapper incorrecto.
- **escapeXml:** Añadido escape de textos dinámicos (nombre producto, cliente, número factura, etc.) para evitar XML inválido.
- **Comentarios y referencias:** Actualizada normativa (Res. 000165/2023, Anexo 1.9) y enlace a documentación técnica DIAN.

---

## Guía de configuración y troubleshooting

Para variables de entorno, certificado, ambientes (habilitación/producción) y resolución de errores típicos, ver **`GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md`**.
