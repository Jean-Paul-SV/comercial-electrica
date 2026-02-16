# Cómo conectar los endpoints (Frontend ↔ API)

Esta guía explica el patrón que usa el proyecto para conectar el frontend (Next.js) con la API (NestJS) y cómo añadir nuevos endpoints.

---

## 1. Configuración base

- **URL de la API:** El frontend usa `NEXT_PUBLIC_API_BASE_URL` o por defecto `http://localhost:3000`.
- **Cliente HTTP:** `apps/web/src/infrastructure/api/client.ts` — `apiClient` con `get`, `post`, `patch`, `delete`. Todas las llamadas pasan `authToken` para endpoints protegidos.
- **Token:** Se guarda en `AuthProvider` tras el login; se obtiene con `useAuth().token`.

Crea en la raíz del proyecto (o en `apps/web`) un `.env.local` si quieres otra URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

## 2. Patrón por feature (recomendado)

Cada recurso (productos, clientes, ventas, etc.) tiene su propia carpeta en `src/features/<recurso>/`:

| Archivo   | Uso |
|----------|------|
| `types.ts` | Tipos TypeScript que coinciden con la respuesta de la API (listas, detalle, payloads). |
| `api.ts`   | Funciones que llaman a `apiClient.get/post/patch/delete` con la ruta y `authToken`. |
| `hooks.ts` | Hooks de React Query (`useQuery`, `useMutation`) que usan `useAuth().token` y llaman a las funciones de `api.ts`. |

Las páginas usan solo los **hooks**; no llaman a `apiClient` ni a `api.ts` directamente (salvo casos puntuales).

---

## 3. Ejemplo: listar productos

**`features/products/api.ts`**

```ts
import { apiClient } from '@infrastructure/api/client';

export function listProducts(params: { page?: number; limit?: number }, authToken: string) {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiClient.get(`/products${query}`, { authToken });
}
```

**`features/products/hooks.ts`**

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { listProducts } from './api';
import { useAuth } from '@shared/providers/AuthProvider';

export function useProductsList(params: { page?: number; limit?: number }) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['products', 'list', params],
    enabled: Boolean(token),
    queryFn: () => listProducts(params, token!),
  });
}
```

**En la página**

```tsx
const query = useProductsList({ page: 1, limit: 20 });
const rows = query.data?.data ?? [];
// query.isLoading, query.isError, query.error
```

---

## 4. Endpoints de la API (referencia)

Rutas base (sin prefijo global; la API escucha en `http://localhost:3000`).

| Módulo   | Rutas | Métodos |
|----------|--------|--------|
| **Auth** | `/auth/login`, `/auth/bootstrap-admin`, `/auth/users` | POST |
| **Catálogo** | `/products`, `/products/:id`, `/categories` | GET, POST, PATCH, DELETE (products); GET, POST (categories) |
| **Clientes** | `/customers`, `/customers/:id` | GET, POST, PATCH |
| **Inventario** | `/inventory/movements` | GET, POST |
| **Caja** | `/cash/sessions`, `/cash/sessions/:id/close`, `/cash/sessions/:id/movements` | GET, POST |
| **Ventas** | `/sales`, `/sales/:id` | GET, POST |
| **Cotizaciones** | `/quotes`, `/quotes/:id`, `/quotes/:id/convert`, `/quotes/:id/status` | GET, POST, PATCH |
| **Reportes** | `/reports/sales`, `/reports/inventory`, `/reports/cash`, `/reports/customers` | GET (con query params) |
| **Proveedores** | `/suppliers`, `/suppliers/:id` | GET, POST, PATCH |
| **Compras** | `/purchases`, `/purchases/:id`, `/purchases/:id/receive` | GET, POST, PATCH |
| **Facturas proveedor** | `/supplier-invoices`, `/supplier-invoices/:id`, `/supplier-invoices/:id/payments` | GET, POST, PATCH |
| **DIAN** | `/dian/documents/:id/status` | GET |
| **Backups** | `/backups`, `/backups/:id`, etc. | GET, POST |
| **Auditoría** | `/audit-logs` | GET |

Todas estas rutas (excepto `/auth/login` y `/auth/bootstrap-admin`) requieren cabecera:

```
Authorization: Bearer <token>
```

---

## 5. Qué está conectado ya

| Recurso    | Feature | Página | Estado |
|------------|---------|--------|--------|
| Login      | `features/auth` | `(public)/login` | Conectado + bootstrapAdmin, registerUser |
| Ventas     | `features/sales` | `(protected)/sales` | Listado paginado + createSale (api/hooks) |
| Productos  | `features/products` | `(protected)/products` | Listado + CRUD + categorías (listCategories, createCategory) |
| Clientes   | `features/customers` | `(protected)/customers` | Listado paginado + CRUD (api/hooks) |
| Caja       | `features/cash` | `(protected)/cash` | Sesiones + abrir/cerrar + movimientos (api/hooks) |
| Reportes   | `features/reports` | `(protected)/reports` | Dashboard, ventas, inventario, caja, clientes (api/hooks) |
| Cotizaciones | `features/quotes` | `(protected)/quotes` | Listado + CRUD + convert + status (api/hooks) |
| Inventario | `features/inventory` | `(protected)/inventory` | Listado movimientos + createMovement (api/hooks) |
| Proveedores | `features/suppliers` | `(protected)/suppliers` | Listado paginado + CRUD (api/hooks) |
| Compras   | `features/purchases` | `(protected)/purchases` | Listado + create + receive (api/hooks) |
| Facturas proveedor | `features/supplier-invoices` | `(protected)/supplier-invoices` | Listado + pending + create + payments (api/hooks) |
| DIAN      | `features/dian` | — | getDocumentStatus (api/hooks) |
| Dashboard | `features/reports` (useDashboard) | `(protected)/app` | KPIs desde GET /reports/dashboard |

Para añadir nuevas pantallas o endpoints, repite el mismo patrón:

1. Crear `features/<recurso>/types.ts`, `api.ts`, `hooks.ts`.
2. En `api.ts` usar `apiClient.get/post/patch/delete` con la ruta y `authToken`.
3. En `hooks.ts` usar `useAuth().token` y `useQuery`/`useMutation` con `queryKey` coherente.
4. En la página usar solo los hooks.

---

## 6. Errores y CORS

- Si la API devuelve 4xx/5xx, `apiClient` lanza un objeto con `status` y `message`; en los hooks eso llega como `error` en `isError`.
- Si hay errores de CORS, en desarrollo la API ya permite el origen del frontend; en producción configura `ALLOWED_ORIGINS` en el backend.

Para más detalle de cada endpoint (query params, body, respuestas), usa **Swagger:** `http://localhost:3000/api/docs` con el token en Authorize.
