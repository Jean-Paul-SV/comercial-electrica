# 🚀 Guía Paso a Paso para Ejecutar el Programa

> **Fecha:** Enero 2026  
> **Sistema:** Comercial Eléctrica - Backend API

---

## 📋 **REQUISITOS PREVIOS**

Antes de comenzar, asegúrate de tener instalado:

- ✅ **Node.js** (v18 o superior)
- ✅ **npm** (v9 o superior)
- ✅ **Docker Desktop** (para Postgres y Redis)
- ✅ **Git** (opcional, para clonar el repositorio)

---

## 🔧 **PASO 1: Verificar Docker Desktop**

### 1.1 Abrir Docker Desktop

1. Abre **Docker Desktop** en tu sistema
2. Espera a que esté completamente iniciado (ícono verde en la bandeja del sistema)

### 1.2 Verificar que Docker está corriendo

```powershell
docker ps
```

**Resultado esperado:** Deberías ver una lista de contenedores (puede estar vacía si no hay contenedores corriendo)

---

## 🐳 **PASO 2: Iniciar Servicios (Postgres y Redis)**

### 2.1 Navegar a la carpeta de infraestructura

```powershell
cd infra
```

### 2.2 Iniciar los servicios con Docker Compose

```powershell
docker-compose up -d
```

**Resultado esperado:**
```
Creating network "infra_default" ... done
Creating ce_postgres ... done
Creating ce_redis    ... done
```

### 2.3 Verificar que los servicios están corriendo

```powershell
docker-compose ps
```

**Resultado esperado:**
```
NAME          IMAGE              STATUS
ce_postgres   postgres:16        Up (healthy)
ce_redis      redis:7-alpine     Up (healthy)
```

---

## ⚙️ **PASO 3: Configurar Variables de Entorno**

### 3.1 Navegar a la raíz del proyecto

```powershell
cd ..
```

### 3.2 Copiar el archivo de ejemplo

```powershell
Copy-Item env.example .env
```

### 3.3 Editar el archivo .env

Abre el archivo `.env` con tu editor favorito y verifica/ajusta las siguientes variables:

```env
## API
PORT=3000

## Database (PostgreSQL)
DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"

## Auth
JWT_ACCESS_SECRET="cambiar-por-un-secret-seguro-y-aleatorio"
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_SECRET="cambiar-por-otro-secret-seguro-y-aleatorio"
JWT_REFRESH_TTL_SECONDS=1209600

## Redis (BullMQ y Cache)
REDIS_URL="redis://localhost:6379"
CACHE_TTL_SECONDS=300

## Backups
BACKUP_DIR="./backups"
AUTO_BACKUP_ENABLED=false
MAX_BACKUPS_TO_KEEP=30

## Validation Limits
MAX_INVENTORY_QTY=1000000
MIN_INVENTORY_QTY=0
MAX_CASH_AMOUNT=100000000
MIN_CASH_AMOUNT=0
MAX_OPENING_AMOUNT=50000000
MAX_ITEMS_PER_SALE=100
MAX_ITEMS_PER_QUOTE=100
MAX_QTY_PER_ITEM=10000
```

**⚠️ IMPORTANTE:** Cambia los valores de `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` por valores seguros y aleatorios.

---

## 📦 **PASO 4: Instalar Dependencias**

### 4.1 Navegar a la raíz del proyecto (IMPORTANTE)

```powershell
cd "c:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"
```

**⚠️ IMPORTANTE:** Este proyecto usa **npm workspaces**, por lo que **SIEMPRE** debes ejecutar comandos desde la raíz del proyecto, NO desde `apps/api`.

### 4.2 Instalar dependencias

```powershell
npm install
```

**Resultado esperado:** Las dependencias se instalarán sin errores

**⏱️ Tiempo estimado:** 2-5 minutos

**❌ ERROR COMÚN:** Si ejecutas `npm install` desde `apps/api`, obtendrás el error:
```
npm error Cannot read properties of null (reading 'location')
```

**✅ SOLUCIÓN:** Siempre ejecuta desde la raíz del proyecto.

---

## 🗄️ **PASO 5: Configurar Base de Datos**

