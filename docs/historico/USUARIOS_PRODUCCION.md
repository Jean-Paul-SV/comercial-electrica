# Usuarios y contraseñas en producción

**Objetivo:** Cómo se crean los correos y contraseñas para que la gente ingrese al programa cuando ya está en producción.

---

## Cómo está hoy

Los usuarios **no se generan solos**. Hay dos formas de crearlos:

### 1. Primer usuario (solo la primera vez)

Cuando la base de datos **no tiene ningún usuario**, se crea el **primer administrador** con una sola llamada a la API:

| Paso | Qué hacer |
|------|-----------|
| 1 | Tener la API desplegada y la BD con migraciones aplicadas. |
| 2 | Llamar **POST /auth/bootstrap-admin** (sin estar logueado) con body: `{ "email": "admin@tudominio.com", "password": "TuContraseñaSegura" }`. |
| 3 | Ese correo y contraseña los **eliges tú** (o quien despliegue). No se generan automáticamente. |

- **Solo funciona una vez**: si ya existe al menos un usuario, la API responde 400 "Bootstrap ya fue realizado."
- No requiere token. Úsalo solo en el arranque inicial de producción (o en un entorno de staging para crear el primer admin).

**Ejemplo con curl:**

```bash
curl -X POST https://tu-api.com/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@miempresa.com","password":"MiClaveSegura123!"}'
```

Tras eso, ese usuario ya puede hacer **login** con ese mismo email y contraseña.

---

### 2. Resto de usuarios (ya hay al menos un admin)

Cuando ya existe el primer admin (o cualquier usuario con permiso **users:create**):

| Paso | Qué hacer |
|------|-----------|
| 1 | Un admin inicia sesión (login) y obtiene un **token JWT**. |
| 2 | Con ese token llama **POST /auth/users** con body: `{ "email": "nuevo@empresa.com", "password": "ContraseñaParaEseUsuario", "role": "USER" }`. |
| 3 | El **correo y la contraseña** los define quien crea el usuario (normalmente el admin, de acuerdo con el empleado o el usuario final). |

- **role** es opcional; si no se envía, se crea como USER. Valores: `ADMIN` o `USER`.
- El usuario recién creado puede entrar al programa con ese email y contraseña.

**Ejemplo con curl (sustituye TOKEN por el JWT del admin):**

```bash
curl -X POST https://tu-api.com/auth/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"email":"vendedor@miempresa.com","password":"ClaveVendedor123!","role":"USER"}'
```

En la **app web** (cuando esté implementada la pantalla de “Crear usuario”), el admin pondría el correo y la contraseña en un formulario y la app haría esta misma llamada por detrás.

---

## Varias empresas, varios usuarios: cómo se loguean

Todas las empresas y todos los usuarios **entran por el mismo sitio** y de la **misma forma**:

1. **Misma pantalla de login** (por ejemplo `https://app.tudominio.com` o la URL que uses).
2. **Mismo endpoint:** **POST /auth/login** con `{ "email": "correo@ejemplo.com", "password": "su_contraseña" }`.
3. No hay que elegir “empresa” ni “tenant” en el login. El sistema ya sabe a qué empresa pertenece cada usuario por su correo.

**Qué pasa por detrás:**

- Cada usuario tiene un **correo único en todo el sistema** (no puede haber dos usuarios con el mismo email en la base de datos).
- Cada usuario está asociado a **una empresa (tenant)**. Al hacer login, el backend busca al usuario por email, comprueba la contraseña y genera un JWT que incluye el **tenant** de ese usuario.
- A partir de ahí, todas las peticiones (productos, ventas, clientes, etc.) se filtran por ese tenant. El usuario de Empresa A solo ve datos de Empresa A; el de Empresa B solo los de Empresa B.

**Ejemplo:**

| Empresa   | Usuario        | Correo                | Al hacer login |
|-----------|-----------------|------------------------|----------------|
| Empresa A | Admin           | admin@empresa-a.com    | Entra y solo ve datos de Empresa A. |
| Empresa A | Vendedor        | juan@empresa-a.com     | Entra y solo ve datos de Empresa A. |
| Empresa B | Admin           | admin@empresa-b.com    | Entra y solo ve datos de Empresa B. |

Todos usan la **misma URL** y la **misma pantalla** (email + contraseña). La diferencia está en el correo: cada persona tiene su propio correo y contraseña; el sistema deduce la empresa por el usuario y no mezcla datos entre empresas.

**Importante:** El correo es **único en toda la plataforma**. Si dos empresas quieren un “admin@empresa.com”, tienen que usar correos distintos (por ejemplo `admin@empresa1.com` y `admin@empresa2.com`, o incluir el nombre de la empresa en el correo).

---

## Cómo asigna el sistema los roles

Hay **dos niveles**: un rol “legacy” en el usuario y, opcionalmente, roles RBAC (permisos por rol en base de datos).

### 1. Rol al crear el usuario

El rol se asigna **en el momento de crear** el usuario:

