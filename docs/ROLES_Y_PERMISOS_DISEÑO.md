# Diseño: Sistema de Roles y Permisos (RBAC)

**Autor:** Senior Backend Architect + Security Engineer  
**Contexto:** Aplicación de gestión comercial ERP/SaaS, multi-tenant, módulos: ventas, caja, inventario, clientes, proveedores, reportes.  
**Objetivo:** Roles desacoplados de permisos, permisos a nivel de acción, validación backend + frontend, escalable y reutilizable en múltiples negocios.

---

## 1. Modelo conceptual

### 1.1 Principios

| Principio | Descripción |
|----------|-------------|
| **Roles desacoplados de permisos** | Un rol es un nombre (ej. "Cajero", "Vendedor"); los permisos se asignan al rol, no al usuario. Así se cambia qué puede hacer un rol sin tocar usuarios. |
| **Permisos por recurso + acción** | Cada permiso = `recurso:acción` (ej. `sales:create`, `inventory:read`). Recursos = módulos; acciones = create, read, update, delete, manage. |
| **Una fuente de verdad** | Los permisos se definen y validan en backend. El frontend los consume para ocultar/deshabilitar UI; nunca confiar solo en el frontend para autorización. |
| **Multi-tenant opcional** | Entidad `Tenant` (negocio). Usuarios y roles pueden ser globales o por tenant. Permite mismo código para un negocio o para muchos. |

### 1.2 Entidades conceptuales

```
┌─────────────┐     ┌──────────────────┐     ┌────────────┐
│   Tenant    │────<│      User        │>────│ UserRole   │
│ (negocio)   │     │ (usuario)        │     │ (asignación│
└─────────────┘     └──────────────────┘     │  user-rol)│
       │                      │               └─────┬──────┘
       │                      │                    │
       │             ┌────────┴────────┐           │
       └────────────>│      Role        │<──────────┘
                     │ (Cajero, etc.)   │
                     └────────┬─────────┘
                              │
                     ┌────────┴─────────┐
                     │  RolePermission   │
                     │ (rol + permiso)   │
                     └────────┬─────────┘
                              │
                     ┌────────┴─────────┐
                     │   Permission     │
                     │ (recurso:accion) │
                     └─────────────────┘
```

- **Tenant**: Negocio/organización. Opcional para modo single-tenant.
- **User**: Usuario del sistema. Puede tener `tenantId` y uno o más roles (vía UserRole).
- **Role**: Nombre lógico (Admin, Cajero, Vendedor, Contador). Puede ser global o por tenant.
- **Permission**: Recurso + acción, ej. `sales:create`, `reports:read`.
- **RolePermission**: Asignación N:M entre Role y Permission.
- **UserRole**: Asignación User–Role (opcionalmente en un tenant).

### 1.3 Acciones estándar

| Acción | Significado | Uso típico |
|--------|-------------|------------|
| `create` | Crear registros del recurso | Alta de venta, cliente, movimiento caja |
| `read` | Ver/listar/consultar | Listados, detalle, reportes de solo lectura |
| `update` | Modificar registros existentes | Editar cliente, anular y reabrir |
| `delete` | Eliminar (o desactivar) | Borrar cliente, producto (si aplica) |
| `manage` | Control total (CRUD + acciones especiales) | Configuración DIAN, backups, auditoría |

Para nuevos módulos solo se añaden nuevos `Permission` (y se asignan a roles); no hace falta tocar la estructura.

### 1.4 Recursos (módulos) sugeridos

Alineados con tu aplicación:

- `sales` – Ventas  
- `quotes` – Cotizaciones  
- `returns` – Devoluciones  
- `cash` – Caja  
- `inventory` – Inventario  
- `catalog` – Productos/categorías  
- `customers` – Clientes  
- `suppliers` – Proveedores  
- `purchases` – Órdenes de compra  
- `supplier-invoices` – Facturas proveedor / cuentas por pagar  
- `reports` – Reportes  
- `audit` – Auditoría  
- `backups` – Backups  
- `dian` – Configuración DIAN  
- `users` – Usuarios y roles (solo admin)

---

## 2. Estructura recomendada en base de datos

### 2.1 Diagrama Prisma (añadir a `schema.prisma`)

