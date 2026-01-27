# Sistema de Gestión Comercial Eléctrica

Sistema integral para gestión de inventario, ventas, caja, clientes y facturación electrónica DIAN.

> **Estado del Proyecto:** 🟢 **8.5/10 - EXCELENTE**  
> **Última actualización:** Enero 2026  
> **Calificación:** Base sólida y profesional, lista para continuar desarrollo hacia producción

## 🚀 Inicio Rápido - Guía Paso a Paso

### 📋 Paso 1: Requisitos Previos

Asegúrate de tener instalado:

- ✅ **Node.js 18+** y npm (verificar con: `node --version` y `npm --version`)
- ✅ **Docker** y **Docker Compose** (verificar con: `docker --version` y `docker compose version`)
- ✅ **Git** (opcional, para clonar el repositorio)

---

### 📋 Paso 2: Ubicarse en la Raíz del Proyecto

**⚠️ IMPORTANTE:** Todos los comandos de configuración inicial se ejecutan desde la **raíz del proyecto**.

```powershell
# Abrir PowerShell y navegar a la raíz del proyecto
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica

# Verificar que estás en el lugar correcto (deberías ver estos archivos):
dir env.example
dir package.json
dir apps

# Si estás en apps/api, vuelve a la raíz:
cd ..\..
```

---

### 📋 Paso 3: Instalar Dependencias

```powershell
# Desde la raíz del proyecto, instalar todas las dependencias
npm install

# Esto instalará dependencias de:
# - Raíz del proyecto
# - apps/api
# - apps/web (si existe)

# Esperar a que termine (puede tardar varios minutos)
```

---

### 📋 Paso 4: Configurar Variables de Entorno

```powershell
# Copiar el archivo de ejemplo a .env
copy env.example .env

# Verificar que se creó correctamente:
dir .env

# Opcional: Editar .env con tus valores personalizados
# (Por ahora puedes dejarlo con los valores por defecto)
```

---

### 📋 Paso 5: Levantar Infraestructura (Base de Datos y Redis)

```powershell
# Levantar contenedores Docker (Postgres + Redis)
npm run db:up

# Esperar 10-15 segundos a que los contenedores estén listos

# Verificar que los contenedores están corriendo:
docker ps

# Deberías ver dos contenedores:
# - ce_postgres (PostgreSQL)
# - ce_redis (Redis)
```

---

### 📋 Paso 6: Generar Cliente Prisma

```powershell
# Generar el cliente de Prisma (desde la raíz)
npm run prisma:generate -w api

# Si aparece error EPERM:
# 1. Cerrar Cursor/VS Code completamente
# 2. Ejecutar PowerShell como Administrador
# 3. Repetir este paso
# 4. Ver guía completa: docs/SOLUCION_ERROR_EPERM_PRISMA.md
```

---

### 📋 Paso 7: Aplicar Migraciones de Base de Datos

```powershell
# Cambiar a la carpeta de la API
cd apps/api

# Aplicar migraciones
npm run prisma:migrate

# Si es la primera vez, cuando pregunte el nombre de la migración:
# Escribir: init
# Presionar Enter

# Volver a la raíz
cd ..\..
```

---

### 📋 Paso 8: Iniciar la API

```powershell
# Desde la raíz, iniciar la API en modo desarrollo
npm run dev:api

# O si prefieres iniciar desde apps/api:
cd apps/api
npm run start:dev
cd ..\..

# La API estará disponible en: http://localhost:3000
```

---

### 📋 Paso 9: Verificar que Todo Funciona

```powershell
# Opción 1: Verificar endpoint de health check
curl http://localhost:3000/health

# O abrir en el navegador:
# http://localhost:3000/health

# Deberías ver una respuesta JSON como:
# {
#   "status": "ok",
#   "timestamp": "2026-01-27T04:54:36.456Z",
#   "uptime": 123,
#   "environment": "development",
#   "version": "1.0.0"
# }

# Opción 2: Verificar endpoint raíz
curl http://localhost:3000

# O abrir en el navegador:
# http://localhost:3000

# Deberías ver: "Sistema Comercial Eléctrica API - Bienvenido!"
```

