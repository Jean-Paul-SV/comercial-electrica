# Validaciones de negocio

> Resumen de las validaciones críticas implementadas en el backend (API) para consistencia de datos y cumplimiento operativo.

---

## 1. Caja (Cash)

| Regla | Dónde | Mensaje al usuario |
|-------|--------|---------------------|
| No cerrar sesión si ya está cerrada | `CashService.closeSession` | "La sesión de caja ya está cerrada." |
| No cerrar sesión con ventas pendientes de facturar | `CashService.closeSession` | "No se puede cerrar la sesión. Hay N venta(s) pendiente(s) de facturar. Factúrelas o anúlelas antes de cerrar la caja." |
| Monto de cierre dentro de límites configurados | `CashLimitsService.validateCashAmount` | Según configuración (movimiento/caja). |
| Solo una sesión abierta por tenant (recomendado) | Detectado en reportes operativos | Alerta "Múltiples cajas abiertas". |

**Tests:** `apps/api/src/cash/cash.service.spec.ts` (cierre con ventas pendientes, sesión ya cerrada).

---

## 2. Ventas (Sales)

| Regla | Dónde | Mensaje al usuario |
|-------|--------|---------------------|
| Items requeridos (al menos uno) | `SalesService.createSale` | "Debe incluir items." |
| Límite de ítems por venta | `CashLimitsService.validateItemsCount` | Según configuración. |
| Cantidad por ítem válida | `CashLimitsService.validateItemQty` | Según configuración. |
| Sesión de caja requerida y abierta | `SalesService.createSale` | "cashSessionId requerido para registrar caja." / "Sesión de caja no encontrada." / "La sesión de caja está cerrada." |
| Cliente (si se envía) debe existir y pertenecer al tenant | `SalesService.createSale` | "Cliente con id X no encontrado." |
| Productos existen, activos y del tenant | `SalesService.createSale` (transacción) | "Uno o más productos no existen o están inactivos." |
| Stock suficiente por producto | `SalesService.createSale` (transacción) | "Stock insuficiente para \"{nombre}\". Disponible: N, requerido: M." |

---

## 3. Gastos (Expenses)

| Regla | Dónde | Mensaje al usuario |
|-------|--------|---------------------|
| Fecha del gasto no puede ser futura | `ExpensesService.create` | "La fecha del gasto no puede ser futura." |
| Sesión de caja (si se envía) debe existir y estar abierta | `ExpensesService.create` | "Sesión de caja no encontrada." / "No se puede registrar el gasto en una sesión de caja cerrada." |
| Monto dentro de límites | `CashLimitsService.validateCashAmount` | Según configuración. |

---

## 4. Facturas proveedor (Supplier Invoices)

| Regla | Dónde | Mensaje al usuario |
|-------|--------|---------------------|
| Proveedor existe, activo y del tenant | `SupplierInvoicesService.createSupplierInvoice` | "Proveedor con id X no encontrado." / "El proveedor está inactivo." |
| Pedido de compra (si se envía) existe | `SupplierInvoicesService.createSupplierInvoice` | "Pedido de compra con id X no encontrado." |
| Fecha de vencimiento posterior a fecha de factura | `SupplierInvoicesService.createSupplierInvoice` | "La fecha de vencimiento debe ser posterior a la fecha de la factura." |
| Abono no mayor al total | `SupplierInvoicesService.createSupplierInvoice` | Mensaje indicando que el abono no puede superar el total. |

---

## 5. Proveedores (Suppliers)

| Regla | Dónde | Mensaje al usuario |
|-------|--------|---------------------|
| No eliminar si tiene movimientos de inventario | `SuppliersService.delete` (soft delete) | "No se puede eliminar el proveedor. Tiene N movimiento(s) de inventario asociado(s)." |
| NIT único por tenant | Prisma unique / catch P2002 | "Ya existe un proveedor con NIT X." |

---

## 6. Cotizaciones (Quotes)

| Regla | Dónde | Mensaje al usuario |
|-------|--------|---------------------|
| Convertir a venta: sesión de caja abierta y productos con stock | `QuotesService.convertQuoteToSale` | Según validación (sesión, stock). |
| Productos de la cotización deben existir y tener stock al convertir | Flujo de conversión | Mensajes específicos por producto/stock. |

---

## 7. Otros

- **Catálogo (productos/categorías):** tenant requerido; `internalCode` / `name` requeridos donde aplica.
- **Clientes:** tenant requerido; validación de tipo y número de documento según diseño.
- **Usuarios:** email único; contraseña según política; cambio obligatorio en primer login si se generó temporal.

---

## Referencia de código

- Límites configurables: `apps/api/src/common/services/cash-limits.service.ts`
- Validaciones de caja: `apps/api/src/cash/cash.service.ts`
- Validaciones de ventas: `apps/api/src/sales/sales.service.ts`
- Validaciones de gastos: `apps/api/src/expenses/expenses.service.ts`
- Validaciones de facturas proveedor: `apps/api/src/supplier-invoices/supplier-invoices.service.ts`

**Última actualización:** Febrero 2026