```prisma
// ========== MULTI-TENANT (opcional) ==========
model Tenant {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  slug      String   @unique  // para subdominio o identificador en URL
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users     User[]
  roles     Role[]
  userRoles UserRole[]
}

// ========== PERMISOS (recurso:accion) ==========
model Permission {
  id          String   @id @default(uuid()) @db.Uuid
  resource    String   // ej. "sales", "inventory", "reports"
  action      String   // "create" | "read" | "update" | "delete" | "manage"
  description String?
  createdAt   DateTime @default(now())

  rolePermissions RolePermission[]

  @@unique([resource, action])
  @@index([resource])
}

// ========== ROLES (desacoplados de permisos) ==========
model Role {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   // "Admin", "Cajero", "Vendedor", "Contador"
  slug        String   // "admin", "cajero", "vendedor", "contador"
  description String?
  tenantId    String?  @db.Uuid  // null = rol global
  isSystem    Boolean  @default(false)  // true = no se puede eliminar
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant   Tenant?          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  permissions RolePermission[]
  userRoles    UserRole[]

  @@unique([slug, tenantId])
  @@index([tenantId])
}

model RolePermission {
  roleId       String @db.Uuid
  permissionId String @db.Uuid

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@index([permissionId])
}

// ========== USUARIO Y ASIGNACIÓN DE ROLES ==========
model UserRole {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  roleId    String   @db.Uuid
  tenantId  String?  @db.Uuid  // en multi-tenant: rol aplica en este tenant
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
  tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId, tenantId])
  @@index([userId])
  @@index([roleId])
  @@index([tenantId])
}
```

### 2.2 Cambios en el modelo `User` existente

- Añadir `tenantId` (opcional) y relación con `Tenant`.
- Mantener `role RoleName` como **compatibilidad** durante migración; luego se puede deprecar y usar solo `UserRole` + `Permission`.
- Añadir relación `UserRole userRoles[]`.

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String
  role         RoleName @default(USER)   // mantener por compatibilidad; migrar a UserRole
  tenantId     String?  @db.Uuid
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant    Tenant?    @relation(fields: [tenantId], references: [id], onDelete: SetNull)
  userRoles UserRole[]
  auditLogs AuditLog[]
}
```

Nota: en `Tenant` hay que añadir la relación inversa `UserRole[]` si usas `UserRole.tenantId` apuntando a `Tenant`.

### 2.3 Seed de permisos y roles iniciales

- **Permisos:** Insertar todas las combinaciones recurso × acción que uses (ej. para cada módulo: create, read, update, delete; y manage donde aplique).
- **Roles de sistema (isSystem: true):**
  - **Admin:** todos los permisos.
  - **Cajero:** cash (create, read, update), sales (read, create), customers (read).
  - **Vendedor:** sales, quotes (create, read, update), customers (read, create), catalog (read).
  - **Contador:** reports (read, manage), supplier-invoices (read, update), audit (read), sales (read), cash (read).

Así el frontend y los endpoints se construyen por permisos; los nombres de rol son solo agrupaciones de permisos.

---

## 3. Flujo de autorización

### 3.1 Backend (NestJS)

1. **Login**
   - Tras validar credenciales, además de `sub`, `email`, incluir en el JWT (o en respuesta y luego en sesión):
     - `tenantId` (si aplica).
     - Lista de **permisos** del usuario (resolviendo User → UserRole → Role → RolePermission → Permission).
   - Alternativa más ligera: JWT solo con `sub`, `email`, `tenantId`; en cada request se resuelven permisos desde BD/cache.

2. **Guard de permisos**
   - Nuevo guard, ej. `PermissionsGuard`, que:
     - Lee un decorador `@RequirePermission('sales:create')` (o varios con AND/OR).
     - Obtiene el usuario del request (ya inyectado por JwtAuthGuard).
     - Resuelve permisos del usuario (desde JWT o desde un `PermissionsService` que consulte UserRole + RolePermission).
     - Si el usuario tiene el permiso (o rol “admin” que bypass), deja pasar; si no, lanza `403 Forbidden`.

3. **Uso en controladores**
   - Reemplazar gradualmente `@Roles(RoleName.ADMIN)` por `@RequirePermission('audit:read')`, `@RequirePermission('backups:manage')`, etc.
   - Mantener un único punto de definición: el guard + el servicio que resuelve permisos.

### 3.2 Frontend (Next.js / React)

1. **Obtener permisos al cargar sesión**
   - Tras login, el backend devuelve token y, en el payload o en un `GET /auth/me`, la lista de permisos (y tenant si aplica).
   - Guardar en contexto (AuthProvider) tanto `user` como `permissions: string[]`.

2. **Navegación dinámica**
   - En lugar de filtrar por rol (“ADMIN”, “USER”), filtrar por permisos:
     - Ej.: mostrar “Ventas” si tiene `sales:read` o `sales:create`; mostrar “Reportes” si tiene `reports:read`.
   - La configuración de navegación puede definir por cada ítem: `requiredPermission: 'sales:read'` (o varios con OR). Así el menú se construye dinámicamente según permisos.

3. **Acciones en páginas**
   - Botones “Crear”, “Editar”, “Eliminar” se muestran o deshabilitan según `permissions.includes('sales:create')`, etc.
   - Las llamadas API siguen protegidas en backend; el frontend solo mejora UX evitando mostrar acciones no permitidas.

### 3.3 Resumen del flujo

```
[Cliente] → JWT (sub, email, tenantId?, permissions?) → [API]
                ↓
         JwtAuthGuard → user en request
                ↓
         PermissionsGuard + @RequirePermission('recurso:accion')
                ↓
         PermissionsService.hasPermission(userId, 'recurso:accion')
                ↓
         Consulta UserRole → Role → RolePermission → Permission
                ↓
         true → siguiente handler; false → 403