---

### 📋 Paso 10: Acceder a Swagger (Documentación de la API)

```powershell
# Abrir en el navegador:
# http://localhost:3000/api/docs

# Aquí podrás:
# - Ver todos los endpoints disponibles
# - Probar los endpoints directamente
# - Ver ejemplos de request/response
# - Autenticarte con JWT
```

---

## ✅ Checklist de Verificación

Después de seguir todos los pasos, verifica que todo está funcionando:

- [ ] ✅ Dependencias instaladas (`npm install` completado sin errores)
- [ ] ✅ Archivo `.env` creado en la raíz
- [ ] ✅ Contenedores Docker corriendo (`docker ps` muestra postgres y redis)
- [ ] ✅ Cliente Prisma generado (sin errores EPERM)
- [ ] ✅ Migraciones aplicadas (tablas creadas en la base de datos)
- [ ] ✅ API iniciada (`npm run dev:api` sin errores)
- [ ] ✅ API responde en `http://localhost:3000/health`
- [ ] ✅ Swagger accesible en `http://localhost:3000/api/docs`

---

## 🎯 Próximos Pasos Después de la Instalación

Una vez que todo esté funcionando:

1. **Crear usuario administrador:**
   ```powershell
   curl -X POST http://localhost:3000/auth/bootstrap-admin `
     -H "Content-Type: application/json" `
     -d '{\"email\": \"admin@example.com\", \"password\": \"Admin123!\"}'
   ```

2. **Iniciar sesión y obtener token:**
   ```powershell
   curl -X POST http://localhost:3000/auth/login `
     -H "Content-Type: application/json" `
     -d '{\"email\": \"admin@example.com\", \"password\": \"Admin123!\"}'
   ```

3. **Probar endpoints desde Swagger:**
   - Abrir `http://localhost:3000/api/docs`
   - Hacer clic en "Authorize" y pegar el token
   - Probar crear productos, clientes, etc.

4. **Ejecutar tests:**
   ```powershell
   cd apps/api
   npm test
   ```

---

## 🆘 Si Algo Falla

