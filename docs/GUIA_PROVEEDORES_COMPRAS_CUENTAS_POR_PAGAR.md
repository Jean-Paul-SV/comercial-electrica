# Guía: Proveedores, Compras y Cuentas por Pagar (Swagger + cURL)

Esta guía te permite probar el flujo completo:
**Proveedor → Pedido de compra → Recepción (sube inventario) → Factura con `dueDate` → Pagos parciales/completos → Pendientes/Vencidas**.

## Requisitos

- API corriendo (ver `docs/README.md` y `docs/SWAGGER_SETUP.md`)
- Swagger disponible en `/api/docs`
- Estar autenticado (ideal: usuario **ADMIN**)

## 1) Autenticación (Swagger)

1. En Swagger: **`POST /auth/login`**
2. Copia `accessToken`
3. Click **Authorize** → pega `Bearer <token>`

> Si no puedes loguearte por “Bootstrap ya fue realizado”, usa el usuario existente o resetea la BD local (ver docs de troubleshooting).

---

## 2) Crear Proveedor

### Swagger
Endpoint: **`POST /suppliers`**

Request body (JSON):

```json
{
  "nit": "900123456-7",
  "name": "Proveedor Ejemplo S.A.S.",
  "email": "contacto@proveedor.com",
  "phone": "3001234567",
  "address": "Calle 123 # 45-67",
  "cityCode": "11001",
  "contactPerson": "Juan Pérez"
}
```

Guarda el `id` del proveedor (`supplierId`).

### cURL (PowerShell)

```bash
curl.exe -X POST "http://localhost:3000/suppliers" ^
  -H "Authorization: Bearer TU_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{ \"nit\": \"900123456-7\", \"name\": \"Proveedor Ejemplo S.A.S.\", \"email\": \"contacto@proveedor.com\", \"phone\": \"3001234567\", \"address\": \"Calle 123 # 45-67\", \"cityCode\": \"11001\", \"contactPerson\": \"Juan Pérez\" }"
```

---

## 3) Crear Categoría y Producto (para comprar)

### Crear categoría
Endpoint: **`POST /categories`**

```json
{ "name": "Interruptores" }
```

Guarda `categoryId`.

### Crear producto
Endpoint: **`POST /products`**

```json
{
  "internalCode": "INT-001",
  "name": "Interruptor Sencillo",
  "categoryId": "PEGA_AQUI_CATEGORY_ID",
  "cost": 2000,
  "price": 4500,
  "taxRate": 19
}
```

Guarda `productId`.

> Importante: `categoryId` debe ser UUID real. Si pones texto, te dará 400 (validación).

---

## 4) Crear Pedido de Compra

Endpoint: **`POST /purchases`**

```json
{
  "supplierId": "PEGA_AQUI_SUPPLIER_ID",
  "expectedDate": "2026-02-15T00:00:00.000Z",
  "notes": "Pedido de reposición de stock",
  "items": [
    {
      "productId": "PEGA_AQUI_PRODUCT_ID",
      "qty": 10,
      "unitCost": 1500
    }
  ]
}
```

Guarda:
- `purchaseOrderId` (campo `id`)
- `purchaseOrderItemId` (en `items[0].id`)

Si quieres ver/recuperar el `purchaseOrderItemId` luego:
Endpoint: **`GET /purchases/{purchaseOrderId}`**

---

## 5) Recibir Pedido (esto sube inventario automáticamente)

Endpoint: **`POST /purchases/{purchaseOrderId}/receive`**

```json
{
  "receivedDate": "2026-02-03T00:00:00.000Z",
  "items": [
    {
      "itemId": "PEGA_AQUI_PURCHASE_ORDER_ITEM_ID",
      "receivedQty": 10
    }
  ]
}
```

Efecto:
- Crea un `InventoryMovement` tipo **IN**
- Aumenta `StockBalance.qtyOnHand`

Para verificar:
- **`GET /inventory/movements`** (deberías ver el IN asociado al proveedor)

---

## 6) Crear Factura del Proveedor (con fecha de pago `dueDate`)

Endpoint: **`POST /supplier-invoices`**

```json
{
  "supplierId": "PEGA_AQUI_SUPPLIER_ID",
  "purchaseOrderId": "PEGA_AQUI_PURCHASE_ORDER_ID",
  "invoiceNumber": "FAC-2026-001",
  "invoiceDate": "2026-02-03T00:00:00.000Z",
  "dueDate": "2026-02-18T00:00:00.000Z",
  "subtotal": 15000,
  "taxTotal": 2850,
  "discountTotal": 0,
  "notes": "Factura asociada al pedido"
}
```

Guarda `supplierInvoiceId` (campo `id`).

---

## 7) Registrar Pagos (parcial y total)

### Pago parcial
Endpoint: **`POST /supplier-invoices/{supplierInvoiceId}/payments`**

```json
{
  "amount": 5000,
  "paymentMethod": "TRANSFER",
  "reference": "TRF-20260210-001",
  "notes": "Pago parcial"
}
```

La factura queda en `PARTIALLY_PAID`.

### Pago final

```json
{
  "amount": 12850,
  "paymentMethod": "CASH",
  "notes": "Pago final"
}
```

La factura queda en `PAID`.

---

## 8) Ver cuentas por pagar (pendientes / vencidas)

### Pendientes + vencidas (ordenadas por `dueDate`)
Endpoint: **`GET /supplier-invoices/pending`**

Devuelve además:
- `remainingAmount`
- `daysUntilDue`
- `isOverdue`

### Listado con filtros
Endpoint: **`GET /supplier-invoices?status=PENDING&supplierId=...`**

Estados posibles:
- `PENDING`
- `PARTIALLY_PAID`
- `PAID`
- `OVERDUE`
- `CANCELLED`

