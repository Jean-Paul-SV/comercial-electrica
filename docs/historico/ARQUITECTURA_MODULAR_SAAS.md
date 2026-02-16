# Arquitectura modular para SaaS escalable

**Autor:** Product Architect – SaaS escalables  
**Objetivo:** Que el sistema sea **modular a nivel de negocio**, no solo de interfaz: activar o desactivar módulos por cliente y preparar el sistema para **planes y franquicias**.  
**Contexto:** Crecimiento y monetización; módulos ejemplo: Inventario, Proveedores, Facturación electrónica, Reportes avanzados.

---

## 1. Diseño de arquitectura modular

### 1.1 Principio

Un **módulo de negocio** es una unidad funcional que se puede **activar o desactivar por cliente (tenant)**. No es solo ocultar menús: el backend debe rechazar el uso de funcionalidad no contratada; el frontend debe ocultar rutas y acciones; el modelo de precios asocia módulos a planes y add-ons.

### 1.2 Capas

| Capa | Descripción |
|------|-------------|
| **Catálogo de módulos** | Lista fija de módulos del producto (inventory, suppliers, electronic_invoicing, advanced_reports, …). Cada uno se mapea a rutas backend y a secciones/ítems del frontend. |
| **Plan** | Conjunto de módulos incluidos (ej. Plan Básico: ventas, caja, catálogo, clientes; Plan Pro: + inventario, reportes; Plan Enterprise: todo + DIAN, reportes avanzados, auditoría). |
| **Tenant (cliente)** | Organización que usa el sistema. Tiene un **plan** (o ninguno) y opcionalmente **add-ons** (módulos extra). La unión plan + add-ons define los **módulos habilitados** del tenant. |
| **Override por tenant** | Opcional: desactivar un módulo incluido en el plan (ej. “no quiero inventario aún”) o activar uno de forma temporal (cortesía). Se guarda en TenantModule o en un JSON de features. |

### 1.3 Catálogo de módulos (ejemplo)

Alineado con tu aplicación actual:

| Código módulo | Nombre producto | Backend (NestJS) | Frontend (rutas / secciones) | Monetización típica |
|---------------|------------------|------------------|--------------------------------|---------------------|
| **core** | Núcleo | Auth, Catalog, Customers, Cash, Sales, Returns, Quotes, Expenses | Dashboard, Ventas, Devoluciones, Caja, Gastos, Cotizaciones, Productos, Clientes | Incluido en todos los planes |
| **inventory** | Inventario | InventoryModule | /inventory, sección Inventario | Plan Pro / add-on |
| **suppliers** | Proveedores y compras | SuppliersModule, PurchasesModule, SupplierInvoicesModule | /suppliers, /purchases, /supplier-invoices, sección Compras | Plan Pro / add-on |
| **electronic_invoicing** | Facturación electrónica (DIAN) | DianModule | Config DIAN, emisión FE/NC/ND | Plan Enterprise / add-on |
| **advanced_reports** | Reportes avanzados | ReportsModule (subset o variante) | /reports (completo), exportaciones, KPIs avanzados | Plan Pro/Enterprise / add-on |
| **audit** | Auditoría | AuditModule | /audit | Plan Enterprise / add-on |
| **backups** | Backups y exportación | BackupsModule | Gestión backups, descarga | Plan Pro/Enterprise |

**Core** puede ser un “meta-módulo” que siempre está activo; el resto son opcionales y se activan por plan o add-on.

### 1.4 Modelo de datos sugerido

```
Plan (id, name, slug, description, price?, billingInterval?)
  └── PlanFeature (planId, moduleCode)  // módulos incluidos en el plan

Tenant (id, name, slug, planId?, ...)
  └── TenantModule (tenantId, moduleCode, enabled: boolean)  // override: si no existe, se usa el plan

AddOn (id, moduleCode, name, price?, ...)  // módulos que se compran aparte
  └── TenantAddOn (tenantId, addOnId, validUntil?)  // add-on contratado por el tenant
```

**Cálculo de “módulos habilitados” para un tenant:**

1. Módulos del plan del tenant (PlanFeature donde planId = tenant.planId).  
2. Más módulos de add-ons activos (TenantAddOn donde tenantId y validUntil ≥ hoy).  
3. Menos los que tengan override desactivado (TenantModule donde tenantId y enabled = false).  
4. Más los que tengan override activado (TenantModule donde enabled = true), por si el plan no los incluye pero se dan por cortesía.