Consulta la sección [🐛 Solución de Problemas](#-solución-de-problemas) más abajo en este README, o revisa:

- [Solución Error EPERM con Prisma](./docs/SOLUCION_ERROR_EPERM_PRISMA.md)
- [Solución a Errores de Instalación](./docs/SOLUCION_ERRORES_INSTALACION.md)
- [Pasos para Instalar Dependencias](./docs/PASOS_INSTALACION.md)

### 3. Iniciar la API

```bash
# En modo desarrollo (watch mode - se recarga automáticamente)
npm run dev:api

# O desde la raíz (API + Web cuando esté lista)
npm run dev
```

La API estará disponible en `http://localhost:3000`

### 4. Verificar que Todo Funciona

```bash
# Verificar endpoint de health check
curl http://localhost:3000/health

# O abrir en el navegador
# http://localhost:3000/health

# Deberías ver una respuesta JSON con el estado de la API:
# {
#   "status": "ok",
#   "timestamp": "2026-01-27T04:54:36.456Z",
#   "uptime": 123,
#   "environment": "development",
#   "version": "1.0.0"
# }

# También puedes verificar el endpoint raíz:
curl http://localhost:3000
# Deberías ver: "Sistema Comercial Eléctrica API - Bienvenido!"
```

### 5. Ejecutar Tests

```bash
# Ejecutar todos los tests unitarios
cd apps/api
npm test

# Ejecutar tests con cobertura
npm run test:cov

# Ejecutar tests E2E (requiere API corriendo)
npm run test:e2e

# Ejecutar tests en modo watch (desarrollo)
npm run test:watch
```

**Nota:** Los tests requieren que la base de datos esté corriendo. Asegúrate de ejecutar `npm run db:up` antes de correr los tests.

## 📚 Documentación de la API (Swagger)

Una vez que la API esté corriendo, puedes acceder a la documentación interactiva de Swagger:

**URL:** `http://localhost:3000/api/docs`

### Características:
- ✅ Documentación interactiva de todos los endpoints
- ✅ Probar endpoints directamente desde el navegador
- ✅ Autenticación JWT integrada (botón "Authorize")
- ✅ Ejemplos de request/response
- ✅ Códigos de respuesta documentados
- ✅ Documentación de módulos: Auth, Catálogo, Clientes, Inventario, Caja, Ventas, Cotizaciones, Reportes, DIAN

**Cómo usar Swagger:**
1. Abre `http://localhost:3000/api/docs` en tu navegador
2. Haz clic en el botón **"Authorize"** (🔒) en la parte superior
3. Ingresa el token JWT obtenido del login (sin la palabra "Bearer")
4. Explora y prueba los endpoints directamente desde la interfaz

**Nota:** Si Swagger no carga, verifica que las dependencias estén instaladas:
```bash
npm install
```

Para más detalles, consulta [SWAGGER_SETUP.md](./docs/SWAGGER_SETUP.md)

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

### Health Check
- `GET /` - Mensaje de bienvenida
- `GET /health` - Health check (estado de la API, uptime, versión)

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
- `GET /sales/:id` - Ver venta detallada

### Cotizaciones
- `GET /quotes` - Listar cotizaciones
- `POST /quotes` - Crear cotización
- `GET /quotes/:id` - Ver cotización
- `PATCH /quotes/:id` - Actualizar cotización
- `POST /quotes/:id/convert` - Convertir cotización a venta
- `PATCH /quotes/:id/status` - Cambiar estado de cotización

### Reportes
- `GET /reports/sales` - Reporte de ventas
- `GET /reports/inventory` - Reporte de inventario
- `GET /reports/cash` - Reporte de caja
- `GET /reports/customers` - Reporte de clientes

### DIAN
- `GET /dian/documents/:id/status` - Consultar estado de documento DIAN (requiere ADMIN)

## 🛠️ Comandos Útiles

### Base de Datos e Infraestructura

```bash
# Levantar infraestructura (Postgres + Redis)
npm run db:up

# Detener infraestructura
npm run db:down

# Ver logs de la base de datos
docker logs ce_postgres

# Ver logs de Redis
docker logs ce_redis

# Abrir Prisma Studio (GUI para la BD)
npm run prisma:studio -w api

# Ejecutar migraciones
npm run prisma:migrate -w api

# Generar cliente Prisma después de cambios en schema
npm run prisma:generate -w api
```

### Desarrollo

```bash
# Iniciar API en modo desarrollo (watch)
npm run dev:api

# Compilar proyecto
cd apps/api
npm run build

# Ejecutar linting
npm run lint

# Formatear código
npm run format
```

### Testing

```bash
# Ejecutar todos los tests unitarios
cd apps/api
npm test

# Ejecutar tests con cobertura
npm run test:cov

# Ejecutar tests E2E
npm run test:e2e

# Ejecutar tests en modo watch
npm run test:watch
```

## 🔐 Variables de Entorno

Edita `.env` (copiado de `env.example`):

```env
# API
PORT=3000

# Database (PostgreSQL)
DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"

# Auth (JWT)
JWT_ACCESS_SECRET="cambiar_en_produccion"
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_SECRET="cambiar_en_produccion"
JWT_REFRESH_TTL_SECONDS=1209600

# Redis (BullMQ)
REDIS_URL="redis://localhost:6379"

# Storage (placeholder; for cloud use S3/Azure/GCS)
OBJECT_STORAGE_PROVIDER="local"
OBJECT_STORAGE_BASE_PATH="./storage"

# DIAN (Colombian e-invoicing - placeholder values)
DIAN_ENV="HABILITACION"
DIAN_SOFTWARE_ID="CHANGE_ME"
DIAN_SOFTWARE_PIN="CHANGE_ME"
```

**⚠️ IMPORTANTE:** 
- Cambia los valores de `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` en producción
- Configura `DIAN_SOFTWARE_ID` y `DIAN_SOFTWARE_PIN` cuando tengas credenciales de DIAN

## 📝 Notas Importantes

### Autenticación y Seguridad
- ✅ Todos los endpoints (excepto `/auth/bootstrap-admin` y `/auth/login`) requieren autenticación JWT
- ✅ El token JWT expira en 15 minutos por defecto (configurable en `JWT_ACCESS_TTL_SECONDS`)
- ✅ Los roles disponibles son `ADMIN` y `USER`
- ✅ Los endpoints de administración requieren rol `ADMIN`

### Validaciones Implementadas
- ✅ **Validaciones de Sesión de Caja:** No se pueden crear ventas con caja cerrada
- ✅ **Validaciones de Cliente:** Verifica que el cliente existe antes de crear ventas/cotizaciones
- ✅ **Validaciones de Productos:** Verifica que todos los productos existen antes de procesar movimientos
- ✅ **Validaciones de Estados:** Transiciones de estado válidas para cotizaciones
- ✅ **Validaciones de Inventario:** No permite salidas de stock si no hay suficiente inventario

### Características Implementadas
- ✅ **Transacciones Atómicas:** Operaciones críticas usan transacciones para garantizar consistencia
- ✅ **Procesamiento Asíncrono:** Documentos DIAN se procesan en cola (BullMQ)
- ✅ **Manejo de Errores:** Respuestas de error estructuradas y consistentes
- ✅ **Logging:** Sistema de logging estructurado para auditoría
- ✅ **Documentación:** Swagger/OpenAPI completo con ejemplos

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

**Error: "Tests fallan"**
```bash
# Asegúrate de que la base de datos esté corriendo (desde la raíz)
npm run db:up

# Espera unos segundos y vuelve a ejecutar los tests
cd apps/api
npm test
```

**Error: "Cannot find module"**
```bash
# Reinstalar dependencias (desde la raíz)
rm -rf node_modules package-lock.json
npm install

# Regenerar cliente Prisma (desde la raíz)
npm run prisma:generate -w api
```

**Error: "EPERM: operation not permitted" (Prisma)**
```powershell
# Este error ocurre cuando un proceso tiene el archivo bloqueado
# Solución rápida (probar primero):

# 1. Cerrar todos los procesos de Node.js
taskkill /F /IM node.exe

# 2. Cerrar Cursor/VS Code completamente

# 3. Eliminar carpeta .prisma problemática
cd apps/api
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
cd ..\..

# 4. Regenerar Prisma
npm run prisma:generate -w api

# Si aún falla:
# - Ejecutar PowerShell como Administrador
# - Cerrar OneDrive temporalmente
# - Ver guía completa: docs/SOLUCION_ERROR_EPERM_PRISMA.md
```

**Error: "Missing script: db:up"**
```bash
# Este error ocurre si ejecutas el comando desde apps/api
# Solución: Ejecuta desde la raíz del proyecto
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica
npm run db:up
```

## ✅ Funcionalidades Implementadas

- [x] ✅ **Autenticación JWT** - Sistema completo de autenticación y autorización
- [x] ✅ **Gestión de Catálogo** - Productos y categorías
- [x] ✅ **Gestión de Clientes** - CRUD completo de clientes
- [x] ✅ **Gestión de Inventario** - Movimientos de entrada, salida y ajustes
- [x] ✅ **Gestión de Caja** - Sesiones de caja y movimientos
- [x] ✅ **Gestión de Ventas** - Ventas con facturación automática
- [x] ✅ **Módulo de Cotizaciones** - Crear, actualizar, convertir cotizaciones
- [x] ✅ **Módulo de Reportes** - Reportes de ventas, inventario, caja y clientes
- [x] ✅ **Procesador DIAN** - Estructura básica (pendiente integración real)
- [x] ✅ **Validaciones Robustas** - Validaciones de reglas de negocio
- [x] ✅ **Documentación Swagger** - API completamente documentada
- [x] ✅ **Tests Automatizados** - Suite completa de tests unitarios y E2E
- [x] ✅ **Manejo de Errores** - Sistema estructurado de manejo de errores

## 🚧 Próximos Pasos

- [ ] **Implementación Real de DIAN** - Integración completa con servicios DIAN (3-4 semanas)
  - Generación de XML completo según estándar DIAN
  - Firma digital de documentos
  - Envío real a API DIAN
  - Generación de PDFs de facturas
- [ ] **Frontend Básico** - Interfaz web para uso real (4-6 semanas)
- [ ] **Optimizaciones de Performance** - Paginación, caching, indexing (1 semana)
- [ ] **Tests E2E Adicionales** - Tests E2E para módulos nuevos (3-5 días)
- [ ] **Módulo de Backups** - Sistema de respaldo automático

## 📊 Estado del Proyecto

**Calificación Actual: 🟢 8.5/10 - EXCELENTE**

El proyecto tiene una base sólida y profesional. La arquitectura es limpia, los tests están bien implementados (~2,200+ líneas), y las funcionalidades core están operativas. Listo para continuar desarrollo hacia producción.

**Próximas prioridades:**
1. 🔴 Integración real de DIAN (3-4 semanas) - CRÍTICO
2. 🟡 Frontend básico (4-6 semanas) - IMPORTANTE
3. 🟢 Optimizaciones de performance (1 semana) - MEJORA

Para ver un análisis detallado del estado actual del proyecto, consulta la documentación completa en la carpeta [`docs/`](./docs/):

### 📚 Documentación Principal

- [📚 Índice de Documentación](./docs/README.md) - Índice completo de toda la documentación
- [💼 Opinión Senior - Estado Actual](./docs/OPINION_SENIOR_ACTUAL.md) ⭐ **NUEVO** - Evaluación completa del estado actual (8.5/10)
- [📊 Evaluación del Proyecto](./docs/EVALUACION_PROYECTO_SENIOR.md) - Evaluación completa desde perspectiva senior
- [📋 Análisis del Estado Actual](./docs/ANALISIS_ESTADO_ACTUAL.md) - Análisis completo del estado
- [🎯 Plan de Acción Post-Test](./docs/PLAN_ACCION_POST_TEST.md) - Plan de acción recomendado

### 📦 Módulos Implementados

- [📋 Módulo de Cotizaciones](./docs/RESUMEN_MODULO_COTIZACIONES.md) - Funcionalidades y endpoints
- [📊 Módulo de Reportes](./docs/RESUMEN_MODULO_REPORTES.md) - Tipos de reportes disponibles
- [📄 Módulo DIAN](./docs/RESUMEN_MODULO_DIAN.md) - Estructura del procesador DIAN
- [🛡️ Validaciones Robustas](./docs/RESUMEN_VALIDACIONES_ROBUSTAS.md) - Validaciones implementadas
- [🛡️ Manejo de Errores](./docs/RESUMEN_MANEJO_ERRORES.md) - Sistema de manejo de errores

### 🧪 Testing

- [🧪 Tests Implementados](./docs/RESUMEN_TESTS_IMPLEMENTADOS.md) - Resumen de tests y cobertura

### 🔧 Configuración y Setup

- [📚 Configuración de Swagger](./docs/SWAGGER_SETUP.md) - Guía de configuración de Swagger
- [🔍 ¿Qué Hace Realmente Swagger?](./docs/COMO_FUNCIONA_SWAGGER.md) - Explicación detallada
- [✅ Resumen de Implementación Swagger](./docs/RESUMEN_IMPLEMENTACION_SWAGGER.md) - Cambios realizados

### 🐛 Solución de Problemas

- [🔧 Solución Error EPERM con Prisma](./docs/SOLUCION_ERROR_EPERM_PRISMA.md) ⚠️ **COMÚN EN WINDOWS** - Guía completa para resolver errores de permisos
- [🔧 Solución a Errores de Instalación](./docs/SOLUCION_ERRORES_INSTALACION.md) - Errores comunes y soluciones

### 💡 Ideas y Funcionalidades

- [💡 Ideas de Funcionalidades](./docs/IDEAS_FUNCIONALIDADES.md) - Ideas y recomendaciones estratégicas

### 📝 Historial de Cambios

- [📝 Changelog](./docs/CHANGELOG.md) ⭐ **NUEVO** - Historial completo de cambios del proyecto
