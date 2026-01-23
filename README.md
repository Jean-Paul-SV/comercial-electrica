<<<<<<< HEAD
# Sistema de Gestión Comercial Eléctrica

Sistema integral para gestión de inventario, ventas, caja, clientes y facturación electrónica DIAN.

## 🚀 Inicio Rápido

### 1. Requisitos Previos

- Node.js 18+ y npm
- Docker y Docker Compose (para Postgres y Redis)

### 2. Configuración Inicial

**Nota:** Los pasos 1-4 deben ejecutarse desde la raíz del proyecto.

```bash
# 1. Instalar dependencias (desde la raíz)
npm install

# 2. Copiar variables de entorno (desde la raíz)
cp env.example .env

# 3. Levantar infraestructura (Postgres + Redis)
npm run db:up

# 4. Generar cliente Prisma
npm run prisma:generate -w api

# 5. Crear migración inicial y aplicar (cambiar a apps/api)
cd apps/api
npm run prisma:migrate
# Cuando pregunte el nombre: "init"
cd ../..
```

### 3. Iniciar la API

```bash
# En modo desarrollo (watch)
npm run dev:api

# O desde la raíz (API + Web cuando esté lista)
npm run dev
```

La API estará disponible en `http://localhost:3000`

## 🧪 Probar el Sistema

### Paso 1: Crear Usuario Administrador

```bash
curl -X POST http://localhost:3000/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!"
  }'
```

**Nota:** Este endpoint solo funciona si no hay usuarios en la BD. Úsalo solo la primera vez.

### Paso 2: Iniciar Sesión

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!"
  }'
```

Respuesta esperada:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Guarda el `accessToken` para usarlo en las siguientes requests.

### Paso 3: Crear una Categoría

```bash
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "name": "Cables"
  }'
```

### Paso 4: Crear un Producto

```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "internalCode": "CABLE-001",
    "name": "Cable THWN 12 AWG",
    "categoryId": "ID_DE_LA_CATEGORIA",
    "cost": 5000,
    "price": 8000,
    "taxRate": 19
  }'
```

### Paso 5: Agregar Stock (Movimiento de Inventario)

```bash
curl -X POST http://localhost:3000/inventory/movements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "type": "IN",
    "reason": "Compra inicial",
    "items": [
      {
        "productId": "ID_DEL_PRODUCTO",
        "qty": 100,
        "unitCost": 5000
      }
    ]
  }'
```

### Paso 6: Crear un Cliente

```bash
curl -X POST http://localhost:3000/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "docType": "CC",
    "docNumber": "1234567890",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "3001234567"
  }'
```

### Paso 7: Abrir Caja

```bash
curl -X POST http://localhost:3000/cash/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "openingAmount": 100000
  }'
```

Guarda el `id` de la sesión de caja.

### Paso 8: Crear una Venta

```bash
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "customerId": "ID_DEL_CLIENTE",
    "cashSessionId": "ID_DE_LA_SESION_CAJA",
    "paymentMethod": "CASH",
    "items": [
      {
        "productId": "ID_DEL_PRODUCTO",
        "qty": 5
      }
    ]
  }'
```

Esta operación:
- ✅ Descuenta stock automáticamente
- ✅ Registra movimiento de caja
- ✅ Crea factura
- ✅ Crea documento DIAN (DRAFT)
- ✅ Encola procesamiento DIAN

### Paso 9: Consultar Endpoints Disponibles

```bash
# Listar productos
curl http://localhost:3000/products \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"

# Listar ventas
curl http://localhost:3000/sales \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"

# Listar sesiones de caja
curl http://localhost:3000/cash/sessions \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"

# Listar clientes
curl http://localhost:3000/customers \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

## 📋 Endpoints Principales

### Autenticación
- `POST /auth/bootstrap-admin` - Crear primer admin (solo primera vez)
- `POST /auth/login` - Iniciar sesión
- `POST /auth/users` - Crear usuario (requiere ADMIN)

### Catálogo
- `GET /products` - Listar productos
- `POST /products` - Crear producto (ADMIN)
- `GET /products/:id` - Ver producto
- `PATCH /products/:id` - Actualizar producto (ADMIN)
- `DELETE /products/:id` - Desactivar producto (ADMIN)
- `GET /categories` - Listar categorías
- `POST /categories` - Crear categoría (ADMIN)

### Clientes
- `GET /customers` - Listar clientes
- `POST /customers` - Crear cliente
- `GET /customers/:id` - Ver cliente
- `PATCH /customers/:id` - Actualizar cliente

### Inventario
- `GET /inventory/movements` - Listar movimientos
- `POST /inventory/movements` - Crear movimiento (IN/OUT/ADJUST)

### Caja
- `GET /cash/sessions` - Listar sesiones
- `POST /cash/sessions` - Abrir sesión
- `POST /cash/sessions/:id/close` - Cerrar sesión
- `GET /cash/sessions/:id/movements` - Movimientos de una sesión

### Ventas
- `GET /sales` - Listar ventas
- `POST /sales` - Crear venta (con factura y DIAN)

## 🛠️ Comandos Útiles

```bash
# Ver logs de la base de datos
docker logs ce_postgres

# Ver logs de Redis
docker logs ce_redis

# Detener infraestructura
npm run db:down

# Abrir Prisma Studio (GUI para la BD)
npm run prisma:studio -w api

# Ejecutar migraciones
npm run prisma:migrate -w api

# Generar cliente Prisma después de cambios en schema
npm run prisma:generate -w api
```

## 🔐 Variables de Entorno

Edita `.env` (copiado de `env.example`):

```env
PORT=3000
DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"
JWT_ACCESS_SECRET="cambiar_en_produccion"
JWT_ACCESS_TTL_SECONDS=900
REDIS_URL="redis://localhost:6379"
```

## 📝 Notas

- Todos los endpoints (excepto `/auth/bootstrap-admin` y `/auth/login`) requieren autenticación JWT.
- El token JWT expira en 15 minutos por defecto (configurable en `JWT_ACCESS_TTL_SECONDS`).
- Los roles disponibles son `ADMIN` y `USER`.
- Las operaciones de inventario y ventas usan transacciones para garantizar consistencia.

## 🐛 Solución de Problemas

**Error: "Prisma Client not generated"**
```bash
npm run prisma:generate -w api
```

**Error: "Connection refused" (Postgres/Redis)**
```bash
npm run db:up
# Espera unos segundos a que los contenedores estén listos
```

**Error: "Table does not exist"**
```bash
cd apps/api
npm run prisma:migrate
```

## 📚 Próximos Pasos

- [ ] Implementar módulo de reportes
- [ ] Implementar procesador DIAN (billing)
- [ ] Implementar módulo de backups
- [ ] Crear frontend (apps/web)
- [ ] Agregar cotizaciones
=======
# comercial-electrica
>>>>>>> 1e22d5c4676537e0012361e1af4a0659793d1b31
