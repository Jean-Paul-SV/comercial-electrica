# Seed 500 datos reales (Orion)

Seed con **datos realistas** de ferretería eléctrica en Colombia, compatible con el esquema actual (multi-tenant). Genera **más de 500 registros** entre categorías, productos, clientes, proveedores, ventas, cotizaciones, etc.

---

## Uso rápido

Desde la raíz del proyecto:

```powershell
# Limpiar datos de negocio y cargar 500+ datos reales
npm run db:seed:500
```

Requisitos previos: **PostgreSQL y Redis** levantados (`npm run db:up`), **migraciones aplicadas** (`npm run prisma:migrate`). Opcional: ejecutar antes `npm run prisma:seed` para roles/permisos RBAC.

---

## Qué genera

| Entidad            | Cantidad | Descripción |
|--------------------|----------|-------------|
| Plan + Tenant      | 1        | Si no existen (Todo incluido, Negocio principal) |
| Usuarios           | 2        | admin@example.com, vendedor@example.com (con tenantId) |
| Categorías         | 15       | Cables y Conductores, Breakers, Iluminación LED, etc. |
| Productos          | 60       | Nombres reales (Cable THW 12 AWG, Breaker 2P 20A, Bombillo LED, etc.) |
| StockBalance       | 60       | Uno por producto |
| Clientes           | 80       | Mix CC/NIT/CE, nombres tipo empresa y persona, ciudades Colombia |
| Proveedores        | 50       | NIT, nombres tipo distribuidora eléctrica |
| Sesiones de caja   | 30       | Última abierta |
| Gastos             | 40       | Categorías: arriendo, servicios, transporte, etc. |
| Pedidos de compra  | 30       | Con 1-2 ítems cada uno |
| Facturas proveedor | 35       | PENDING / PARTIALLY_PAID / PAID |
| Mov. inventario    | 50       | IN, OUT, ADJUST |
| Ventas             | 60       | Con ítems, factura y movimiento de caja |
| Cotizaciones       | 50       | DRAFT, SENT, EXPIRED, CONVERTED, CANCELLED |

**Total aproximado:** más de 500 registros principales (sin contar ítems de venta, cotización, pedido, etc.).

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run db:seed:500` | **Recomendado.** Limpia datos de negocio del tenant por defecto y carga 500+ datos reales. |
| `node scripts/seed-500-real.js --clean` | Igual que lo anterior. |
| `node scripts/seed-500-real.js` | Intenta añadir datos sin borrar (puede fallar si ya existen productos/clientes con mismos códigos). |
| `node scripts/seed-500-real.js --force` | Permite ejecutar aunque `DATABASE_URL` no sea local (usar con cuidado). |

---

## Credenciales después del seed

| Rol              | Email                 | Contraseña     | Creado por        |
|------------------|-----------------------|----------------|-------------------|
| Admin (tenant)    | admin@example.com     | Admin123!      | seed-500 o seed-dev |
| Usuario (tenant) | vendedor@example.com  | User123!       | seed-500 o seed-dev |
| **Platform admin** | platform@admin.local | PlatformAdmin1! | **prisma:seed** solo |

**Panel proveedor (pruebas):** En entornos de prueba, el correo **platform@admin.local** es el que debe tener acceso al **Panel proveedor** (gestión de empresas/tenants, planes, filtros Activas/Suspendidas). Tras el login, la app redirige a este usuario a `/provider`. Para producción, usa `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` en el seed para crear tu cuenta como dueño.

---

## Orden recomendado (inicializar todo)

1. `npm install`
2. `copy env.example .env`
3. Docker Desktop en marcha → `npm run db:up`
4. `npm run prisma:generate`
5. `npm run prisma:migrate`
6. `npm run prisma:seed` (roles y permisos RBAC)
7. **`npm run db:seed:500`** (500 datos reales)
8. `npm run dev`

---

## Datos reales incluidos

- **Categorías:** Cables y Conductores, Breakers y Protección, Iluminación LED, Herrajes, Tubos y Canaletas, Conectores, Transformadores, Interruptores y Tomas, etc.
- **Productos:** códigos y nombres de ferretería eléctrica (Cable THW, Breaker termomagnético, Bombillo LED, Tubo PVC, Canaleta, Toma doble, Cinta aislante, etc.) con costos y precios en COP.
- **Clientes:** nombres tipo empresa (Construcciones El Roble S.A.S., Electricidad del Valle) y persona (Carlos Andrés Rodríguez), documentos CC/NIT/CE, ciudades (Bogotá 11001, Medellín 05001, Cali 76001, etc.).
- **Proveedores:** NIT, nombres tipo Distribuidora Eléctrica Andina, Cables Colombia, etc., con ciudad y contacto.

---

**Última actualización:** Febrero 2026
