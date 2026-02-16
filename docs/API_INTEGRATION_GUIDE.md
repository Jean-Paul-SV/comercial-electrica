# 📚 Guía de Integración de API

**Fecha:** 2026-02-16  
**Versión API:** 1.0  
**Propósito:** Guía completa para desarrolladores externos que desean integrarse con la API

---

## 📋 Índice

1. [Introducción](#introducción)
2. [Autenticación](#autenticación)
3. [Endpoints Principales](#endpoints-principales)
4. [Códigos de Error](#códigos-de-error)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Rate Limiting](#rate-limiting)
7. [Mejores Prácticas](#mejores-prácticas)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Introducción

La API de Comercial Eléctrica es una API RESTful basada en JSON que permite gestionar inventario, ventas, clientes, caja y facturación electrónica.

**Base URL:** `https://api.tudominio.com` (producción) o `http://localhost:3000` (desarrollo)

**Formato:** JSON  
**Autenticación:** Bearer Token (JWT)

---

## 🔐 Autenticación

### 1. Obtener Token de Acceso

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "email": "usuario@example.com",
  "password": "TuContraseña123!"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@example.com",
    "name": "Nombre Usuario",
    "role": "ADMIN",
    "tenantId": "uuid-del-tenant"
  }
}
```

**Errores comunes:**

| Código | Descripción | Solución |
|--------|-------------|----------|
| 401 | Credenciales inválidas | Verificar email y contraseña |
| 429 | Demasiados intentos | Esperar 1 minuto o contactar soporte |

### 2. Usar el Token

Incluir el token en el header `Authorization`:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Request:**
```json
{
  "refreshToken": "tu-refresh-token"
}
```

**Response (200):**
```json
{
  "accessToken": "nuevo-access-token"
}
```

---

## 📡 Endpoints Principales

### Productos

#### Listar Productos
**GET** `/products`

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Resultados por página (default: 20, max: 100)
- `search` (opcional): Búsqueda por nombre o código interno
- `categoryId` (opcional): Filtrar por categoría

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "internalCode": "INT-0001",
      "name": "Cable THHN 12 AWG",
      "cost": 1200,
      "price": 2500,
      "taxRate": 19,
      "stock": 150,
      "category": {
        "id": "uuid",
        "name": "Cables"
      }
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### Crear Producto
**POST** `/products`

**Request:**
```json
{
  "internalCode": "INT-0001",
  "name": "Cable THHN 12 AWG",
  "cost": 1200,
  "price": 2500,
  "taxRate": 19,
  "categoryId": "uuid-categoria"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "internalCode": "INT-0001",
  "name": "Cable THHN 12 AWG",
  "cost": 1200,
  "price": 2500,
  "taxRate": 19,
  "createdAt": "2026-02-16T10:00:00Z"
}
```

**Errores comunes:**

| Código | Descripción |
|--------|-------------|
| 400 | Datos inválidos (verificar campos requeridos) |
| 401 | No autenticado |
| 403 | Sin permisos (requiere `products:create`) |

---

### Clientes

#### Listar Clientes
**GET** `/customers`

**Query Parameters:**
- `page`, `limit`, `search` (igual que productos)
- `docType` (opcional): Tipo de documento (CC, NIT, CE, etc.)
- `docNumber` (opcional): Número de documento

#### Crear Cliente
**POST** `/customers`

**Request:**
```json
{
  "docType": "CC",
  "docNumber": "1234567890",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "3001234567",
  "address": "Calle 123 # 45-67",
  "cityCode": "11001"
}
```

---

### Ventas

#### Crear Venta
**POST** `/sales`

**Request:**
```json
{
  "customerId": "uuid-cliente",
  "cashSessionId": "uuid-sesion-caja",
  "items": [
    {
      "productId": "uuid-producto",
      "qty": 5,
      "price": 2500
    }
  ],
  "paymentMethod": "CASH",
  "notes": "Venta al contado"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "docNumber": "V-0001",
  "total": 14875,
  "subtotal": 12500,
  "tax": 2375,
  "status": "PAID",
  "items": [
    {
      "product": {
        "name": "Cable THHN 12 AWG"
      },
      "qty": 5,
      "unitPrice": 2500,
      "subtotal": 12500
    }
  ],
  "createdAt": "2026-02-16T10:00:00Z"
}
```

**Errores comunes:**

| Código | Descripción |
|--------|-------------|
| 400 | Stock insuficiente, sesión de caja cerrada, datos inválidos |
| 401 | No autenticado |
| 403 | Sin permisos (requiere `sales:create`) |
| 404 | Cliente, producto o sesión de caja no encontrado |

---

### Inventario

#### Crear Movimiento
**POST** `/inventory/movements`

**Request:**
```json
{
  "type": "IN",
  "reason": "Compra inicial",
  "items": [
    {
      "productId": "uuid-producto",
      "qty": 100,
      "unitCost": 1200
    }
  ]
}
```

**Tipos de movimiento:**
- `IN`: Entrada (aumenta stock)
- `OUT`: Salida (disminuye stock)
- `ADJUST`: Ajuste (corrige stock)

---

### Reportes

#### Reporte de Ventas
**GET** `/reports/sales`

**Query Parameters:**
- `startDate` (opcional): Fecha inicio (ISO 8601)
- `endDate` (opcional): Fecha fin (ISO 8601)
- `customerId` (opcional): Filtrar por cliente
- `limit` (opcional): Máximo 500

**Response (200):**
```json
{
  "period": {
    "start": "2026-01-01T00:00:00Z",
    "end": "2026-01-31T23:59:59Z"
  },
  "summary": {
    "totalSales": 50,
    "totalRevenue": 500000,
    "totalTax": 95000,
    "averageSale": 10000
  },
  "sales": [...]
}
```

---

## ⚠️ Códigos de Error

### Errores HTTP Comunes

| Código | Significado | Descripción | Solución |
|--------|------------|-------------|----------|
| 200 | OK | Request exitoso | - |
| 201 | Created | Recurso creado | - |
| 400 | Bad Request | Datos inválidos | Verificar formato del request |
| 401 | Unauthorized | No autenticado | Hacer login y obtener token |
| 403 | Forbidden | Sin permisos | Verificar permisos del usuario |
| 404 | Not Found | Recurso no existe | Verificar ID del recurso |
| 409 | Conflict | Conflicto (ej. duplicado) | Verificar datos únicos |
| 429 | Too Many Requests | Rate limit excedido | Esperar o contactar soporte |
| 500 | Internal Server Error | Error del servidor | Contactar soporte |

### Formato de Error

Todos los errores siguen este formato:

```json
{
  "statusCode": 400,
  "message": "Descripción del error",
  "error": "Bad Request",
  "timestamp": "2026-02-16T10:00:00Z",
  "path": "/products"
}
```

### Errores Específicos por Endpoint

#### POST /products
- `400`: `internalCode` duplicado, `cost` o `price` inválidos
- `404`: `categoryId` no existe

#### POST /sales
- `400`: Stock insuficiente, sesión de caja cerrada
- `404`: Cliente, producto o sesión no encontrado

#### POST /inventory/movements
- `400`: Cantidad inválida (excede límites), stock insuficiente para salida
- `404`: Producto no encontrado

---

## 💡 Ejemplos de Uso

### Ejemplo Completo: Crear Venta

```javascript
// 1. Login
const loginResponse = await fetch('https://api.tudominio.com/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'usuario@example.com',
    password: 'TuContraseña123!'
  })
});