### 5.1 Generar cliente de Prisma

**Desde la raíz del proyecto:**

```powershell
npm run prisma:generate
```

**Resultado esperado:** 
```
✔ Generated Prisma Client
```

**❌ ERROR COMÚN 1 - "Could not resolve @prisma/client":**
Si obtienes el error:
```
Error: Could not resolve @prisma/client despite the installation that we just tried.
Please try to install it by hand with npm i @prisma/client and rerun npx "prisma generate" 🙏.
```

**✅ SOLUCIONES:**

1. **Instalar @prisma/client manualmente en el workspace:**
   ```powershell
   npm install @prisma/client -w api
   npm run prisma:generate
   ```

2. **Reinstalar todas las dependencias:**
   ```powershell
   npm install
   npm run prisma:generate
   ```

3. **Si persiste, instalar desde el directorio api:**
   ```powershell
   cd apps\api
   npm install @prisma/client
   npx prisma generate
   cd ..\..
   ```

**❌ ERROR COMÚN 2 - EPERM:**
Si obtienes el error:
```
EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...'
```

**✅ SOLUCIONES:**

1. **Cerrar Cursor y ejecutar como Administrador:**
   - Cierra completamente Cursor/VS Code
   - Abre PowerShell como Administrador
   - Ejecuta: `npm run prisma:generate`

2. **Esperar 1-2 minutos** (Windows Defender puede estar escaneando)

3. **Eliminar carpeta .prisma manualmente:**
   ```powershell
   Remove-Item -Recurse -Force "apps\api\node_modules\.prisma" -ErrorAction SilentlyContinue
   npm run prisma:generate
   ```

4. **Ver más soluciones en:** `docs/SOLUCION_ERROR_NPM.md`

### 5.2 Ejecutar migraciones

**Desde la raíz del proyecto:**

```powershell
npm run prisma:migrate
```

**Resultado esperado:**
```
✔ Migrations applied successfully
```

---

## 🧪 **PASO 6: (Opcional) Ejecutar Tests**

### 6.1 Tests Unitarios

**Desde la raíz del proyecto:**

```powershell
npm run test -w api
```

O desde el directorio api:

```powershell
cd apps\api
npm run test
cd ..\..
```

**Resultado esperado:** Todos los tests deberían pasar (67/67)

### 6.2 Tests E2E

**Desde la raíz del proyecto:**

```powershell
npm run test:e2e -- --runInBand
```

O desde el directorio api:

```powershell
cd apps\api
npm run test:e2e -- --runInBand
cd ..\..
```

**Resultado esperado:** Los tests E2E deberían pasar (puede tomar varios minutos)

---

## 🚀 **PASO 7: Iniciar el Servidor**

### 7.1 Modo Desarrollo (con hot-reload)

```powershell
npm run start:dev
```

**Resultado esperado:**
```
[Nest] 12345  - 27/01/2026, 10:00:00 p. m.     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 27/01/2026, 10:00:01 p. m.     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 27/01/2026, 10:00:02 p. m.     LOG [NestApplication] Nest application successfully started
[Nest] 12345  - 27/01/2026, 10:00:02 p. m.     LOG [RoutesResolver] /api mapped to {/api}
```

### 7.2 Verificar que el servidor está corriendo

Abre tu navegador y visita:

```
http://localhost:3000
```

**Resultado esperado:** Deberías ver el mensaje:
```json
"Sistema Comercial Eléctrica API v1.0"
```

---

## 📚 **PASO 8: Acceder a Swagger (Documentación API)**

### 8.1 Abrir Swagger UI

Abre tu navegador y visita:

```
http://localhost:3000/api
```

**Resultado esperado:** Deberías ver la interfaz de Swagger con todos los endpoints documentados

### 8.2 Crear Usuario Admin

1. En Swagger, busca el endpoint `POST /auth/bootstrap-admin`
2. Haz clic en "Try it out"
3. Ingresa los datos:
   ```json
   {
     "email": "admin@example.com",
     "password": "Admin123!"
   }
   ```
4. Haz clic en "Execute"
5. Deberías recibir un código 201 con el usuario creado

### 8.3 Login y Obtener Token

