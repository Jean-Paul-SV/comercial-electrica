# Diagrama de flujo: qué conectar y por qué

**Enfoque:** Arquitecto senior. Visión clara de capas, qué está unido frontend↔backend y qué falta conectar.

---

## 1. Flujo general (capas del sistema)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  USUARIO (navegador)                                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js – apps/web)                                                    │
│  • Páginas: app/(protected)/<recurso>/page.tsx                                    │
│  • Solo consumen hooks de features (no llaman apiClient directo)                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FEATURES (apps/web/src/features/<recurso>)                                        │
│  • hooks.ts  → useQuery / useMutation → api.ts                                    │
│  • api.ts    → apiClient.get|post|patch|delete(path, { authToken })               │
│  • types.ts → tipos alineados con la API                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  apiClient (infrastructure/api/client.ts)                                         │
│  • NEXT_PUBLIC_API_BASE_URL (ej. http://localhost:3000)                           │
│  • Authorization: Bearer <token>                                                  │
│  • Retry + timeout                                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  API (NestJS – apps/api)                                                          │
│  • Controladores: @Controller('recurso') → GET/POST/PATCH/DELETE                  │
│  • Servicios → Prisma                                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Prisma → PostgreSQL                                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Regla de conexión:**  
Cada pantalla que use datos de la API debe tener: **Feature (api + hooks)** → **Página** → **Entrada en el sidebar** (nav) si debe ser accesible desde el menú.

---

## 2. Matriz: Backend ↔ Feature ↔ Página ↔ Nav ↔ Estado

| Backend (API)     | Ruta base        | Feature (web)        | Página (protected)   | Item en sidebar           | Estado |
|-------------------|------------------|----------------------|----------------------|---------------------------|--------|
| AuthModule        | `/auth`          | `auth`               | login (public)       | —                         | ✅ Conectado |
| CatalogModule     | `/products`, `/categories` | `products`   | `/products`          | Sí, "Productos"           | ✅ Conectado |
| CustomersModule   | `/customers`     | `customers`          | `/customers`         | Sí, "Clientes"            | ✅ Conectado |
| SalesModule       | `/sales`         | `sales`              | `/sales`             | Sí, "Ventas"              | ✅ Conectado |
| ReturnsModule     | `/returns`       | `returns`            | `/returns`           | Sí, "Devoluciones"        | ✅ Conectado |
| CashModule        | `/cash`          | `cash`               | `/cash`              | Sí, "Caja"                | ✅ Conectado |
| ExpensesModule    | `/expenses`      | `expenses`           | `/expenses`          | Sí, "Gastos"              | ✅ Conectado |
| QuotesModule      | `/quotes`        | `quotes`             | `/quotes`            | Sí, "Cotizaciones"        | ✅ Conectado |
| InventoryModule   | `/inventory`     | `inventory`          | `/inventory`         | Sí, "Inventario"          | ✅ Conectado |
| SuppliersModule   | `/suppliers`     | `suppliers`          | `/suppliers`         | Sí, "Proveedores"         | ✅ Conectado |
| **PurchasesModule** | `/purchases`   | `purchases`          | `/purchases`         | **No**                    | ⚠️ Falta nav |
| SupplierInvoicesModule | `/supplier-invoices` | `supplier-invoices` | `/supplier-invoices` | Sí, "Facturas proveedor"  | ✅ Conectado |
| ReportsModule     | `/reports`       | `reports`            | `/reports`, `/app`   | Sí, "Reportes", "Dashboard" | ✅ Conectado |
| AuditModule       | `/audit-logs`    | `audit`              | `/audit`             | Sí, "Auditoría"           | ✅ Conectado |
| OnboardingModule  | `/onboarding`    | `onboarding`         | `/onboarding`        | (flujo post-login)        | ✅ Conectado |
| DianModule        | `/dian/documents/:id/status` | `dian`   | —                    | —                         | ⚠️ API conectada, UI no usa estado DIAN |
| **BackupsModule** | `/backups`       | **no existe**        | **no existe**        | —                         | ❌ Sin frontend |
| ReportsModule     | `/reports/export` | `reports`            | —                    | —                         | ⚠️ Export CSV en API, no en frontend |

---

## 3. Qué conectar y por qué

### 3.1 Compras (Purchases) en el menú — **Prioridad alta**

- **Qué:** La página `/purchases` y la feature `purchases` ya existen y están conectadas a la API.
- **Problema:** En `shared/navigation/config.ts` la sección "Compras" solo tiene "Proveedores" y "Facturas proveedor"; no hay ítem que apunte a `/purchases`.
- **Por qué conectar:** Sin enlace en el sidebar, el usuario no puede llegar a órdenes de compra desde la app.
- **Acción:** Añadir en la sección `compras` un ítem, por ejemplo:
  - `id: 'purchases', href: '/purchases', label: 'Compras', icon: 'ShoppingBag', order: 1`
  (y ajustar `order` de los demás ítems de la sección si hace falta).

---

### 3.2 Estado DIAN en la UI — **Prioridad media**

- **Qué:** La API expone `GET /dian/documents/:id/status`. En el frontend existe `features/dian` con `getDocumentStatus` y `useDianDocumentStatus`.
- **Problema:** Ninguna página usa ese hook (ventas, cotizaciones o facturas proveedor podrían mostrar estado del documento electrónico).
- **Por qué conectar:** Dar visibilidad del estado DIAN (ej. "Enviado", "Aceptado", "Rechazado") en el detalle de venta, cotización o factura.
- **Acción:** En la(s) pantalla(s) donde se muestre el detalle de una venta/cotización/factura con `dianDocumentId`, usar `useDianDocumentStatus(dianDocumentId)` y mostrar el estado (y opcionalmente refrescar o reintentar).

---

### 3.3 Exportar reportes (CSV) — **Prioridad media**

- **Qué:** La API tiene `GET /reports/export?entity=sales|customers&startDate&endDate&limit` y devuelve CSV.
- **Problema:** En `features/reports/api.ts` no hay función que llame a `/reports/export`; la página de reportes no ofrece descarga CSV.
- **Por qué conectar:** Respaldo o análisis offline de ventas/clientes.
- **Acción:**
  1. En `features/reports/api.ts`: añadir `exportReport(params, authToken)` que llame a `GET /reports/export?...` (la respuesta es blob/CSV; manejar como blob y devolver URL o descarga).
  2. En `features/reports/hooks.ts`: hook que use esa función (o llamada directa desde botón "Exportar").
  3. En la página de reportes: botón "Exportar CSV" que use el hook y dispare la descarga.

---

### 3.4 Backups — **Prioridad baja (opcional)**

- **Qué:** La API tiene CRUD de backups: `POST/GET /backups`, `GET /backups/:id`, `GET /backups/:id/download`, etc.
- **Problema:** No hay feature ni página en el frontend para listar backups, crear uno o descargar.
- **Por qué conectar:** Si quieres que el usuario gestione backups desde la app (crear, listar, descargar).
- **Acción:** Seguir el mismo patrón que otros recursos:
  1. `features/backups/` con `types.ts`, `api.ts`, `hooks.ts`.
  2. Página `(protected)/backups/page.tsx` (listado + acciones).
  3. Entrada en el sidebar (ej. en Análisis o en una sección "Sistema") y protección por rol/permiso si aplica.

---

## 4. Resumen visual: conexiones

```
                    NAV (config.ts)
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    [Productos]     [Ventas]      [Compras]  ← falta ítem "Compras"
         │               │               │
         ▼               ▼               ▼
    products         sales          purchases
    page.tsx         page.tsx       page.tsx
         │               │               │
         ▼               ▼               ▼
    features/        features/       features/
    products         sales           purchases
         │               │               │
         └───────────────┼───────────────┘
                         ▼
                  apiClient (token)
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │  API NestJS                             │
    │  catalog  sales  purchases  reports …   │
    │  /reports/export  /dian/...  /backups   │
    └────────────────────────────────────────┘
```

---

## 5. Orden sugerido de trabajo

1. **Nav Compras** — Añadir ítem "Compras" en `config.ts` (rápido, alto impacto).
2. **Export reportes** — Añadir `exportReport` en reports y botón "Exportar CSV" en la página de reportes.
3. **Estado DIAN** — Integrar `useDianDocumentStatus` en detalle de venta/cotización/factura donde exista `dianDocumentId`.
4. **Backups** — Solo si se desea gestión de backups desde la UI: feature + página + nav.

Con esto tienes claro **qué** está conectado, **qué** falta y **por qué** conviene conectar cada parte.
