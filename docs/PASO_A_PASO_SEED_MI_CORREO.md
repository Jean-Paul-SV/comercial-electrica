# Paso a paso: poner tu correo como administrador del Panel proveedor

Sigue estos pasos en orden. El seed creará tu usuario para entrar al Panel proveedor (gestión de empresas).

---

## Opción A: Base de datos vacía desde 0 (solo tu usuario)

Si quieres **borrar todo** y dejar la base con **solo** el usuario que pones en el `.env` (0 empresas, sin datos de prueba):

### 1. En el `.env` (raíz del proyecto)

Pon **solo** tu correo y contraseña (mínimo 8 caracteres):

```env
PLATFORM_ADMIN_EMAIL="tu-email@ejemplo.com"
PLATFORM_ADMIN_PASSWORD="TuPasswordSeguro123!"
```

Con eso el seed entra en modo “todo vacío”: crea solo permisos, roles, un plan y **tu usuario**. No hace falta `SEED_ONLY_PLATFORM_ADMIN=true` (se activa solo al tener estas variables).

### 2. Base de datos y Redis en marcha

```bash
npm run db:up
```

### 3. Reset completo + seed (borra todo y crea solo lo mínimo + tu usuario)

Desde la **raíz del proyecto**:

```bash
npm run prisma:migrate:reset -w api
```

(El comando usa `--force`: no pide confirmación y borra todos los datos. Cuando pregunte **“Do you want to continue? All data will be lost.”** escribe **`y`**.

Eso hace:

- Borra la base de datos.
- Vuelve a aplicar todas las migraciones.
- Ejecuta el seed: con `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` en `.env` se crean solo plan mínimo, permisos, roles y **tu usuario**. No se crea ninguna empresa ni otro usuario; el panel queda con 0 empresas.

### 4. Comprobar

```bash
npm run dev
```

Abre **http://localhost:3001**, inicia sesión con tu correo y contraseña. Deberías ver **Panel proveedor** (Empresas, Nueva empresa, Planes). Desde ahí podrás dar de alta las empresas que quieras.

**Resumen Opción A:**

```bash
# 1. En .env: PLATFORM_ADMIN_EMAIL y PLATFORM_ADMIN_PASSWORD (todo vacío, solo tu acceso)
# 2.
npm run db:up
# 3. Confirmar con "y" cuando pregunte
npm run prisma:migrate:reset -w api
# 4. Probar
npm run dev
```

---

## Opción B: Añadir tu usuario sin borrar la base (seed con datos de prueba)

Si **no** quieres borrar la base y quieres tenant por defecto + admin de negocio (admin@negocio.local), **no** definas `PLATFORM_ADMIN_EMAIL` en el `.env` (o coméntalo). Así el seed crea también la empresa por defecto y el usuario de negocio. Luego ejecuta el seed según los pasos siguientes.

---

## Paso 1. Base de datos y Redis en marcha

Asegúrate de que PostgreSQL y Redis están levantados (por ejemplo con Docker):

```bash
npm run db:up
```

Si ya los tienes corriendo, no hace falta repetirlo.

---

## Paso 2. Abrir el archivo `.env`

En la **raíz del proyecto** (carpeta `Comercial-Electrica`), abre el archivo **`.env`**.

---

## Paso 3. Añadir tu correo y contraseña

Busca la sección **"Dueño del sistema (Panel proveedor)"**. Verás dos líneas comentadas:

```
# PLATFORM_ADMIN_EMAIL="tu-correo@ejemplo.com"
# PLATFORM_ADMIN_PASSWORD="TuContraseñaSegura123!"
```

Haz lo siguiente:

1. **Quita el `#`** al inicio de cada línea (para que dejen de estar comentadas).
2. **Sustituye** `tu-correo@ejemplo.com` por **tu correo real** (el que usarás para entrar al Panel proveedor).
3. **Sustituye** `TuContraseñaSegura123!` por **una contraseña segura** (mínimo 8 caracteres).

Ejemplo (con un correo ficticio):

```
PLATFORM_ADMIN_EMAIL="paulo@miempresa.com"
PLATFORM_ADMIN_PASSWORD="MiClaveSegura2025!"
```

Guarda el archivo `.env`.

---

## Paso 4. Aplicar migraciones (si es la primera vez o hay cambios)

Desde la **raíz del proyecto**, en la terminal:

```bash
npm run prisma:migrate:deploy -w api
```

Si ya tenías la base migrada y no hay migraciones pendientes, puede decir que no hay nada que hacer. Está bien.

---

## Paso 5. Ejecutar el seed

Desde la **raíz del proyecto**, en la terminal:

```bash
npm run prisma:seed -w api
```

Deberías ver mensajes en consola indicando que se crearon roles, permisos, plan, tenant por defecto y algo como:

- `Admin de plataforma creado: tu-correo@ejemplo.com`

(o que se actualizó si ya existía).

---

## Paso 6. Comprobar que entras con tu correo

1. Si la API y la web no están corriendo, levántalas:
   ```bash
   npm run dev
   ```
2. Abre la web (por ejemplo **http://localhost:3001**).
3. Inicia sesión con:
   - **Email:** el que pusiste en `PLATFORM_ADMIN_EMAIL`
   - **Contraseña:** la que pusiste en `PLATFORM_ADMIN_PASSWORD`
4. Deberías ver en el menú lateral la sección **Panel proveedor** (Empresas, Nueva empresa, Planes).

---

## Resumen de comandos (en orden)

```bash
# 1. Subir BD y Redis (si hace falta)
npm run db:up

# 2. Migraciones
npm run prisma:migrate:deploy -w api

# 3. Seed con tu correo (después de editar .env)
npm run prisma:seed -w api

# 4. Levantar app (si no está ya)
npm run dev
```

---

## Si algo falla

- **"Cannot find module" o error de Prisma:** ejecuta antes `npm run prisma:generate -w api`.
- **Error de conexión a la base de datos:** revisa que `DATABASE_URL` en `.env` sea correcta y que PostgreSQL esté en marcha (`npm run db:up`).
- **El seed se ejecutó pero no veo Panel proveedor:** confirma que en `.env` las dos variables están **sin `#`** y que la contraseña tiene al menos 8 caracteres. Vuelve a ejecutar `npm run prisma:seed -w api` y luego cierra sesión y entra de nuevo con tu correo.

---

## En producción (Render, etc.)

Para que al subir el proyecto la base de datos quede vacía excepto tu usuario, en el **panel del hosting** (Environment de la API) configura:

- `PLATFORM_ADMIN_EMAIL` = tu correo
- `PLATFORM_ADMIN_PASSWORD` = tu contraseña
- `SEED_ONLY_PLATFORM_ADMIN` = `true`

El `.env` de tu PC no se usa en producción; esas variables deben estar en Render (o el proveedor que uses). En el primer despliegue se ejecutan migraciones + seed; con `SEED_ONLY_PLATFORM_ADMIN=true` solo se creará tu usuario. Ver `docs/DOMINIO_HOSTINGER_Y_PANEL_PROVEEDOR.md`.
