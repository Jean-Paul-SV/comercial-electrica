# Código que deja de tener sentido al usar una API de facturación electrónica

> Si adquieres un proveedor de facturación electrónica (Alegra, Siigo, etc.) e integras su API, el código propio de DIAN que tienes hoy puede eliminarse o simplificarse. Este documento lista **qué quitar**, **qué conservar adaptado** y **qué añadir**.

---

## Resumen

| Qué | Acción |
|-----|--------|
| **Módulo DIAN completo** (generar XML, firmar, enviar a DIAN, PDF, consulta estado) | Eliminar o reemplazar por un cliente que llame a la API del proveedor |
| **Cola BullMQ `dian`** y worker que procesa documentos | Sustituir por llamada a la API del proveedor (síncrona o asíncrona según el proveedor) |
| **Modelos Prisma** (DianDocument, DianEvent, DianConfig) | Opción A: Eliminar y guardar solo `externalInvoiceId` en Invoice. Opción B: Mantener tablas simplificadas para guardar ID/estado del proveedor |
| **Variables de entorno DIAN** (certificado, softwareId, etc.) | Quitar; usar las del proveedor (API key, etc.) |
| **Frontend features/dian** | Eliminar o reducir a “consultar estado” si el proveedor lo expone vía tu backend |

---

## 1. Backend (API) – Qué quitar o reemplazar

### 1.1 Carpeta y módulo `dian` (casi todo)

| Archivo | Motivo |
|---------|--------|
| `apps/api/src/dian/dian.service.ts` | Generación XML, firma digital, `sendToDian()`, `generatePDF()`, `queryDocumentStatus()`: lo hace el proveedor. **Eliminar** o reemplazar por un `FacturacionElectronicaService` que llame a la API del proveedor. |
| `apps/api/src/dian/dian.processor.ts` | Worker BullMQ que procesa la cola `dian`. **Eliminar** cuando la factura se emita vía API del proveedor (en venta o al convertir cotización). |
| `apps/api/src/dian/dian.controller.ts` | Endpoints de configuración DIAN y estado de documento. **Eliminar** o dejar solo un endpoint que consulte estado vía tu backend al proveedor. |
| `apps/api/src/dian/dian.service.spec.ts` | Tests del servicio actual. **Eliminar** y escribir tests del nuevo cliente de facturación. |
| `apps/api/src/dian/dto/dian-config.dto.ts` | DTOs de config DIAN propia. **Eliminar** si ya no usas esa config. |
| `apps/api/src/dian/dian.module.ts` | **Eliminar** el módulo; en `app.module.ts` quitar `DianModule` y registrar el nuevo servicio/cliente del proveedor. |

### 1.2 Cola `dian` en BullMQ

- **`apps/api/src/queue/queue.module.ts`**  
  - Quitar `{ name: 'dian' }` de `BullModule.registerQueue` (ya no encolarás jobs de “enviar a DIAN”).

### 1.3 Uso en ventas y cotizaciones

- **`apps/api/src/sales/sales.service.ts`**  
  - Quitar: `@InjectQueue('dian')`, creación de `DianDocument`, `dianQueue.add(...)`.  
  - Añadir: después de crear `Invoice`, llamar al **cliente del proveedor** (ej. `facturacionService.emitirFactura(invoice, sale, customer)`) y guardar en tu BD el ID/estado que devuelva el proveedor (en `Invoice` o en una tabla tipo `DianDocument` simplificada).

- **`apps/api/src/quotes/quotes.service.ts`**  
  - Igual: quitar creación de `DianDocument` y `dianQueue.add`.  
  - Al convertir cotización a venta, después de crear la factura llamar al proveedor y guardar la referencia.

- **Tests**  
  - `apps/api/src/sales/sales.service.spec.ts`: quitar mocks de `dianQueue` y `dianDocument.create`; mockear el nuevo servicio de facturación.  
  - `apps/api/src/quotes/quotes.service.spec.ts`: mismo criterio.

### 1.4 Permisos y otros

- **`apps/api/src/auth/permissions.service.ts`**  
  - Si tienes permisos tipo `dian:read` / `dian:manage`, decidir si los mantienes para “ver estado de factura electrónica” o los eliminas.

- **`apps/api/src/app.module.ts`**  
  - Quitar `DianModule` del array `imports`.

- **`apps/api/src/main.ts`**  
  - Nada que quitar solo por DIAN; CORS y demás siguen igual.

---

## 2. Base de datos (Prisma)

Tienes dos caminos:

### Opción A: Dejar de usar DianDocument / DianEvent / DianConfig

