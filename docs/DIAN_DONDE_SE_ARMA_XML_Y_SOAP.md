# Dónde se arma el XML y el SOAP que se envían a la DIAN

Todo está en **`apps/api/src/dian/dian.service.ts`**. Esta guía indica las partes exactas y qué revisar cuando la DIAN devuelve 400 u otro error.

---

## 1. Flujo general

1. **`processDocument(dianDocumentId)`** (aprox. línea 95)  
   Orquesta: genera XML → firma → envía → procesa respuesta.

2. **`generateXML(dianDocumentId)`** (aprox. línea 335)  
   Arma el **XML UBL 2.1** de la factura (Invoice).

3. **`signDocument(xml, dianDocumentId)`** (aprox. línea 517)  
   Firma el XML con el certificado .p12 (si está configurado). Si no, devuelve el XML sin firmar.

4. **`sendToDian(signedXml, dianDocumentId)`** (aprox. línea 784)  
   Decide si usa SOAP o no, arma el cuerpo del POST y llama a `sendToDianHttp`.

5. **`buildSoapEnvelopeReceiveInvoice(signedXml, fileName)`** (aprox. línea 601)  
   Construye el **sobre SOAP** con `ReceiveInvoice`, `fileName` y `contentFile` (base64).

6. **`sendToDianHttp(body, dianDocumentId, useSoap)`** (aprox. línea 623)  
   Hace el **POST** a la URL de la DIAN con `Content-Type: application/soap+xml` y el cuerpo anterior.

---

## 2. Dónde se arma el XML UBL (factura)

**Método:** `generateXML(dianDocumentId)` (líneas ~335–461).

- **Datos que usa:** factura, venta, ítems, cliente (desde BD vía `dianDocument` → `invoice` → `sale` / `customer`).
- **Config:** `getDianConfig()` (líneas ~975–986): `softwareId`, `softwarePin`, `DIAN_RESOLUTION_NUMBER`, `DIAN_PREFIX`, `DIAN_RANGE_FROM`, `DIAN_RANGE_TO`.

**Qué revisar si la DIAN devuelve 400:**

| Parte del XML | Dónde en el código | Qué revisar |
|---------------|--------------------|------------|
| **Emisor (NIT)** | `AccountingSupplierParty` → `cbc:ID schemeID="4"` (~línea 412) | Se usa `config.issuerNit` (variable **`DIAN_ISSUER_NIT`**). Si no la defines, se usa el Software ID, que puede causar 400. **`DIAN_ISSUER_NAME`** es la razón social en el XML. |
| **Cliente (documento)** | `AccountingCustomerParty` → `cbc:ID` (~líneas 414–416) | `customer.docNumber` y `customer.docType` (CC/NIT). No puede ir vacío para factura electrónica; el cliente debe tener documento. |
| **Número de factura** | `cbc:ID` (~línea 394) | Usa `invoice.number` (ej. INV-20260211-26C45D). Debe estar en el rango autorizado por la DIAN y cumplir su formato (resolución, prefijo, numeración). |
| **Fechas** | `IssueDate` / `IssueTime` (~395–396) | Formato ISO; se derivan de `invoice.issuedAt`. |
| **Totales** | `LegalMonetaryTotal`, `TaxTotal` (~425–446) | Deben cuadrar con subtotal, IVA y total de la factura. |
| **Ítems** | `invoiceLinesXml` (~367–386) | Cantidad, precios, descripción. Que no haya valores negativos o incoherentes. |

Ya están soportadas **`DIAN_ISSUER_NIT`** y **`DIAN_ISSUER_NAME`** en `.env` / variables de entorno: se usan en `AccountingSupplierParty`. Si no las defines, se usa el Software ID como NIT (puede causar 400).

---

## 3. Dónde se arma el sobre SOAP

**Método:** `buildSoapEnvelopeReceiveInvoice(signedXml, fileName)` (líneas ~601–618).

- **Entrada:** XML de la factura (ya firmado o no) y `fileName` (ej. `factura-<uuid>.xml`).
- **Salida:** XML del sobre SOAP con:
  - `soap:Header`: `SoftwareID`, `SoftwarePIN`.
  - `soap:Body`: `wcf:ReceiveInvoice` con `wcf:fileName` y `wcf:contentFile` (XML en base64).

**Nombre del archivo:** Se define en `sendToDian` (~línea 807):  
`const fileName = \`factura-${dianDocumentId}.xml\`;`

**Qué revisar:** Que el namespace y el nombre de la operación coincidan con lo que pide la documentación técnica actual de la DIAN (`ReceiveInvoice`, `http://wcf.dian.colombia`). Si la DIAN cambia el contrato, se ajusta aquí.

---

## 4. Dónde se hace el POST a la DIAN

**Método:** `sendToDianHttp(body, dianDocumentId, useSoap)` (líneas ~623–702).

- **URL:** `getDianSendUrl()` → base por `DIAN_USE_DEFAULT_URL` o `DIAN_API_BASE_URL` + `DIAN_SEND_PATH` (ej. `https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc`).
- **Headers cuando useSoap = true:**  
  `Content-Type: application/soap+xml; charset=utf-8`,  
  `SOAPAction: "http://wcf.dian.colombia/IWcfDianCustomerServices/ReceiveInvoice"`.
- **Cuerpo:** El sobre SOAP (o el XML directo si no usas SOAP).

Cuando la respuesta es **4xx/5xx**, desde el último cambio se loguea el cuerpo de la respuesta (hasta 1500 caracteres) en un `WARN` con el texto `DIAN respuesta 400 (cuerpo): ...`. Ahí verás el mensaje de error exacto de la DIAN.

---

## 5. Errores 400 típicos y dónde actuar

| Mensaje / causa probable | Dónde actuar |
|---------------------------|-------------|
| Firma requerida / documento sin firmar | Configurar `DIAN_CERT_PATH` y `DIAN_CERT_PASSWORD`; la firma se aplica en `signDocument`. |
| NIT emisor inválido o no coincide | XML en `generateXML`: `AccountingSupplierParty` → usar NIT de la empresa (p. ej. `DIAN_ISSUER_NIT`) en lugar de `softwareId`. |
| Cliente sin documento / documento inválido | Validar que la venta tenga cliente con `docNumber` y `docType` correctos; se usan en `AccountingCustomerParty`. |
| Numeración fuera de rango / formato | Revisar `invoice.number` y configuración de resolución/prefijo/rango (`getDianConfig`); ajustar generación del número en el módulo de facturas/ventas. |
| Error en estructura SOAP/XML | Revisar `buildSoapEnvelopeReceiveInvoice` y la documentación técnica DIAN (nombres de elementos, namespaces, encoding). |

---

## 6. Cómo ver el error exacto de la DIAN

Tras el cambio en `sendToDianHttp`, cuando la DIAN devuelve error:

- En los **logs de la API** busca líneas como:  
  `[DianService] DIAN respuesta 400 (cuerpo): ...`  
  Ahí viene el mensaje (o el XML/HTML de error) que devuelve la DIAN.

Con eso puedes ajustar el XML (emisor, cliente, numeración, etc.) o la firma según lo que indique la DIAN.
