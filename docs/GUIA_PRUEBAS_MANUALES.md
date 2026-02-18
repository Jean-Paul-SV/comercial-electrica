# Guía de pruebas manuales

Pasos para probar manualmente los cambios recientes y los flujos principales de la aplicación.

---

## Qué te falta por testear (lista rápida)

Sigue este orden. Marca cada ítem cuando lo hayas probado.

1. **Preparación** — Levantar BD (`npm run db:up`), seed si hace falta (`npm run prisma:seed -w api`), arrancar app (`npm run dev`).
2. **Login** — Entrar con `admin@negocio.local` / `AdminNegocio1!` y con `platform@proveedor.local` / `PlatformProveedor1!`.
3. **Razón social** — En Panel proveedor → Nueva empresa: crear una empresa con y otra sin razón social; luego, como admin de esa empresa, ir a Configuración → Facturación electrónica y comprobar que Razón social se ve en solo lectura (o "No definida").
4. **Facturas** — En un tenant con razón social, hacer una venta y ver/imprimir factura; comprobar que sale el nombre de la empresa.
5. **Gastos** — Ir a Gastos, crear 2–3 gastos y comprobar que el listado va por orden de llegada (el último creado primero).
6. **Proveedores** — Editar un proveedor (secciones Datos básicos, Contacto, Ubicación) y crear uno nuevo; comprobar que se guarda bien.
7. **Ventas** — Registrar una venta, revisar resumen e imprimir factura; en Facturas comprobar que aparece (y si es local, que diga "Local").
8. **Caja (opcional)** — Abrir Caja, ver sesión o abrir una, y comprobar que los movimientos se ven bien.

Cuando termines los puntos 1–7 (u 8 si quieres), has cubierto todo lo que hace falta testear manualmente.

---

## 1. Preparación del entorno

### 1.1 Base de datos y servicios

```powershell
# En la raíz del proyecto
cd c:\Users\paulk\Desktop\Proyecto\Comercial-Electrica

# Levantar PostgreSQL y Redis (Docker)
npm run db:up

# Si la BD está vacía: crear usuario y estructura mínima (tu correo desde .env)
npm run prisma:seed -w api
```

### 1.2 Migraciones

```powershell
# Ver estado de migraciones
npm run prisma:migrate:status

# Si hay pendientes, aplicar
cd apps/api
npx prisma migrate deploy
cd ../..
```

### 1.3 Iniciar la aplicación

```powershell
# API + Web a la vez (recomendado)
npm run dev
```

- **API:** por defecto en `http://localhost:3000` (o el `PORT` que tengas en `.env` del API).
- **Web:** por defecto en `http://localhost:3001` (Next.js usa otro puerto si el 3000 está ocupado).

Comprueba en la consola en qué URL arranca cada uno. Si el frontend usa otra URL para la API, configura `NEXT_PUBLIC_API_BASE_URL` en `apps/web/.env.local`.

### 1.4 Credenciales de prueba

| Rol | Email | Contraseña |
|-----|--------|------------|
| **Panel proveedor** (plataforma) | `platform@proveedor.local` | `PlatformProveedor1!` |
| **Admin del negocio** (tenant) | `admin@negocio.local` | `AdminNegocio1!` |

---

## 2. Pruebas por funcionalidad

### 2.1 Login y acceso

- [ ] Abrir la URL del frontend (ej. `http://localhost:3001`).
- [ ] Iniciar sesión con **admin del negocio**: `admin@negocio.local` / `AdminNegocio1!`.
- [ ] Comprobar que entras al dashboard del tenant (ventas, gastos, facturas, etc.).
- [ ] Cerrar sesión e iniciar con **panel proveedor**: `platform@proveedor.local` / `PlatformProveedor1!`.
- [ ] Comprobar que ves el panel de proveedor (empresas, planes, etc.).

---

### 2.2 Nombre de la empresa (razón social) — solo al crear tenant

**Como admin de plataforma (panel proveedor):**

- [ ] Ir a **Panel proveedor** → **Nueva empresa** (o equivalente).
- [ ] Comprobar que existe el campo **"Razón social para facturas"** (opcional).
- [ ] Crear una empresa **con** razón social (ej. "Mi Comercio S.A.S.") y otra **sin** razón social.
- [ ] Comprobar que en ambos casos la empresa se crea correctamente.

**Como admin del negocio (tenant) — empresa creada CON razón social:**

