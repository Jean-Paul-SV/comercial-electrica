# Cómo probar los cambios recientes

Guía para probar en local (o en entorno desplegado) todo lo implementado: DIAN por tenant, bloqueos, alertas, auditoría, roles finos, contingencia, panel proveedor y login.

---

## Requisitos previos

- **Base de datos** PostgreSQL (local con Docker o remota).
- **Redis** (para cola DIAN y caché). En local: `docker run -d -p 6379:6379 redis` o usar el `docker-compose` del repo.
- **Node** y dependencias instaladas (`npm install` en la raíz).

---

## 1. Levantar el entorno

### Base de datos (si usas Docker local)

```bash
# Desde la raíz del repo (si tienes docker-compose)
npm run db:up
```

En tu `.env` (raíz o `apps/api`):

```env
DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"
REDIS_URL="redis://localhost:6379"
```

### Migraciones y seed

```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

El seed crea plan "Todo incluido", tenant **default**, permisos (`dian:manage`, `dian:manage_certificate`), roles admin/user y los asigna. Si ya tenías usuarios, les asigna tenant y rol.

### Clave para certificados DIAN

En `.env`:

```env
DIAN_CERT_ENCRYPTION_KEY=<64 caracteres hex>
```

Generar una (Node): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Arrancar API y web

Desde la **raíz**:

```bash
npm run dev
```

- API: `http://localhost:3000` (o el `PORT` de tu `.env`)
- Web: `http://localhost:3001` (o el que use Next.js)

---

## 2. Usuarios para probar

### Admin de empresa (tenant default) – Facturación electrónica y ventas

Crear un usuario admin de tenant para probar DIAN y bloqueos:

```bash
cd apps/api
$env:DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"   # PowerShell
npx ts-node scripts/create-tenant-admin.ts
```

Queda **admin@local.dev** / **AdminLocal1!** (tenant default, rol ADMIN). Úsalo para:

- Cuenta → Facturación electrónica
- Registrar ventas (y ver el bloqueo si DIAN no está listo)
- Ver alertas (certificado por vencer, rango bajo) y diagnóstico "Qué hacer"

### Admin de plataforma – Panel proveedor

Para probar Empresas, Planes, Nueva empresa:

- Usuario **sin tenant** (o con el que identifiques admin de plataforma) y que pase el `PlatformAdminGuard`.
- El seed puede crear **platform@admin.local** si tienes `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` en el entorno al hacer seed; o configúralo en la BD (usuario con `tenantId` null y lógica de plataforma).

Inicia sesión y entra a **/provider** (la app suele redirigir ahí si eres admin de plataforma).

---

## 3. Qué probar (por flujo)

### 3.1 Facturación electrónica (DIAN) por empresa

1. Inicia sesión con **admin@local.dev** (o un admin de tenant con módulo facturación electrónica).
2. Ve a **Cuenta → Facturación electrónica**.
3. **Estado y diagnóstico**
   - Sin config: estado "No configurado" y tarjeta **"Qué hacer"** con pasos.
   - Rellena solo parte (ej. NIT y razón social) → estado "Incompleto" y "Qué hacer" con lo que falta.
4. **Plantilla**
   - Pulsa **"Aplicar plantilla: Pyme básico (habilitación)"** → prefijo FAC, rango 1–999999, ambiente Habilitación.
5. Completa emisor, Software ID/PIN, sube certificado .p12 (si tienes) y numeración. Guarda.
6. Comprueba estado **"Listo para facturar"** y, si aplica, **alertas** (certificado vence en X días, quedan Y números).
7. En otra página (p. ej. Inicio), comprueba el **banner de alertas** (si cert &lt; 30 días o rango &lt; 500).

### 3.2 Bloqueo al registrar venta si DIAN no está listo

1. Con el mismo usuario, **no completes** la config DIAN (o deja certificado sin subir).
2. Ve a **Ventas** e intenta **registrar una venta** (con sesión de caja abierta).
3. Debe aparecer un error tipo: *"Complete la configuración de facturación electrónica en Cuenta → Facturación electrónica..."*.
4. Deja DIAN **listo** y vuelve a intentar la venta → debe crearse y encolarse el envío DIAN.

### 3.3 Trazabilidad DIAN en detalle de venta

1. Con DIAN listo, registra una venta.
2. Entra al **detalle de la venta** (clic en la venta o en "Ver").
3. Debe aparecer la sección **"Facturación electrónica (DIAN)"** con estado (En cola, Enviado, Aceptado por DIAN, etc.) y, si hubo error, el mensaje DIAN.

