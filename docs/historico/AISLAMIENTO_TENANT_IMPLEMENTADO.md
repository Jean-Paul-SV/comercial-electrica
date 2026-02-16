# Aislamiento de datos por tenant (multi-empresa)

**Fecha:** 2026-02-02  
**Objetivo:** Que varias empresas (tenants) usen el mismo software con datos separados: cada empresa solo ve y modifica sus propios productos, clientes, ventas, etc.

---

## 1. Cambios en el modelo de datos (Prisma)

- **Tenant** ya existía; se añadieron relaciones con todas las entidades de negocio.
- Se añadió **`tenantId`** (obligatorio) a:
  - Category, Product, Customer, Supplier  
  - Sale, Quote, Invoice  
  - PurchaseOrder, SupplierInvoice  
  - CashSession, Expense  
  - InventoryMovement  
  - DianConfig, AuditLog (opcional en AuditLog), BackupRun
- Unicos por tenant (en lugar de globales):
  - Category: `(tenantId, name)`
  - Product: `(tenantId, internalCode)`
  - Customer: `(tenantId, docType, docNumber)`
  - Supplier: `(tenantId, nit)`
  - PurchaseOrder: `(tenantId, orderNumber)`
  - SupplierInvoice: `(tenantId, invoiceNumber)`
  - Invoice: `(tenantId, number)`
  - DianConfig: un registro por tenant (`tenantId` unique)

---

## 2. Migración

- **Carpeta:** `apps/api/prisma/migrations/20260202200000_add_tenant_to_business_data/`
- Crea el tenant `default` si no existe.
- Añade `tenantId` a todas las tablas indicadas y asigna los datos existentes al tenant `default`.
- Elimina unicos antiguos y crea unicos compuestos `(tenantId, ...)`.

**Aplicar:** desde `apps/api`: `npx prisma migrate deploy` (o `migrate dev` en desarrollo).

---

## 3. JWT y contexto de tenant

- **JwtPayload** incluye `tenantId` (opcional). En login se rellena con el tenant del usuario o el tenant por defecto.
- **TenantContextInterceptor:** si el usuario está autenticado y el JWT no trae `tenantId` (tokens antiguos), resuelve el tenant efectivo y lo asigna a `req.user.tenantId`.
- **TenantModulesService:** `getDefaultTenantId()` y `getEffectiveTenantId(userId)` para obtener el tenant por defecto o el del usuario.

---

## 4. Servicios y controladores actualizados (tenantId en list/get/create/update/delete)

| Módulo        | Servicio        | Controlador        | Estado   |
|---------------|-----------------|--------------------|----------|
| Catalog       | CatalogService  | CatalogController  | Hecho    |
| Customers     | CustomersService| CustomersController| Hecho    |
| Sales         | SalesService    | SalesController    | Hecho    |
| Cash          | CashService     | CashController, CashMovementsController | Hecho |
| Suppliers     | SuppliersService| SuppliersController| Hecho    |
| Expenses      | ExpensesService | ExpensesController | Hecho    |
| Quotes        | QuotesService   | QuotesController   | Hecho    |
| Inventory     | InventoryService| InventoryController| Hecho    |
| Purchases     | PurchasesService| PurchasesController| Hecho    |
| SupplierInvoices | SupplierInvoicesService | SupplierInvoicesController | Hecho    |
| Reports       | ReportsService  | -                  | Pendiente (filtrar todas las consultas por tenantId del usuario) |
| Audit         | AuditService    | AuditController    | Pendiente (filtrar listado por tenantId; opcionalmente guardar tenantId en AuditLog) |
| Backups       | BackupsService  | BackupsController  | Pendiente (tenantId en create/list/delete) |
| Dian          | DianService/Config | -               | Pendiente (DianConfig por tenant; operaciones en contexto de tenant) |

---

## 5. Cómo completar los módulos pendientes

1. **Quotes, Inventory, Purchases, SupplierInvoices**  
   En cada método de servicio que liste, obtenga por id, cree o actualice:
   - Añadir parámetro `tenantId?: string | null`.
   - Si no hay tenantId, lanzar `ForbiddenException('Tenant requerido.')`.
   - En `findMany`/`findFirst`/`findUnique`: incluir `tenantId` en el `where`.
   - En `create`: incluir `tenantId` en `data`.
   - En Purchases, `generateOrderNumber` debe recibir `tenantId` y buscar el máximo `orderNumber` solo en ese tenant.
   - En SupplierInvoices, el único de número de factura debe ser por tenant: `findFirst({ where: { tenantId, invoiceNumber } })` antes de crear.
   - En los controladores, pasar `req.user?.tenantId` como último argumento a cada llamada al servicio.

2. **Reports**  
   En cada método que consulte ventas, clientes, proveedores, etc., obtener el `tenantId` del usuario (por ejemplo desde un parámetro inyectado o desde el request) y añadir en todas las consultas `where: { tenantId }` (o el equivalente en joins).

3. **Audit**  
   - Al listar logs, filtrar por `tenantId` si el usuario tiene tenant.
   - Opcional: al crear entradas de AuditLog, guardar `tenantId` del usuario para filtros y reportes.

4. **Backups**  
   - Al crear un backup, asociarlo al `tenantId` del usuario.
   - Al listar/eliminar, filtrar por `tenantId`.

5. **Dian**  
   - DianConfig ya tiene `tenantId`; leer/crear/actualizar config por tenant.
   - Emisión y consulta de documentos en contexto del tenant (facturas/invoices del tenant).

---

## 6. Seed

- El seed actual crea el tenant `default` y asigna usuarios. No crea categorías ni productos; la migración asigna los datos existentes al tenant `default`.
- Si en el futuro el seed crea categorías/productos, debe usar el `tenantId` del tenant por defecto.

---

## 7. Resumen

- **Varias personas:** ya soportado (usuarios, roles, permisos).
- **Varias empresas con datos separados:** modelo y migración listos; JWT e interceptor de tenant listos; catalog, customers, sales, cash, suppliers y expenses ya filtran y asignan `tenantId`. Quedan por adaptar quotes, inventory, purchases, supplier-invoices, reports, audit, backups y dian siguiendo el mismo patrón (filtrar por `tenantId` y asignar `tenantId` en creates).