- [ ] Entrar con el usuario admin del tenant recién creado (el que configuraste en "Nueva empresa").
- [ ] Ir a **Configuración** → **Facturación electrónica**.
- [ ] En **Datos del emisor**, comprobar que **Razón social** se muestra en **solo lectura** con el nombre que pusiste al crear la empresa.
- [ ] Comprobar que el texto indica que la razón social se establece al crear la empresa y que para cambiarla hay que contactar al administrador.

**Como admin del negocio — empresa creada SIN razón social:**

- [ ] Entrar con un tenant que se creó sin razón social.
- [ ] Ir a **Configuración** → **Facturación electrónica**.
- [ ] Comprobar que en Razón social se muestra algo como "No definida (aparecerá 'Mi Empresa' en facturas)" y que el campo no es editable.

**Facturas:**

- [ ] En un tenant con razón social configurada, registrar una venta y abrir o imprimir la factura.
- [ ] Comprobar que el nombre que aparece es el de la razón social configurada al crear el tenant, no "Mi Empresa" (salvo que no se haya definido).

---

### 2.3 Gastos — orden por llegada

- [ ] Iniciar sesión como **admin del negocio**.
- [ ] Ir a **Gastos**.
- [ ] Comprobar que el listado está ordenado por **orden de llegada** (los más recientes primero), no por monto.
- [ ] Registrar 2–3 gastos con montos distintos y fechas iguales (o misma fecha).
- [ ] Comprobar que el último gasto creado aparece primero en la lista.

---

### 2.4 Proveedores — formularios más intuitivos

**Editar proveedor:**

- [ ] Ir a **Proveedores**.
- [ ] Pulsar **Editar** en un proveedor.
- [ ] Comprobar que el modal muestra secciones: **Datos básicos** (NIT, Razón social), **Información de contacto** (Email, Teléfono, Persona de contacto), **Ubicación** (Dirección).
- [ ] Comprobar que los campos obligatorios tienen asterisco (*).
- [ ] Cambiar un dato, guardar y comprobar que se actualiza correctamente.

**Nuevo proveedor:**

- [ ] Pulsar **Nuevo proveedor**.
- [ ] Comprobar que las mismas secciones aparecen (Datos básicos, Información de contacto, Ubicación).
- [ ] Crear un proveedor con NIT y Razón social; opcionalmente completar contacto y dirección.
- [ ] Comprobar que se crea y aparece en el listado.

---

### 2.5 Ventas y facturas (flujo básico)

- [ ] Ir a **Ventas**.
- [ ] Registrar una venta con al menos un producto y cliente (si aplica).
- [ ] Comprobar que se muestra el resumen y que puedes imprimir/ver la factura.
- [ ] Ir a **Facturas** y comprobar que la factura aparece en la lista.
- [ ] Si probaste venta "local" (sin factura electrónica): comprobar que en Facturas se muestra como **Local** (o el criterio que tengas para documento interno).

---

### 2.6 Caja (opcional)

- [ ] Ir a **Caja**.
- [ ] Si hay sesión abierta, comprobar que se ven movimientos y totales.
- [ ] Si no hay sesión, abrir una y registrar un movimiento o una venta en efectivo y comprobar que se refleja.

---

## 3. Resumen de lo que estás validando

| Cambio reciente | Dónde probar | Qué validar |
|-----------------|--------------|-------------|
| Razón social solo al crear tenant | Panel proveedor → Nueva empresa; Configuración → Facturación electrónica | Campo opcional al crear; solo lectura en configuración DIAN |
| Orden de gastos por llegada | Gastos | Listado ordenado por fecha de creación (más recientes primero) |
| Formularios de proveedores | Proveedores → Editar / Nuevo proveedor | Secciones claras y mismos campos en crear/editar |

---

## 4. Si algo falla

- **API no arranca:** Revisar que PostgreSQL y Redis estén levantados (`npm run db:up`) y que no haya otro proceso usando el puerto del API.
- **Web no conecta al API:** Revisar `NEXT_PUBLIC_API_BASE_URL` en `apps/web/.env.local` (debe apuntar a la URL del API, ej. `http://localhost:3000`).
- **Error de base de datos:** Ejecutar `npm run prisma:migrate:status` y, si hay migraciones pendientes, `npx prisma migrate deploy` dentro de `apps/api`.
- **Credenciales no funcionan:** Asegurarse de haber ejecutado el seed (`npm run prisma:seed -w api`) y de tener `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` en `.env` si quieres entrar con tu correo.

Cuando termines las pruebas, puedes usar esta guía como checklist marcando cada ítem.