### 3.4 Auditoría de cambios DIAN

1. En **Cuenta → Facturación electrónica** cambia algo (ej. NIT o prefijo) y guarda.
2. Sube o reemplaza el certificado .p12.
3. Si tienes **Auditoría** en la app, filtra por entidad **dian_config** y comprueba registros de tipo "update" y "upload_certificate" con tu usuario y fecha.  
   (En BD: tabla `AuditLog`, `entity = 'dian_config'`.)

### 3.5 Roles finos (dian:manage_certificate)

1. Crea un **rol** que tenga `dian:manage` pero **no** `dian:manage_certificate` (desde BD o desde la gestión de roles si existe).
2. Asigna ese rol a un usuario y entra con él.
3. En **Facturación electrónica** debería poder **ver** y editar datos no sensibles (ej. NIT, razón social).
4. Al **subir certificado** debe recibir **403** ("Se requiere permiso de gestión de certificado").
5. Al editar **numeración o PIN** (resolución, prefijo, rango, software PIN) también debe recibir **403** si no tiene `dian:manage_certificate`.

(Tras el seed, el rol **admin** tiene todos los permisos; para este flujo necesitas un rol sin `dian:manage_certificate`.)

### 3.6 Export reportes CSV

1. Inicia sesión con un usuario que tenga acceso a **Reportes** (módulo advanced_reports).
2. Ve a **Reportes**.
3. Arriba verás **"Exportar CSV: Ventas"** y **"Clientes"**.
4. Pulsa cada uno y comprueba que se descargue un CSV.

### 3.7 Modo contingencia DIAN

1. En `.env` de la API añade: `DIAN_CONTINGENCY_MODE=true`.
2. Reinicia la API.
3. Registra una venta (con DIAN config listo). El job DIAN se ejecutará pero **no** enviará a la DIAN; en logs debería verse algo como "Modo contingencia DIAN activo".
4. El documento debe quedar en **DRAFT**.
5. Quita la variable o ponla en `false`, reinicia y (si tienes forma de reencolar) vuelve a procesar; entonces sí debería enviar.

Ver también: `docs/CONTINGENCIA_DIAN.md`.

### 3.8 Alertas por email (cron DIAN)

- El cron corre **todos los días a las 08:00** (configurable en `DianAlertsScheduler`).
- Para probar sin esperar: llama desde código o un script al método `DianService.sendDianAlertsForTenants()` (por ejemplo con un endpoint temporal o desde una consola de debug).
- Requiere **SMTP** configurado en `.env` (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`). Si no está configurado, el método no envía y solo registra en log.

### 3.9 Panel proveedor (Empresas, Planes)

1. Inicia sesión como **admin de plataforma** (usuario que accede a `/provider`).
2. **Empresas:** listado con filtros Todas / Activas / Suspendidas, paginación, botón "Nueva empresa", icono ojo para detalle.
3. **Nueva empresa:** formulario con nombre, slug (puedes usar NIT, ej. `900123456-7`), plan, email admin; crear y comprobar que aparece en el listado.
4. **Detalle empresa:** desde el ojo, comprobar cambio de plan, suspender/activar, renovar suscripción.
5. **Planes:** listar y editar planes.

### 3.10 Login

1. Cierra sesión y entra en la **pantalla de login**.
2. Comprueba que se ve la tarjeta clara con logo Orion, "Acceso al sistema de gestión", campos Email y Contraseña, enlace "¿Olvidaste tu contraseña?" y botón "Iniciar sesión".
3. Inicia sesión con **admin@local.dev** (o platform admin) y que te redirija a /app o /provider según corresponda.

---

## 4. Resumen de comandos útiles

```bash
# Desde la raíz
npm run db:up              # Levantar PostgreSQL (y Redis si está en compose)
npm run dev                 # API + Web

# Desde apps/api
npx prisma migrate deploy   # Aplicar migraciones
npx prisma db seed          # Plan, tenant, permisos, roles
npx ts-node scripts/create-tenant-admin.ts   # admin@local.dev (requiere DATABASE_URL)
npx prisma studio           # Ver/editar BD (usuarios, roles, tenants)
```

---

## 5. Documentación relacionada

- **Facturación electrónica (config y pasos):** `docs/CONFIGURAR_FACTURACION_ELECTRONICA_PASOS.md`
- **Probar DIAN en local:** `docs/PROBAR_DIAN_LOCAL.md`
- **Contingencia y alertas email:** `docs/CONTINGENCIA_DIAN.md`
- **Render (producción):** `docs/DIAN_PRODUCCION_RENDER.md`
