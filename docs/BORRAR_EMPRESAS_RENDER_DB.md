# Borrar empresas en la base de datos de Render (dejar solo tu correo)

Si quieres **eliminar todas las empresas (tenants)** de la base de datos en Render y **dejar solo tu usuario** (tu correo), sigue estos pasos.

## Qué se borra

- **Todas las empresas (Tenant)** y, por las reglas de la base de datos, todo lo que depende de ellas: productos, ventas, caja, cotizaciones, facturas, clientes, proveedores, inventario, sesiones de caja, gastos, configuración DIAN, etc.
- **Todos los usuarios excepto el que tú indiques por correo.**

## Qué se mantiene

- **Tu usuario** (el que identifiques por email).
- **Planes** (tabla `Plan`): no se tocan; puedes seguir usándolos en el panel proveedor.
- **AddOns, Permissions, Roles del sistema** y tablas globales como `StripeEvent`.

---

## Pasos en Render

### 1. Conectar a la base de datos

1. Entra en [Render](https://dashboard.render.com) → tu **PostgreSQL** (base de datos).
2. En la pestaña **"Info"** copia la **External Database URL** (para conectar desde tu PC o TablePlus).
3. Opciones para ejecutar SQL:
   - **TablePlus (recomendado):** nueva conexión PostgreSQL; pega host, puerto 5432, usuario, contraseña y nombre de BD de la URL; activa **SSL**. Luego abre una pestaña Query y ejecuta el SQL.
   - **Shell de Render:** en la misma página del servicio de BD, abre **"Shell"** y usa `psql $DATABASE_URL` (o pega la URL cuando te la pida).
   - **Desde tu PC con psql:**  
     `psql "postgresql://usuario:contraseña@host/database?sslmode=require"`

### 2. Ejecutar el SQL

Sustituye **`tu@correo.com`** por el correo del usuario que quieres conservar (por ejemplo el admin de plataforma).

```sql
-- 1) Borrar todas las empresas. Por cascade se borra todo lo asociado (productos, ventas, caja, etc.).
DELETE FROM "Tenant";

-- 2) Borrar todos los usuarios excepto el tuyo (cambia el correo por el que quieras mantener).
DELETE FROM "User" WHERE email != 'tu@correo.com';
```

Ejemplo si tu correo es `jean.serratov@orion.com`:

```sql
DELETE FROM "Tenant";
DELETE FROM "User" WHERE email != 'jean.serratov@orion.com';
```

### 3. Comprobar

- En la app (panel proveedor) no debería haber empresas.
- Solo deberías poder iniciar sesión con el correo que dejaste.

---

## Si quieres dejar más de un usuario

En lugar de un solo correo, puedes conservar varios:

```sql
DELETE FROM "Tenant";
DELETE FROM "User" WHERE email NOT IN (
  'admin@orion.com',
  'otro@orion.com'
);
```

---

## Si la tabla User quedó vacía (0 usuarios)

Si al hacer `SELECT * FROM "User"` ves **0 rows**, no queda ningún usuario y no podrás entrar. Crea de nuevo tu usuario ejecutando el **seed** contra la base de Render:

### 1. En el `.env` de la raíz del proyecto

Pon tu correo y una contraseña nueva (mínimo 8 caracteres):

```env
PLATFORM_ADMIN_EMAIL="jean.serratov@orion.com"
PLATFORM_ADMIN_PASSWORD="TuContraseñaSegura123!"
```

### 2. Apuntar a la base de Render

Asegúrate de que `DATABASE_URL` en el `.env` sea la **External Database URL** de Render (la misma que usas en TablePlus). Si sueles tener la URL local, cambia temporalmente a la de Render o crea un `.env.render` y úsalo solo para este comando.

### 3. Ejecutar el seed (solo crea tu usuario y lo mínimo)

Desde la **raíz del proyecto**:

```bash
npm run prisma:seed -w api
```

Eso crea (si no existen) el plan "Todo incluido", permisos, roles y **tu usuario** con el correo y contraseña del `.env`. No borra nada más; si ya no hay empresas, la base queda con 0 empresas y solo tu usuario.

### 4. Comprobar

En TablePlus: `SELECT id, email, name, role FROM "User";` — debe salir 1 fila con tu correo. Luego entra en la app (Vercel) con ese correo y la contraseña que pusiste en `PLATFORM_ADMIN_PASSWORD`.

---

## Importante

- **Haz backup** de la base de datos en Render antes si necesitas recuperar algo (Render permite backups desde el dashboard).
- No hace falta tocar **Planes** ni **Permissions**; al borrar solo `Tenant` y el resto de usuarios, el panel proveedor seguirá funcionando con tu usuario y podrás crear empresas nuevas cuando quieras.