Resultado: conjunto de `moduleCode` que el tenant puede usar. Se puede cachear por tenant (Redis, TTL corto) y invalidar al cambiar plan o TenantModule.

### 1.5 Esquema Prisma (extracto)

```prisma
model Plan {
  id              String   @id @default(uuid()) @db.Uuid
  name            String   // "Básico", "Pro", "Enterprise"
  slug            String   @unique
  description     String?
  priceMonthly   Decimal? @db.Decimal(10, 2)
  priceYearly    Decimal? @db.Decimal(10, 2)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  features PlanFeature[]
  tenants  Tenant[]
}

model PlanFeature {
  id          String   @id @default(uuid()) @db.Uuid
  planId      String   @db.Uuid
  moduleCode  String   // "inventory", "suppliers", "electronic_invoicing", ...
  createdAt   DateTime @default(now())

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, moduleCode])
  @@index([moduleCode])
}

model Tenant {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  slug      String   @unique
  planId    String?  @db.Uuid
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  plan        Plan?         @relation(fields: [planId], references: [id], onDelete: SetNull)
  modules     TenantModule[]
  addOns      TenantAddOn[]
  users       User[]
  // ... resto de relaciones
}

model TenantModule {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  moduleCode  String
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, moduleCode])
  @@index([tenantId])
  @@index([moduleCode])
}

model AddOn {
  id          String   @id @default(uuid()) @db.Uuid
  moduleCode  String   @unique
  name        String
  description String?
  priceMonthly Decimal? @db.Decimal(10, 2)
  priceYearly  Decimal? @db.Decimal(10, 2)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenantAddOns TenantAddOn[]
}

model TenantAddOn {
  id         String    @id @default(uuid()) @db.Uuid
  tenantId   String    @db.Uuid
  addOnId    String    @db.Uuid
  validFrom  DateTime  @default(now())
  validUntil DateTime?
  createdAt  DateTime  @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  addOn  AddOn  @relation(fields: [addOnId], references: [id], onDelete: Cascade)

  @@unique([tenantId, addOnId])
  @@index([tenantId])
  @@index([validUntil])
}
```

Si hoy no tienes Tenant, el primer paso es introducir Tenant y Plan con un “plan por defecto” que incluya todos los módulos (comportamiento actual); luego añadir PlanFeature y TenantModule.

---

## 2. Relación con modelo de precios

### 2.1 Planes sugeridos (ejemplo)

| Plan | Precio (ej.) | Módulos incluidos | Público |
|------|--------------|-------------------|--------|
| **Básico** | $X/mes | core (ventas, caja, catálogo, clientes, cotizaciones, gastos, devoluciones) | Pequeño comercio, un solo punto |
| **Pro** | $Y/mes | Básico + inventory + suppliers + reports (estándar) | Varios puntos, compras, inventario |
| **Enterprise** | $Z/mes | Pro + electronic_invoicing + advanced_reports + audit + backups | Facturación electrónica, auditoría, cumplimiento |

### 2.2 Add-ons

Módulos que se contratan aparte para cualquier plan:

| Add-on | Módulo | Precio (ej.) | Uso |
|--------|--------|--------------|-----|
| Inventario | inventory | $A/mes | Cliente Básico que solo quiere inventario |
| Proveedores | suppliers | $B/mes | Cliente Básico que solo quiere compras |
| Facturación electrónica | electronic_invoicing | $C/mes | Cliente Pro que necesita DIAN |
| Reportes avanzados | advanced_reports | $D/mes | Exportaciones, KPIs avanzados |

### 2.3 Franquicias

- **White-label:** Un franquiciador (tenant especial) puede crear “sub-tenants” (franquiciados) con un subconjunto de módulos y marca propia. Modelo: Tenant con `parentTenantId`; el plan o los módulos se heredan o se definen por franquiciado.  
- **Reseller:** Un partner puede dar de alta tenants con un plan; la facturación puede ser al partner (que factura al cliente) o directa con comisión. No cambia la arquitectura modular; solo quién paga y cómo se asigna el plan.  
- **Monetización:** Plan por franquiciado + margen del franquiciador; o comisión por tenant activo del reseller.

