# Planes y limitación de acceso

Los planes que definimos **limitan el acceso** a ciertas secciones de la app según los módulos incluidos en cada plan. Esto ya está implementado en backend y frontend.

---

## Resumen por plan

| Plan | Módulos | Qué puede usar el cliente |
|------|---------|---------------------------|
| **Básico sin DIAN** | core, inventory | Dashboard, Ventas, Facturas, Devoluciones, Caja, Gastos, Cotizaciones, Productos, Clientes, **Inventario**, Cuenta (Plan, Soporte), Usuarios. **Sin** Reportes, **sin** Compras/Proveedores, **sin** facturación electrónica DIAN, **sin** Auditoría, **sin** Backups. |
| **Premium sin DIAN** | core, inventory, advanced_reports | Todo lo anterior **+ Reportes**. |
| **Básico con DIAN** | core, inventory, electronic_invoicing | Como Básico sin DIAN **+ Facturación electrónica (DIAN)**. Sin Reportes, sin Compras. |
| **Premium con DIAN** | core, inventory, suppliers, electronic_invoicing, advanced_reports | Todo lo anterior **+ Reportes + Compras y proveedores**. |
| **Enterprise** | core, inventory, suppliers, electronic_invoicing, advanced_reports, audit, backups | **Todo**: Reportes, DIAN, Compras, **Auditoría**, **Backups**. |

- **core**: operaciones (ventas, facturas, caja, gastos, cotizaciones), catálogo (productos, clientes), cuenta (plan, soporte), usuarios.
- **inventory**: Inventario.
- **advanced_reports**: Reportes.
- **suppliers**: Compras, Proveedores, Facturas proveedor.
- **electronic_invoicing**: Configuración DIAN y emisión de facturas electrónicas.
- **audit**: Auditoría.
- **backups**: Backups.

---

## Cómo se aplica la limitación

### Backend (API)

- Cada controlador que depende de un módulo usa `@RequireModule('codigo')` y `ModulesGuard`.
- Si el tenant del usuario **no tiene** ese módulo en su plan, la API responde **403** con el mensaje: *"Módulo no contratado. Contacte a su administrador o mejore su plan."*

Rutas protegidas por módulo:

- **advanced_reports** → Reportes
- **electronic_invoicing** → DIAN (config y emisión)
- **inventory** → Inventario
- **suppliers** → Proveedores, Compras, Facturas proveedor
- **audit** → Auditoría
- **backups** → Backups

### Frontend (Web)

1. **Navegación (menú)**  
   El menú lateral solo muestra las secciones/ítems cuyo `moduleCode` está en `enabledModules` (que viene de `getMe` → plan del tenant). Si el plan no incluye Reportes, el ítem "Reportes" no aparece.

2. **Rutas**  
   Si el usuario intenta entrar por URL a una ruta que requiere un módulo que no tiene (ej. `/reports` sin `advanced_reports`), el layout lo redirige a **`/plan-required?module=advanced_reports`**, donde se muestra el mensaje de que esa función no está incluida en su plan.

3. **Datos**  
   Las llamadas a la API que corresponden a un módulo no contratado reciben 403, así que la app no puede cargar esos datos aunque se intente por URL.

---

## Origen de los módulos por plan

- Los planes se crean/actualizan en el **seed** (`apps/api/prisma/seed.ts`) con un array `moduleCodes` por plan.
- Esos códigos se guardan en **PlanFeature** (tabla `PlanFeature`, relación Plan → PlanFeature).
- El **Tenant** tiene un **Plan** asignado; **TenantModulesService.getEnabledModules(tenantId)** devuelve la lista de módulos del plan del tenant.
- Esa lista se expone en **GET /auth/me** como `tenant.enabledModules` y el frontend la usa para filtrar menú y proteger rutas.

Para cambiar qué incluye cada plan, se edita el seed (array `standardPlans`) y se vuelve a ejecutar el seed; o se gestiona desde el Panel proveedor (editar plan y sus módulos, si la app lo permite).

---

## Si el usuario no tiene DIAN y quiere activarlo

Cuando un usuario **sin** facturación electrónica (DIAN) intenta acceder a esa función (p. ej. configuración DIAN o emisión a la DIAN):

1. La app lo lleva a la página **"Módulo no incluido en tu plan"** (`/plan-required?module=electronic_invoicing`).
2. Ahí se indica que para usar DIAN debe **cambiar a un plan que la incluya** (Básico con DIAN, Premium con DIAN o Enterprise).
3. El botón **"Cambiar de plan"** abre **Cuenta → Plan** (`/settings/billing`), donde puede elegir otro plan con precios mensual y anual. Al cambiar a un plan con DIAN, el módulo queda activo y podrá configurar certificado y emitir facturas electrónicas.

No hay "activar DIAN" sin cambiar de plan: la posibilidad de usarlo viene incluida en los planes que tienen el módulo `electronic_invoicing`.

---

## Plan "con DIAN" vs tener configuración activa

Para evitar confusión:

- **Plan con DIAN** = el plan **incluye** el módulo de facturación electrónica: el cliente puede entrar a la sección Facturación electrónica.
- **Emitir a la DIAN** requiere además **contratar el servicio de configuración** (certificado, Software ID, resolución, datos ante la DIAN), que el proveedor cobra por separado. Hasta que la configuración esté hecha, no se pueden enviar facturas electrónicas a la DIAN (sí se pueden usar documentos internos).

En la app se aclara esto en:
- **Cuenta → Plan**: se indica que los planes "con DIAN" dan acceso y que para emitir hay que contratar el servicio de configuración y contactar al proveedor.
- **Facturación electrónica**: mensaje indicando que el plan incluye la función y que para enviar a la DIAN hay que contratar el servicio de configuración.

---

## Resumen

- **Sí**: el acceso se limita en base a los planes tal como los vinimos trabajando.
- **Backend**: 403 en endpoints de Reportes, DIAN, Inventario, Compras, Auditoría, Backups si el plan del tenant no incluye el módulo.
- **Frontend**: menú filtrado por módulos y redirección a "Plan requerido" si se accede por URL a una función no incluida.
- **Activar DIAN**: el cliente debe cambiar de plan a uno que incluya DIAN desde Cuenta → Plan.