| Origen            | Rol que se asigna |
|-------------------|-------------------|
| **Bootstrap** (primer admin) | Siempre **ADMIN**. |
| **POST /auth/users** (registro por un admin) | El que venga en el body: `role: "ADMIN"` o `role: "USER"`. Si no se envía, se usa **USER**. |

Ejemplo al crear un usuario desde la API:

```json
{ "email": "vendedor@empresa.com", "password": "Clave123!", "role": "USER" }
```

o para un segundo administrador de la misma empresa:

```json
{ "email": "admin2@empresa.com", "password": "Clave123!", "role": "ADMIN" }
```

No hay otro flujo hoy para “elegir rol”: quien crea el usuario (bootstrap o admin con `users:create`) decide el rol en ese momento.

### 2. Qué hace cada rol (permisos)

- **ADMIN:** acceso total (bypass de permisos). Puede crear usuarios, acceder a reportes, auditoría, backups, etc.
- **USER:** permisos limitados (ventas, cotizaciones, caja, gastos, catálogo lectura, clientes, inventario lectura, reportes lectura, etc.). No puede, por ejemplo, crear otros usuarios ni gestionar backups si el endpoint exige `users:create` o `backups:manage`.

Los permisos se resuelven así:

1. Si el usuario tiene **roles RBAC** en base de datos (tabla `UserRole` → `Role` → `RolePermission`), se usan esos permisos.
2. Si no tiene roles RBAC (usuario recién creado por **POST /auth/users** y sin seed), se usa el **rol legacy** (`User.role`): ADMIN = todo, USER = lista fija de permisos en código.

El **seed** (cuando se ejecuta) crea los roles “admin” y “user” en BD y asigna a cada usuario existente su `UserRole` según su `User.role` (ADMIN → rol admin, USER → rol user). Así, tras el seed, los permisos pasan a salir de RBAC en BD.

### 3. ¿Se puede cambiar el rol después?

**Sí.** Existe **PATCH /auth/users/:id** (permiso `users:update`): permite actualizar el rol del usuario y/o su contraseña. En la pantalla **Administración → Usuarios** hay un botón “Editar rol” por cada usuario que abre un diálogo para cambiar rol y contraseña opcional.

Resumen: **el sistema asigna roles al crear el usuario** (bootstrap = ADMIN, registro = lo que envíes en `role`). Después, un admin con `users:update` puede cambiar el rol (y la contraseña) desde la API o desde la pantalla Usuarios.

---

## Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿Quién define correo y contraseña? | **Quien crea el usuario**: en el primer caso quien hace bootstrap, en el resto el admin (o usuario con users:create). |
| ¿Se generan solas? | **Opcional.** Al crear usuario se puede marcar “Generar contraseña temporal”; el sistema la genera y el usuario debe cambiarla en el primer login. Los correos los define quien crea el usuario. |
| ¿Hay registro público? | **No**. No hay “Registrarse” para cualquiera desde internet. |
| ¿Hay “invitar por correo” o “olvidé mi contraseña”? | **Sí.** Invitación (POST /auth/invite, aceptar en /accept-invite) y olvidé contraseña (POST /auth/forgot-password, reset con token). Ver sección siguiente. |

---

## Flujos ya implementados (usuarios y contraseñas)

Estos flujos **ya están** en la API y en el front:

1. ~~**“Olvidé mi contraseña”**~~  
   - ✅ **Hecho:** POST /auth/forgot-password (recibe email). Si SMTP está configurado, se envía el enlace por correo; si no, en desarrollo se devuelve el token en la respuesta. POST /auth/reset-password con token + nueva contraseña. Rate limit por email (3 solicitudes / 15 min). Páginas públicas: /forgot-password y /reset-password.

2. ~~**Invitación por correo**~~  
   - ✅ **Hecho:** El admin invita con POST /auth/invite (email, rol). Se genera un token de invitación (válido 7 días). El invitado abre el enlace /accept-invite?token=... y define su contraseña. En la pantalla Usuarios hay un formulario “Invitar usuario”.

3. ~~**Pantalla “Crear usuario” en el front**~~  
   - ✅ **Hecho:** Formulario en **Administración → Usuarios** (email, contraseña, rol) que llama a POST /auth/users con el JWT del admin. Visible solo con permiso `users:create`. Incluye opción “Generar contraseña temporal”.

4. ~~**Contraseña temporal**~~  
   - ✅ **Hecho:** Al crear usuario se puede marcar “Generar contraseña temporal”; el usuario recibe `mustChangePassword: true` y en el primer login se le abre obligatoriamente el diálogo “Cambiar contraseña”. PATCH /auth/me/password para cambiar la contraseña estando logueado.

5. **Cambiar mi contraseña (logueado)**  
   - ✅ **Hecho:** Cualquier usuario puede cambiar su propia contraseña desde el menú (“Cambiar contraseña” en el sidebar). Usa PATCH /auth/me/password (contraseña actual + nueva).

En producción puedes usar **bootstrap-admin** para el primer admin y, a partir de ahí, crear usuarios desde la pantalla Usuarios (crear con contraseña, crear con temporal, o invitar por enlace). Olvidé contraseña y cambiar contraseña están disponibles para todos los usuarios.