```

---

## 4. Buenas prácticas de seguridad

| Práctica | Aplicación |
|----------|------------|
| **Autorización siempre en backend** | Ningún endpoint confía en “solo si el frontend no muestra el botón”. Todo endpoint que modifique datos o exponga datos sensibles debe comprobar permiso. |
| **Principio de mínimo privilegio** | Asignar a cada rol solo los permisos necesarios. Evitar un rol “Usuario” con todos los permisos. |
| **IDs no predecibles** | Mantener UUIDs para User, Role, Tenant, Permission. No exponer secuencias internas. |
| **Auditoría** | Tu modelo `AuditLog` debe seguir registrando quién (actorId) hizo qué (action) sobre qué entidad. Incluir tenantId en logs si aplica. |
| **Rate limiting y throttling** | Mantener throttle en login y en endpoints sensibles (ya tienes ThrottleAuthGuard). |
| **JWT** | Vida corta para access token; refresh token en httpOnly cookie si quieres mayor seguridad. No poner en el JWT más datos sensibles que los necesarios para autorización. |
| **Multi-tenant** | En cada query de negocio filtrar por `tenantId` cuando el usuario tenga tenant. Evitar que un usuario de tenant A vea datos de tenant B (row-level security o filtro explícito en servicios). |
| **Permisos en caché** | Cachear “permisos del usuario” por poco tiempo (ej. 5 min) para no golpear BD en cada request; invalidar al cambiar UserRole o RolePermission. |
| **Roles de sistema** | Marcar roles críticos (Admin, etc.) con `isSystem: true` y no permitir borrarlos; sí editar sus permisos si se desea. |

---

## 5. Uso en múltiples negocios (multi-tenant)

- **Tenant** identifica cada negocio. Mismo código, misma BD (o mismo esquema), datos separados por `tenantId`.
- **Usuario** puede estar asociado a un solo tenant (`User.tenantId`) o, en diseños más avanzados, a varios mediante una tabla UserTenant con rol por tenant.
- **Roles** pueden ser globales (`tenantId = null`) o por tenant. Los globales son compartidos; los por tenant permiten “Cajero” con permisos distintos en cada negocio.
- **Permisos** suelen ser globales (mismo conjunto recurso:accion para todos); solo la asignación Role–Permission y User–Role pueden ser por tenant.
- Al hacer login, devolver `tenantId` y (opcional) nombre del tenant para que el frontend muestre “Negocio X”. En cada petición, el backend filtra por ese `tenantId` en las tablas de negocio (Sales, Customers, etc.).

---

## 6. Resumen de entregables

| Entregable | Contenido |
|------------|-----------|
| **Modelo conceptual** | Roles desacoplados de permisos; permisos recurso:accion; Tenant opcional; diagrama entidad-relación. |
| **Estructura en BD** | Modelos Prisma: Tenant, Permission, Role, RolePermission, UserRole; cambios en User. |
| **Flujo de autorización** | Login con permisos (o resolución en request); PermissionsGuard + @RequirePermission; frontend que construye nav y acciones por permisos. |
| **Buenas prácticas** | Autorización en backend, mínimo privilegio, auditoría, JWT, filtro por tenant, caché de permisos. |
| **Multi-tenant** | Diseño listo para múltiples negocios con Tenant y filtrado por tenantId. |

Siguiente paso recomendado: implementar los modelos en Prisma (ver fragmento en `docs/schema-roles-permisos.prisma`), migración, seed de Permission y roles por defecto, y después el `PermissionsService` + `PermissionsGuard` + decorador `@RequirePermission` en la API; en paralelo, extender AuthProvider y navegación del frontend para usar la lista de permisos.

---

## 7. Constantes de permisos (recomendado)

Centralizar los strings `recurso:accion` en un único archivo compartido (backend y, si usas TypeScript en web, exportar tipos):

```ts
// Ejemplo: shared/permissions.ts o apps/api/src/auth/permissions.ts
export const RESOURCES = [
  'sales', 'quotes', 'returns', 'cash', 'inventory', 'catalog',
  'customers', 'suppliers', 'purchases', 'supplier-invoices',
  'reports', 'audit', 'backups', 'dian', 'users',
] as const;
export const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];
export type PermissionString = `${Resource}:${Action}`;

export function permission(resource: Resource, action: Action): PermissionString {
  return `${resource}:${action}`;
}
```

Así se evita escribir mal un permiso y se puede reutilizar en guard, seed y frontend.