1. Busca el endpoint `POST /auth/login`
2. Haz clic en "Try it out"
3. Ingresa los mismos datos:
   ```json
   {
     "email": "admin@example.com",
     "password": "Admin123!"
   }
   ```
4. Haz clic en "Execute"
5. Copia el `accessToken` de la respuesta

### 8.4 Usar el Token en Swagger

1. En la parte superior de Swagger, haz clic en el botón **"Authorize"** 🔒
2. Pega el token en el campo `Value`
3. Haz clic en "Authorize"
4. Ahora puedes probar todos los endpoints protegidos

---

## ✅ **VERIFICACIÓN FINAL**

### Checklist de Verificación

- [ ] Docker Desktop está corriendo
- [ ] Postgres y Redis están corriendo (`docker-compose ps`)
- [ ] Archivo `.env` configurado correctamente
- [ ] Dependencias instaladas (`npm install`)
- [ ] Base de datos migrada (`npm run prisma:migrate`)
- [ ] Servidor iniciado (`npm run start:dev`)
- [ ] Health check responde (`http://localhost:3000`)
- [ ] Swagger accesible (`http://localhost:3000/api`)
- [ ] Usuario admin creado
- [ ] Token obtenido y configurado en Swagger

---

## 🎯 **PRÓXIMOS PASOS**

Una vez que el servidor esté corriendo:

1. **Explorar Swagger:** Prueba los diferentes endpoints desde la interfaz de Swagger
2. **Crear Datos de Prueba:** Crea productos, clientes, etc.
3. **Probar Flujos Completos:** Crea cotizaciones, conviértelas en ventas, etc.
4. **Revisar Logs:** Observa los logs en la consola para ver cómo funciona el sistema

---

## 🚨 **SOLUCIÓN DE PROBLEMAS**

### Error: Docker no está corriendo

**Solución:**
```powershell
# Iniciar Docker Desktop manualmente
# Luego verificar:
docker ps
```

### Error: Puerto 3000 ocupado

**Solución:**
1. Cambia el puerto en `.env`: `PORT=3001`
2. O cierra la aplicación que está usando el puerto 3000

### Error: Base de datos no conecta

**Solución:**
```powershell
# Verificar que Postgres está corriendo:
docker-compose ps

# Si no está corriendo:
cd infra
docker-compose up -d
```

### Error: Redis no conecta

**Solución:**
```powershell
# Verificar que Redis está corriendo:
docker-compose ps

# Si no está corriendo:
cd infra
docker-compose up -d redis
```

### Error: Migraciones fallan

**Solución:**
```powershell
# Limpiar y recrear la base de datos:
cd apps/api
npm run prisma:migrate reset
```

### Error: Tests fallan

**Solución:**
```powershell
# Limpiar caché de Jest:
Remove-Item -Recurse -Force "$env:TEMP\jest" -ErrorAction SilentlyContinue

# Ejecutar tests en serie:
npm run test -- --runInBand
```

---

## 📝 **COMANDOS RÁPIDOS DE REFERENCIA**

```powershell
# Iniciar servicios Docker
cd infra
docker-compose up -d

# Ver estado de servicios
docker-compose ps

# Detener servicios
docker-compose down

# Instalar dependencias
cd apps/api
npm install

# Generar Prisma Client
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate

# Iniciar servidor (desarrollo)
npm run start:dev

# Iniciar servidor (producción)
npm run build
npm run start:prod

# Ejecutar tests unitarios
npm run test

# Ejecutar tests E2E
npm run test:e2e -- --runInBand

# Linting
npm run lint
```

---

## 🎉 **¡LISTO!**

Si has seguido todos los pasos correctamente, deberías tener:

- ✅ Servidor API corriendo en `http://localhost:3000`
- ✅ Swagger disponible en `http://localhost:3000/api`
- ✅ Base de datos configurada y migrada
- ✅ Redis funcionando para caché y colas
- ✅ Sistema listo para usar

**¿Necesitas ayuda?** Revisa la sección de "Solución de Problemas" o consulta la documentación adicional en la carpeta `docs/`.

---

**Última actualización:** Enero 2026