const { accessToken } = await loginResponse.json();

// 2. Crear venta
const saleResponse = await fetch('https://api.tudominio.com/sales', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    customerId: 'uuid-cliente',
    cashSessionId: 'uuid-sesion-caja',
    items: [
      {
        productId: 'uuid-producto',
        qty: 5,
        price: 2500
      }
    ],
    paymentMethod: 'CASH'
  })
});

const sale = await saleResponse.json();
console.log('Venta creada:', sale.docNumber);
```

### Ejemplo con Paginación

```javascript
async function getAllProducts(accessToken, page = 1) {
  const response = await fetch(
    `https://api.tudominio.com/products?page=${page}&limit=50`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const data = await response.json();
  
  // Procesar productos
  data.data.forEach(product => {
    console.log(product.name, product.price);
  });
  
  // Si hay más páginas, obtener siguiente
  if (data.meta.hasNext) {
    await getAllProducts(accessToken, page + 1);
  }
}
```

### Ejemplo con Manejo de Errores

```javascript
async function createProduct(accessToken, productData) {
  try {
    const response = await fetch('https://api.tudominio.com/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(productData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 400) {
        console.error('Datos inválidos:', error.message);
      } else if (response.status === 401) {
        console.error('Token expirado, hacer login nuevamente');
      } else if (response.status === 403) {
        console.error('Sin permisos para crear productos');
      } else {
        console.error('Error:', error.message);
      }
      
      throw new Error(error.message);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al crear producto:', error);
    throw error;
  }
}
```

---

## 🚦 Rate Limiting

La API implementa rate limiting para proteger el servidor:

### Límites Globales
- **1000 requests/minuto** por IP
- **5000 requests/10 minutos** por IP
- **20000 requests/hora** por IP

### Límites por Endpoint
- **Login:** 50 intentos/minuto por IP
- **Forgot Password:** 3 solicitudes/15 minutos por email
- **Reportes:** 30 requests/minuto por tenant
- **Export:** 10 requests/minuto por tenant

### Límites por Plan
- **Básico:** 100 req/min para reportes
- **Pro:** 1000 req/min para reportes
- **Enterprise:** 5000 req/min para reportes

### Headers de Rate Limit

Las respuestas incluyen headers informativos:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642348800
```

### Manejo de Rate Limit

Si recibes `429 Too Many Requests`:

```javascript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  console.log(`Esperar ${retryAfter} segundos antes de reintentar`);
  
  // Esperar y reintentar
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  return createProduct(accessToken, productData);
}
```

---

## ✅ Mejores Prácticas

### 1. Manejo de Tokens

- **Almacenar tokens de forma segura** (no en localStorage si es posible)
- **Renovar tokens antes de expirar** usando refresh token
- **Manejar errores 401** automáticamente con refresh

```javascript
async function fetchWithAuth(url, options = {}) {
  let token = getStoredToken();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
  
  // Si token expirado, renovar
  if (response.status === 401) {
    token = await refreshToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  }
  
  return response;
}
```

### 2. Paginación

- **Siempre usar paginación** para listados grandes
- **No hacer requests innecesarios** si no hay más páginas
- **Usar límites razonables** (20-50 por página)

### 3. Manejo de Errores

- **Verificar status code** antes de procesar respuesta
- **Leer mensaje de error** para debugging
- **Implementar retry logic** para errores temporales (500, 503)

### 4. Validación de Datos

- **Validar datos antes de enviar** (formato, tipos, requeridos)
- **Usar tipos TypeScript** si es posible
- **Manejar errores 400** mostrando mensajes claros al usuario

### 5. Performance

- **Usar caché** cuando sea apropiado
- **Evitar requests innecesarios** (debounce en búsquedas)
- **Usar filtros** en lugar de obtener todos los datos

---

## 🔧 Troubleshooting

### Problema: Token expirado frecuentemente

**Solución:** Implementar refresh automático antes de expirar (ver ejemplo arriba).

### Problema: Rate limit excedido

**Solución:** 
- Reducir frecuencia de requests
- Implementar retry con backoff exponencial
- Contactar soporte para aumentar límites

### Problema: Errores 500 intermitentes

**Solución:**
- Implementar retry con backoff exponencial
- Verificar logs del servidor (contactar soporte)
- Verificar que los datos enviados son válidos

### Problema: Stock insuficiente al crear venta

**Solución:**
- Verificar stock antes de crear venta: `GET /products/:id`
- Manejar error 400 y mostrar mensaje al usuario

---

## 📞 Soporte

- **Documentación Swagger:** `https://api.tudominio.com/api/docs`
- **Email:** soporte@tudominio.com
- **Documentación:** `docs/API_INTEGRATION_GUIDE.md`

---

**Última actualización:** 2026-02-16
