# Guía para cargar datos (Swagger o cURL) — Orion API

Esta guía te permite **probar todo el sistema** creando datos reales desde:

- **Swagger UI**: `http://localhost:3000/api/docs`
- **Terminal (PowerShell) con `curl.exe`**

> Nota Windows: en PowerShell, usa **`curl.exe`** (no `curl`) para evitar el alias `Invoke-WebRequest`.

---

## 0) Levantar infraestructura + API

En la **raíz** del proyecto:

```powershell
cd "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"

# 1) Levantar Postgres + Redis
npm run db:up

# 2) Levantar API
npm run dev:api
```

Verifica:
- API: `http://localhost:3000/health`
- Swagger: `http://localhost:3000/api/docs`

---

## 1) Problema típico: 401 en `/auth/login` (Credenciales inválidas)

Ese error ocurre si:
- **El admin nunca se creó** (no hiciste `bootstrap-admin`)
- **La BD ya tenía usuarios** (y `bootstrap-admin` ya no aplica)
- **El email/password no coincide** con el usuario existente

### Si te salió: `400 Bootstrap ya fue realizado`

Significa que **ya hay usuarios creados** en tu base de datos actual.

- Si **NO recuerdas** el email/clave de esos usuarios: haz **reset total** (Opción A) y listo.
- Si **SÍ recuerdas** las credenciales: salta directo a `POST /auth/login` (Opción B).

### Opción A (recomendada si estás en local y no te importa borrar datos): reset total de la BD

Esto borra los volúmenes de Docker (base de datos limpia).

```powershell
cd "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"

# bajar contenedores y borrar volúmenes (RESET TOTAL)
docker compose -f infra/docker-compose.yml down -v

# volver a subir limpio
npm run db:up

# aplicar migraciones (si es necesario)
npm run prisma:generate -w api
npm run prisma:migrate -w api
```

Luego ya puedes usar `bootstrap-admin` + `login`.

### Opción B: intentar login con el admin que ya exista

Si `bootstrap-admin` te da `400 Bootstrap ya fue realizado`, **NO crea un admin nuevo**.
En ese caso debes hacer `login` con el usuario existente o aplicar la Opción A.

Ejemplo (cambia email/password por los reales de tu BD):

```powershell
curl.exe -X POST "http://localhost:3000/auth/login" `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"TU_EMAIL\",\"password\":\"TU_PASSWORD\"}"
```

---

## 2) Crear primer admin + login (cURLs)

### 2.1 Crear primer admin (solo si BD vacía)

```powershell
curl.exe -X POST "http://localhost:3000/auth/bootstrap-admin" `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"admin@example.com\",\"password\":\"Admin123!\"}"
```

### 2.2 Login (obtener token)

```powershell
$LOGIN = curl.exe -s -X POST "http://localhost:3000/auth/login" `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"admin@example.com\",\"password\":\"Admin123!\"}"

$LOGIN
```

Extraer token:

```powershell
$TOKEN = ( $LOGIN | ConvertFrom-Json ).accessToken
$TOKEN
```

> En Swagger: botón **Authorize** y pega el token (sin "Bearer ").

---

## 3) Cargar datos base (Categoría → Producto → Cliente → Stock → Caja)

> Guarda IDs de respuesta: `categoryId`, `productId`, `customerId`, `cashSessionId`.

### 3.1 Crear categoría (ADMIN)

```powershell
$CATEGORY = curl.exe -s -X POST "http://localhost:3000/categories" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{\"name\":\"Cables\"}"

$CATEGORY
$categoryId = ( $CATEGORY | ConvertFrom-Json ).id
$categoryId
```

### 3.2 Crear producto (ADMIN)

```powershell
$PRODUCT = curl.exe -s -X POST "http://localhost:3000/products" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{\"internalCode\":\"CABLE-001\",\"name\":\"Cable THHN 12 AWG\",\"categoryId\":\"$categoryId\",\"cost\":5000,\"price\":8000,\"taxRate\":19}"

$PRODUCT
$productId = ( $PRODUCT | ConvertFrom-Json ).id
$productId
```

### 3.3 Crear cliente

```powershell
$CUSTOMER = curl.exe -s -X POST "http://localhost:3000/customers" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{\"docType\":\"CC\",\"docNumber\":\"1234567890\",\"name\":\"Juan Perez\",\"email\":\"juan@example.com\",\"phone\":\"3001234567\",\"address\":\"Calle 1 #2-3\",\"cityCode\":\"11001\"}"

$CUSTOMER
$customerId = ( $CUSTOMER | ConvertFrom-Json ).id
$customerId
```

### 3.4 Meter stock inicial (Inventario)

```powershell
curl.exe -X POST "http://localhost:3000/inventory/movements" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{\"type\":\"IN\",\"reason\":\"Stock inicial\",\"items\":[{\"productId\":\"$productId\",\"qty\":100,\"unitCost\":5000}]}"
```

### 3.5 Abrir sesión de caja

```powershell
$CASH = curl.exe -s -X POST "http://localhost:3000/cash/sessions" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{\"openingAmount\":100000,\"note\":\"Apertura de prueba\"}"

$CASH
$cashSessionId = ( $CASH | ConvertFrom-Json ).id
$cashSessionId
```

---

## 4) Probar flujo completo (Cotización → Convertir a Venta)

### 4.1 Crear cotización

```powershell
$QUOTE = curl.exe -s -X POST "http://localhost:3000/quotes" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{\"customerId\":\"$customerId\",\"items\":[{\"productId\":\"$productId\",\"qty\":2,\"unitPrice\":8000}]}"

$QUOTE
$quoteId = ( $QUOTE | ConvertFrom-Json ).id
$quoteId
```

### 4.2 Convertir cotización a venta

```powershell
curl.exe -X POST "http://localhost:3000/quotes/$quoteId/convert" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{\"cashSessionId\":\"$cashSessionId\",\"paymentMethod\":\"CASH\"}"
```

---

## 5) Probar venta directa (sin cotización)

```powershell
curl.exe -X POST "http://localhost:3000/sales" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{\"customerId\":\"$customerId\",\"cashSessionId\":\"$cashSessionId\",\"paymentMethod\":\"CASH\",\"items\":[{\"productId\":\"$productId\",\"qty\":1}]}"
```

---

## 6) Verificar listados y reportes

### Listados

```powershell
curl.exe -s "http://localhost:3000/products" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/customers" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/inventory/movements" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/cash/sessions" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/quotes" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/sales" -H "Authorization: Bearer $TOKEN"
```

### Dashboard / reportes

```powershell
curl.exe -s "http://localhost:3000/reports/dashboard" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/reports/sales" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/reports/inventory" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/reports/cash" -H "Authorization: Bearer $TOKEN"
curl.exe -s "http://localhost:3000/reports/customers" -H "Authorization: Bearer $TOKEN"
```

---

## 7) Backups (opcional, ADMIN)

```powershell
# crear backup
curl.exe -X POST "http://localhost:3000/backups" `
  -H "Authorization: Bearer $TOKEN"

# listar backups
curl.exe -s "http://localhost:3000/backups" -H "Authorization: Bearer $TOKEN"
```