- Crear una **migración** que:
  - Añada a `Invoice` un campo opcional, por ejemplo `externalInvoiceId` (string, nullable), para guardar el ID de la factura en el proveedor.
  - Opcional: `externalInvoiceStatus` (string, nullable).
- Eliminar modelos `DianDocument`, `DianEvent`, `DianConfig` del `schema.prisma` y generar migración que borre tablas e índices.
- Quitar la relación `dianDocument` del modelo `Invoice`.

### Opción B: Reutilizar tablas para el proveedor

- Mantener `DianDocument` (y quizá `DianEvent`) pero **simplificar**:
  - En `DianDocument`: guardar solo `invoiceId`, `status` (ej. PENDING, ACCEPTED, REJECTED), `externalId` (ID del proveedor), `cufe` si el proveedor lo devuelve, `sentAt`, `lastError`.
  - Quitar campos que ya no usarás: `xmlPath`, lógica de firma, etc.
- `DianConfig`: **eliminar** si la configuración pasa a ser la del proveedor (API key en env).
- El worker y la generación XML/firma/PDF **sí eliminarlos**; el flujo sería: crear venta → crear factura → llamar API proveedor → actualizar `DianDocument` con la respuesta.

---

## 3. Variables de entorno

En **`env.example`** y en tu `.env`:

- **Quitar** (o comentar como “ya no usados”):
  - `DIAN_ENV`
  - `DIAN_SOFTWARE_ID`
  - `DIAN_SOFTWARE_PIN`
  - `DIAN_CERT_PATH`
  - `DIAN_CERT_PASSWORD`
  - Cualquier otra `DIAN_*` que hayas añadido.

- **Añadir** las que pida el proveedor, por ejemplo:
  - `FACTURACION_API_URL`
  - `FACTURACION_API_KEY`
  - O las que indique su documentación.

---

## 4. Frontend (web)

| Ubicación | Motivo |
|-----------|--------|
| `apps/web/src/features/dian/` | `api.ts`, `hooks.ts`, `types.ts`: solo llaman a tu backend para estado de documento DIAN. **Eliminar** la carpeta si eliminas el endpoint en el backend, o **simplificar** a un solo hook que llame a un endpoint tuyo que consulte al proveedor. |
| `apps/web/src/app/(protected)/audit/page.tsx` | Tiene la etiqueta `dianDocument: 'Documento DIAN'`. Puedes cambiarla a “Factura electrónica” o “Documento facturación” y seguir mostrando el mismo tipo de entidad si en backend mantienes algo equivalente. |

En **ventas y cotizaciones** en el frontend: si hoy muestras “documento DIAN” o estado de envío, sustituir por el estado que devuelva tu backend (que a su vez vendrá del proveedor).

---

## 5. Qué añadir al integrar la API del proveedor

1. **Cliente del proveedor**  
   - Un módulo (ej. `facturacion-electronica/`) con un servicio que:
     - Reciba los datos de la factura (desde `Invoice` + `Sale` + `Customer`).
     - Llame a la API del proveedor (crear factura, obtener PDF, etc.).
     - Guarde en tu BD el ID externo y estado (en `Invoice` o en `DianDocument` simplificado).
     - Maneje errores y reintentos según la documentación del proveedor.

2. **Inyección en ventas y cotizaciones**  
   - En `SalesService` y en el flujo de “convertir cotización” en `QuotesService`: después de crear la factura, llamar a ese servicio y actualizar la factura/documento con la respuesta del proveedor.

3. **Variables de entorno**  
   - Las que pida el proveedor (API key, URL, etc.) y documentarlas en `env.example`.

4. **Tests**  
   - Tests unitarios del nuevo servicio (con mock de la API del proveedor).
   - Ajustar tests de `SalesService` y `QuotesService` para usar el nuevo servicio de facturación.

---

## 6. Orden sugerido al hacer el cambio

1. Contratar/configurar la API del proveedor y leer su documentación.
2. Crear el módulo y servicio que llama a la API del proveedor (sin tocar aún ventas/cotizaciones).
3. En ventas: quitar cola DIAN y creación de `DianDocument`; después de crear la factura, llamar al nuevo servicio y guardar el resultado.
4. En cotizaciones (convertir a venta): mismo cambio.
5. Quitar o simplificar el módulo `dian` (controller, processor, service), la cola `dian` y los modelos Prisma según hayas elegido (Opción A o B).
6. Actualizar frontend (quitar o simplificar `features/dian`, ajustar auditoría si aplica).
7. Actualizar `env.example` y documentación.
8. Ejecutar tests y pruebas de flujo completo (venta → factura electrónica vía proveedor).

---

**Última actualización:** Febrero 2026