La **activación/desactivación por cliente** es la misma: cada tenant (o sub-tenant) tiene su conjunto de módulos habilitados (plan + add-ons + overrides).

---

## 3. Impacto en backend

### 3.1 Servicio de módulos habilitados

- **TenantModulesService** (o FeaturesService): método `getEnabledModules(tenantId: string): Promise<string[]>` que:
  1. Obtiene el plan del tenant y sus PlanFeature (módulos del plan).
  2. Obtiene TenantAddOn activos (validUntil ≥ hoy o null) y los moduleCode de sus AddOn.
  3. Aplica overrides TenantModule: si hay registro para (tenantId, moduleCode), usar `enabled`; si no, usar “incluido en plan o add-on”.
  4. Devuelve la lista de `moduleCode` habilitados.
- Cachear resultado por tenant (ej. Redis, clave `tenant:${tenantId}:modules`, TTL 5–15 min). Invalidar al actualizar plan, TenantModule o TenantAddOn.

### 3.2 Guard por módulo

- **ModulesGuard:** Guard de NestJS que:
  1. Obtiene el tenant del request (desde JWT, ej. `req.user.tenantId`, o desde header/subdominio).
  2. Si no hay tenant (single-tenant legacy), considerar todos los módulos habilitados.
  3. Obtiene los módulos habilitados (desde caché o TenantModulesService).
  4. Lee un decorador en el controlador o método, ej. `@RequireModule('inventory')` o `@RequireModule(['suppliers', 'purchases'])`.
  5. Si el módulo (o al menos uno si es array) no está habilitado, lanza **403 Forbidden** con mensaje tipo “Módulo no contratado”.
- Aplicar el guard a nivel de controlador o de ruta en los módulos opcionales (Inventory, Suppliers, Purchases, SupplierInvoices, Dian, Reports si se divide, Audit, Backups).

### 3.3 Mapeo ruta → módulo

Cada controlador (o conjunto de rutas) se asocia a un `moduleCode`:

| Controlador / prefijo | moduleCode |
|------------------------|------------|
| InventoryController | inventory |
| SuppliersController, PurchasesController, SupplierInvoicesController | suppliers (o suppliers, purchases, supplier_invoices por separado si quieres granularidad) |
| DianController | electronic_invoicing |
| ReportsController | reports o advanced_reports (si separas reportes básicos de avanzados) |
| AuditController | audit |
| BackupsController | backups |

Catálogo central (const o BD): `MODULE_ROUTES = { inventory: ['/inventory'], suppliers: ['/suppliers', '/purchases', '/supplier-invoices'], ... }`. El guard puede derivar el módulo desde la ruta o desde el decorador.

### 3.4 Respuesta “yo y mi tenant”

- **GET /auth/me** (o **GET /tenant/me**): Además de usuario y permisos, devolver **módulos habilitados** del tenant del usuario, ej.  
  `{ user: {...}, permissions: [...], tenant: { id, name, plan: { name, slug }, enabledModules: ["core", "inventory", "suppliers"] } }`.  
  El frontend usa `enabledModules` para mostrar/ocultar menú y rutas.

### 3.5 Single-tenant sin plan

- Si no hay Tenant ni Plan (modo actual): no aplicar ModulesGuard o considerar “todos los módulos habilitados” cuando `tenantId` sea null. Así no rompes el despliegue actual; cuando introduzcas Tenant, los clientes sin plan pueden tener un plan por defecto “Todo incluido”.

---

## 4. Impacto en frontend

### 4.1 Fuente de verdad de módulos

- Tras login (o al cargar sesión), el cliente obtiene **enabledModules** desde GET /auth/me (o /tenant/me).
- Guardar en contexto (AuthProvider o TenantProvider) junto al usuario y tenant. No depender de una lista hardcodeada en el frontend para “qué está contratado”; solo para “qué módulo corresponde a qué ítem de menú”.

### 4.2 Navegación

- **Config de navegación:** Cada ítem (o sección) tiene un `moduleCode` opcional, ej.  
  `{ id: 'inventory', href: '/inventory', label: 'Inventario', moduleCode: 'inventory' }`.  
  Si no tiene `moduleCode`, se considera siempre visible (core).
