# 📚 Configuración de Swagger/OpenAPI

## ✅ Estado Actual

Swagger/OpenAPI ha sido **completamente configurado** en el código:

- ✅ Configuración en `main.ts`
- ✅ Decoradores agregados a todos los controladores
- ✅ DTOs documentados
- ✅ Dependencias agregadas a `package.json`

## ⚠️ Pendiente: Instalación de Dependencias

Las dependencias están listadas en `package.json` pero necesitan instalarse:

```json
{
  "@nestjs/swagger": "^8.0.7",
  "swagger-ui-express": "^5.0.1",
  "@types/swagger-ui-express": "^4.1.6"
}
```

## 🔧 Pasos para Completar la Instalación

### Opción 1: Instalar desde la raíz del proyecto
```bash
cd c:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica
npm install
```

### Opción 2: Instalar solo en el workspace de la API
```bash
cd c:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\apps\api
npm install
```

### Opción 3: Si persisten problemas de permisos

1. **Cerrar todos los editores/IDEs** que puedan tener archivos abiertos
2. **Ejecutar PowerShell como Administrador**
3. **Verificar que OneDrive no esté sincronizando** la carpeta
4. **Intentar desde otra ubicación temporalmente**:
   ```bash
   # Copiar el proyecto a otra ubicación
   xcopy "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica" "C:\temp\Comercial-Electrica" /E /I
   cd C:\temp\Comercial-Electrica\apps\api
   npm install
   ```

## 🚀 Verificar que Funciona

Una vez instaladas las dependencias:

1. **Iniciar la API:**
   ```bash
   npm run dev:api
   ```

2. **Acceder a Swagger UI:**
   - Abrir navegador en: `http://localhost:3000/api/docs`
   - Deberías ver la documentación interactiva

3. **Probar autenticación:**
   - Hacer login en `/auth/login`
   - Copiar el `accessToken` de la respuesta
   - Hacer clic en el botón "Authorize" en Swagger UI
   - Pegar el token: `Bearer <tu-token>`
   - Probar cualquier endpoint protegido

## 📋 Endpoints Documentados

Todos los siguientes endpoints están documentados en Swagger:

### Autenticación (`/auth`)
- `POST /auth/bootstrap-admin` - Crear primer admin
- `POST /auth/login` - Iniciar sesión
- `POST /auth/users` - Registrar usuario (ADMIN)

### Productos (`/products`)
- `GET /products` - Listar productos
- `GET /products/:id` - Obtener producto
- `POST /products` - Crear producto (ADMIN)
- `PATCH /products/:id` - Actualizar producto (ADMIN)
- `DELETE /products/:id` - Desactivar producto (ADMIN)

### Categorías (`/categories`)
- `GET /categories` - Listar categorías
- `POST /categories` - Crear categoría (ADMIN)

### Clientes (`/customers`)
- `GET /customers` - Listar clientes
- `GET /customers/:id` - Obtener cliente
- `POST /customers` - Crear cliente
- `PATCH /customers/:id` - Actualizar cliente

### Inventario (`/inventory`)
- `GET /inventory/movements` - Listar movimientos
- `POST /inventory/movements` - Crear movimiento

### Caja (`/cash`)
- `GET /cash/sessions` - Listar sesiones
- `POST /cash/sessions` - Abrir sesión
- `POST /cash/sessions/:id/close` - Cerrar sesión
- `GET /cash/sessions/:id/movements` - Movimientos de sesión

### Ventas (`/sales`)
- `GET /sales` - Listar ventas
- `POST /sales` - Crear venta

## ✨ Características de Swagger

- ✅ **Documentación interactiva** - Probar endpoints directamente desde el navegador
- ✅ **Autenticación JWT integrada** - Botón "Authorize" para agregar token
- ✅ **Ejemplos de request/response** - Ver estructura de datos esperada
- ✅ **Códigos de respuesta documentados** - Saber qué esperar en cada caso
- ✅ **Tags organizados** - Fácil navegación por módulos
- ✅ **Persistencia de autorización** - El token se mantiene al recargar

## 🐛 Solución de Problemas

### Error: "Cannot find module '@nestjs/swagger'"
**Solución:** Las dependencias no están instaladas. Ejecutar `npm install`.

### Error: "SwaggerModule is not a function"
**Solución:** Verificar que la versión de `@nestjs/swagger` sea compatible con `@nestjs/core` (v11).

### Swagger UI no carga
**Solución:** 
1. Verificar que el servidor esté corriendo
2. Verificar que no haya errores en la consola
3. Intentar acceder directamente a `http://localhost:3000/api/docs-json` para ver el JSON

### Token JWT no funciona
**Solución:**
1. Verificar que el token esté en formato correcto: `Bearer <token>`
2. Verificar que el token no haya expirado (15 minutos por defecto)
3. Hacer login nuevamente para obtener un token fresco

---

**Última actualización:** Enero 2026
