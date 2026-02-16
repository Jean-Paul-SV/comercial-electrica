# Probar el flujo DIAN completo (CUFE, PDF, consulta estado)

Guía para probar de punta a punta: **venta → factura → documento DIAN → procesamiento** (XML con CUFE, envío simulado o real, generación de PDF, consulta de estado).

---

## Requisitos

- Base de datos y Redis (ver `COMO_PROBAR_CAMBIOS_RECIENTES.md`).
- API y web levantados (`npm run dev`).
- Usuario admin de tenant (ej. **admin@local.dev** / **AdminLocal1!**) con módulo facturación electrónica.
- **Modo simulado:** no configurar `DIAN_USE_DEFAULT_URL` ni `DIAN_API_BASE_URL` → el envío a DIAN se simula y el documento queda "aceptado (simulado)".
- **Modo real:** configurar Software ID/PIN, certificado, NIT/razón social y `DIAN_USE_DEFAULT_URL=true` (ver `PROBAR_DIAN_LOCAL.md`).

---

## 1. Crear una venta con cliente con documento

1. Inicia sesión en la web con **admin@local.dev** (o tu admin de tenant).
2. Asegúrate de tener **al menos un producto** y **un cliente con tipo y número de documento** (CC o NIT). Si no, créalos en Catálogo y Clientes.
3. Abre una **sesión de caja** si hace falta (Caja → Abrir caja).
4. Ve a **Ventas** → **Registrar venta**.
5. Elige un cliente (con docType y docNumber), añade al menos un producto y cantidad, y **registra la venta**.

Resultado: se crea la **venta**, la **factura** y el **documento DIAN** (estado DRAFT), y se encola el procesamiento. Si el worker de la cola está corriendo (API con Redis), el job se procesará en segundo plano.

---

## 2. Obtener el ID del documento DIAN

Puedes obtenerlo de dos formas:

- **Desde la web:** entra al **detalle de la venta** (clic en la venta). En la sección "Facturación electrónica (DIAN)" suele mostrarse el estado; el ID del documento está en la API.
- **Desde la base de datos:**
  ```bash
  cd apps/api
  npx prisma studio
  ```
  Abre la tabla **DianDocument**, filtra por **status = DRAFT** (o la factura que quieras) y copia el **id** (UUID).

- **Desde la API (listar ventas y ver dianDocument):** si tu `GET /sales` o el detalle de venta devuelve `dianDocument: { id }`, usa ese `id`.

---

## 3. Procesar el documento a mano (sin esperar al worker)

Sirve para probar el flujo sin depender de la cola.

1. Obtén un **token JWT** (iniciando sesión en la web y tomando el token del storage/localStorage, o con `POST /auth/login`).
2. Llama al endpoint de procesamiento:

```bash
# Reemplaza DOCUMENT_ID por el UUID del DianDocument y TOKEN por tu JWT
curl -X POST "http://localhost:3000/dian/documents/DOCUMENT_ID/process" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

Ejemplo (PowerShell):

```powershell
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
$docId = "uuid-del-documento-dian"
Invoke-RestMethod -Uri "http://localhost:3000/dian/documents/$docId/process" -Method POST -Headers @{ Authorization = "Bearer $token" }
```

Si el documento pertenece a tu tenant, la API ejecutará:

1. **Generar XML** (con CUFE calculado e incluido en `<cac:AdditionalDocumentReference>`).
2. **Firmar** (si hay certificado configurado).
3. **Enviar a DIAN** (o simular si no hay URL configurada).
4. **Procesar respuesta** → actualizar estado (ACCEPTED/REJECTED) y guardar CUFE si DIAN lo devuelve.
5. **Generar PDF** → se guarda en `storage/invoice-pdfs/{id}.pdf` (o en `OBJECT_STORAGE_BASE_PATH/invoice-pdfs/`).

---

## 4. Verificar resultados

### XML con CUFE

- El XML generado incluye un bloque:
  ```xml
  <cac:AdditionalDocumentReference>
    <cbc:ID schemeID="CUFE" schemeName="CUFE-SHA384">...base64...</cbc:ID>
  </cac:AdditionalDocumentReference>
  ```
- El CUFE se calcula con SHA384 sobre: número factura, fecha, hora, NIT emisor, NIT cliente, total, moneda.

### PDF

- Tras un procesamiento exitoso, en la carpeta **storage/invoice-pdfs** (o la configurada) debe aparecer un archivo **{dianDocumentId}.pdf**.
- El PDF contiene: título "FACTURA ELECTRÓNICA", número, fecha/hora, cliente, ítems, totales, texto del CUFE y **código QR** (con el CUFE o el ID del documento).

### Estado del documento

- **GET** ` /dian/documents/:id/status` (con JWT y permiso `dian:manage`) devuelve `status`, `cufe`, `sentAt`, `lastError`.
- Si el documento estaba en **SENT** y tiene CUFE, la API intenta **sincronizar con la DIAN** (consulta GetStatus) y luego devuelve el estado actualizado.

---

## 5. Consulta de estado (sincronización con DIAN)

- Al llamar **GET /dian/documents/:id/status**, si el documento está en estado **SENT** y tiene **CUFE**, se llama internamente a **syncDocumentStatusFromDian** (GetStatus en la DIAN).
- Si la DIAN devuelve aceptado/rechazado, se actualiza el documento en BD y se devuelve el nuevo estado.
- Para que la consulta real funcione, debe estar configurada la URL de consulta (por defecto misma base que el envío; opcionalmente `DIAN_QUERY_STATUS_URL` en `.env`).

---

## 6. Resumen del flujo

| Paso | Acción | Comprobación |
|------|--------|----------------|
| 1 | Registrar venta con cliente (docType + docNumber) | Factura y DianDocument creados (DRAFT). |
| 2 | Obtener ID del DianDocument | Prisma Studio o detalle de venta / API. |
| 3 | POST /dian/documents/:id/process (con JWT) | Respuesta 200; logs: XML, firma, envío, PDF. |
| 4 | Revisar PDF en storage/invoice-pdfs | Archivo {id}.pdf con datos, CUFE y QR. |
| 5 | GET /dian/documents/:id/status | status (ACCEPTED/REJECTED), cufe, sentAt. |

Con **modo simulado** (sin URL DIAN) no necesitas certificado ni Software ID/PIN para que el procesamiento llegue hasta el PDF; el envío se simula y el estado queda ACCEPTED con un CUFE ficticio. Para **envío real** y **consulta de estado real**, configura las variables según `PROBAR_DIAN_LOCAL.md` y `env.example`.