- **Filtro:** Además del filtro por rol, filtrar por módulo: mostrar ítem solo si `enabledModules.includes(item.moduleCode)` (o si no tiene moduleCode). Así se ocultan Inventario, Compras, DIAN, Reportes avanzados, etc. según el plan/add-ons del tenant.

### 4.3 Rutas protegidas

- **Guard de ruta (middleware o HOC):** En las rutas que corresponden a módulos opcionales (ej. /inventory, /suppliers, /reports), comprobar antes de renderizar: si el usuario no tiene el módulo habilitado, redirigir a “Plan” o a home con mensaje “Módulo no disponible en tu plan”.
- **Páginas “upsell”:** Si el usuario intenta acceder a /inventory sin el módulo, mostrar una página corta: “Inventario está disponible en Plan Pro. [Mejorar plan].” con enlace a cambio de plan o contacto comercial.

### 4.4 Mensajes y upsell

- Mensajes no técnicos: “Esta función no está incluida en tu plan actual” o “Activa el módulo de Inventario para usar esta sección.”  
- En el menú, opcional: ítems deshabilitados en gris con icono de candado y tooltip “Disponible en Plan Pro” (si quieres mostrar qué hay en planes superiores para incentivar upgrade).

---

## 5. Crecimiento y monetización

### 5.1 Crecimiento

- **Onboarding por plan:** Tras registro, el tenant elige plan (o se asigna uno por defecto). Solo se muestran módulos del plan; el resto se descubre en “Mejorar plan” o en emails de producto.
- **Trials:** Plan trial con módulos limitados (ej. solo core) o con todos los módulos por N días. Al vencer, se restringe a los módulos del plan elegido (o el plan por defecto).
- **Escalado por uso (opcional):** Además de módulos, límites por plan (ej. número de usuarios, de ventas/mes, de almacenamiento). Se puede combinar: “Plan Pro hasta 5 usuarios y módulos X, Y, Z”.

### 5.2 Monetización

- **Suscripción por plan:** Precio mensual/anual por plan; los módulos incluidos definen el valor percibido (Básico < Pro < Enterprise).
- **Add-ons:** Ingresos extra por módulo opcional (Inventario, DIAN, Reportes avanzados) sin cambiar de plan base.
- **Franquicias:** Ingresos por franquiciado (cada sub-tenant con su plan o margen) o por comisión de reseller.
- **Métricas:** Por tenant: plan, add-ons, fecha de alta, MRR. Por módulo: cuántos tenants tienen el módulo activo (para priorizar desarrollo y soporte).

### 5.3 Operación

- **Cambio de plan:** Flujo en app o en panel de administración: cambiar Tenant.planId; invalidar caché de módulos; el usuario ve nuevos ítems de menú (o deja de ver algunos) en la siguiente carga.
- **Activación de add-on:** Crear TenantAddOn con validUntil (o null si es indefinido); invalidar caché; habilitar módulo.
- **Override (cortesía o restricción):** Crear/actualizar TenantModule (enabled: true/false); invalidar caché. Útil para pruebas, promociones o restricciones temporales sin cambiar de plan.

---

## 6. Resumen de entregables

| Entregable | Contenido |
|------------|-----------|
| **Arquitectura modular** | Catálogo de módulos (core, inventory, suppliers, electronic_invoicing, advanced_reports, audit, backups); Plan + PlanFeature; Tenant + TenantModule + AddOn + TenantAddOn; cálculo de módulos habilitados por tenant; esquema Prisma. |
| **Impacto backend** | TenantModulesService + caché; ModulesGuard con @RequireModule; mapeo ruta → moduleCode; GET /auth/me con enabledModules; soporte single-tenant sin plan. |
| **Impacto frontend** | enabledModules en contexto; nav y rutas filtradas por moduleCode; guard de ruta para módulos opcionales; páginas upsell y mensajes “no incluido en tu plan”. |
| **Modelo de precios** | Planes (Básico, Pro, Enterprise) con módulos incluidos; add-ons por módulo; franquicias (white-label, reseller); trials y límites opcionales. |
| **Crecimiento y monetización** | Onboarding por plan; trials; cambio de plan y add-ons; métricas por tenant y por módulo; flujos de upgrade en la app. |

Con esto el sistema queda **modular a nivel de negocio**: activar o desactivar módulos por cliente, listo para planes y franquicias, con impacto claro en backend y frontend y relación directa con el modelo de precios y la monetización.
