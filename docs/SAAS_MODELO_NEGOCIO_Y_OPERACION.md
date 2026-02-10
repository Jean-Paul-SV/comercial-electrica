# SaaS: modelo de negocio y operación en la realidad

**Enfoque:** arquitecto de software y consultor de producto SaaS empresarial.  
**Objetivo:** explicar cómo funciona el sistema una vez vendido, desde el modelo de negocio hasta la operación diaria, sin entrar en código.  
**Contexto:** sistema de gestión (inventario, ventas, usuarios y permisos) convertido en producto escalable para múltiples empresas.

---

## 1. Modelo de negocio del software

### Proveedor de plataforma, no entrega de código

- **Qué vendes:** acceso a una **plataforma alojada** (tu aplicación en la nube). El cliente **no recibe** código fuente ni instalables; **usa** el sistema vía navegador (y opcionalmente APIs) contra tu infraestructura.
- **Relación comercial:** suscripción recurrente (mensual o anual). El cliente paga por **uso continuado** del servicio; tú te encargas de hosting, actualizaciones, backups y soporte dentro del acuerdo.
- **Implicaciones:**
  - Una sola versión del producto para todos los clientes (multi-tenant).
  - Los datos de cada empresa viven en **tu** base de datos, aislados por **tenant** (organización).
  - Tú controlas versiones, parches y nuevas funcionalidades; el cliente no “instala” nada.
  - La facturación típica es por plan (y opcionalmente por add-ons o por número de usuarios), no por entrega única.

---

## 2. Flujo de adquisición del sistema por una empresa

### Desde que contratan hasta que usan

| Fase | Qué ocurre (en la práctica) |
|------|-----------------------------|
| **Venta / contrato** | Se cierra acuerdo (plan, precio, add-ons, número de usuarios si aplica). Puede ser manual (CRM, contrato) o integrado después con un portal de autoservicio. |
| **Alta en plataforma** | El **proveedor** (o un proceso automatizado) da de alta la **empresa (tenant)** en el sistema: nombre, identificador (slug), plan asignado. No hay “registro público” abierto; el alta la hace el operador o el flujo post-venta. |
| **Creación del primer usuario** | Se crea el **usuario administrador** de esa empresa (correo único, contraseña inicial). Ver sección 3. |
| **Entrega de credenciales** | Se entregan de forma segura (enlace de activación, correo, o canal acordado). El administrador recibe URL de la app, usuario y contraseña (o enlace para fijar contraseña). |
| **Primer acceso** | El admin entra, cambia la contraseña si es obligatorio, completa onboarding si lo tienes (configuración básica, datos de negocio). A partir de ahí la empresa gestiona sus propios usuarios. |

Todo el flujo debe estar documentado en un **runbook** o checklist interno: quién da de alta el tenant, quién crea al admin, cómo se envían las credenciales y qué hacer si hay incidencias.

---

## 3. Creación y entrega de usuarios y contraseñas iniciales

### 3.1 Creación de la empresa (tenant)

- En el sistema existe la entidad **Tenant** (empresa/organización). Cada cliente es un tenant.
- Al dar de alta un nuevo cliente se crea **un tenant**: nombre, slug (identificador único, p. ej. para subdominio o facturación), plan asignado, estado activo.
- El tenant es el “contenedor” de todos los datos de ese negocio: productos, ventas, usuarios, etc. Todo lo que hace la empresa queda asociado a ese tenant.

### 3.2 Creación del usuario administrador

- El **primer usuario** de ese tenant debe ser un **administrador** (rol que permite gestionar usuarios, configuración y permisos).
- Ese usuario se crea desde el **panel del proveedor** o con un flujo interno (API/script) que solo usa el equipo de operaciones. No se crea por “registro público”.
- Se define: **email** (único en toda la plataforma), **nombre** y **contraseña inicial**. La contraseña se trata como dato sensible: no se guarda en claro ni se muestra después (ver seguridad).

### 3.3 Entrega segura de credenciales

- **No enviar contraseñas en claro por correo** como práctica estándar. Opciones recomendadas:
  - **Enlace de activación / “establecer contraseña”:** se envía por email un enlace con token de un solo uso y caducidad (p. ej. 24–72 h). El admin abre el enlace y **define su contraseña** en ese momento. Así la contraseña nunca viaja por canal inseguro.
  - Si por acuerdo comercial se entrega contraseña temporal (canal seguro acordado), debe ser **temporal** y el sistema debe exigir **cambio en el primer acceso**.
- La **URL de la aplicación** (ej. `https://app.tudominio.com`) se comunica por el mismo canal o en la bienvenida. Todos los clientes entran por la misma URL; el sistema identifica la empresa por el usuario (cada usuario pertenece a un tenant).

### 3.4 Cambio obligatorio de contraseña

- El usuario recién creado puede tener el flag **“debe cambiar contraseña”** (p. ej. `mustChangePassword: true`).
- En el **primer inicio de sesión** (o al abrir la app), si ese flag está activo, la aplicación **no permite** usar el resto de la pantalla hasta que el usuario cambie la contraseña en un formulario dedicado.
- Tras el cambio, se actualiza la contraseña (hash) y se desactiva el flag. Es una buena práctica para cuentas creadas con contraseña temporal o entregada por canal no ideal.

---

## 4. Cómo la empresa gestiona sus propios usuarios internamente

- Una vez el **administrador** de la empresa tiene acceso, él (o otros usuarios con permiso de gestión de usuarios) puede:
  - **Crear usuarios:** correo, nombre, contraseña (o “generar temporal”) y **asignación de rol** (p. ej. Cajero, Vendedor, Contador, Admin).
  - **Editar usuarios:** cambiar rol, activar/desactivar cuenta, y en algunos casos nombre o email según tu diseño.
  - **Desactivar usuarios:** en lugar de borrarlos, se marcan como inactivos; así no pueden iniciar sesión pero se conserva el historial (ventas, auditoría) asociado a ese usuario.
- **Roles y permisos:**
  - Los **roles** (p. ej. Admin, Cajero, Vendedor) definen **qué puede hacer** cada tipo de usuario (crear ventas, ver reportes, gestionar inventario, etc.).
  - Los permisos se asignan a **roles**, no directamente a personas. Así se cambia qué puede hacer “todo los cajeros” editando el rol, sin tocar usuario por usuario.
  - La empresa solo gestiona **usuarios de su tenant**; no ve ni modifica usuarios de otras empresas ni del panel del proveedor.
- **Buenas prácticas:** ofrecer “invitación por correo” (enlace para aceptar y fijar contraseña) y “contraseña temporal” con cambio obligatorio en primer login, para no enviar contraseñas definitivas por correo.

---

## 5. Cómo el proveedor sabe quién está usando el producto

El **proveedor** (tú) necesita visibilidad sobre uso, salud y facturación. No con código de la app del cliente, sino con **datos de la plataforma**.

### 5.1 Empresas activas

- **Tenant** con estado **activo** = empresa que tiene derecho a usar el sistema (suscrita, no suspendida).
- Listado de tenants con: nombre, slug, plan, fecha de alta, estado (activo/suspendido), y opcionalmente fecha de última actividad.
- Así sabes **cuántas empresas** tienes y cuáles están “vivas” para facturación y soporte.

### 5.2 Usuarios activos

- Por cada tenant: **cuántos usuarios** tiene y cuántos están **activos** (cuenta habilitada, no desactivada).
- Útil para planes que limitan por número de usuarios o para detectar cuentas que no se usan (muchos usuarios inactivos).

### 5.3 Métricas básicas de uso

- **Por tenant:** número de inicios de sesión en un periodo, o de peticiones a la API asociadas a ese tenant (si tienes logs o métricas por tenant).
- **Por módulo/funcionalidad:** si tu producto tiene módulos (inventario, ventas, facturación electrónica, etc.), saber **qué tenants** tienen cada módulo activo (plan/add-ons) y, si es posible, **uso** (p. ej. facturas emitidas, movimientos de inventario). Esto sirve para soporte, mejora de producto y upselling.
- No hace falta instrumentar todo al inicio; un buen punto de partida es: tenants activos, usuarios activos por tenant, y **última actividad** por tenant o por usuario.

### 5.4 Última actividad

- **Por tenant:** fecha/hora del último evento relevante (último login de cualquier usuario del tenant, última venta, última petición autenticada, etc.). Se puede guardar en el propio tenant (`lastActivityAt`) o derivar de auditoría/logs.
- **Por usuario:** último login (o última acción). Ayuda a detectar cuentas abandonadas o a ofrecer “reactivar” antes de dar de baja.
- Con esto el proveedor puede ver “empresas sin uso en X días” o “usuarios que no entran desde hace meses” y decidir comunicaciones, suspensiones o bajas.

Para implementar esta visibilidad hace falta un **panel del proveedor** (o al menos reportes/consultas) que consulte estas entidades y métricas, con acceso restringido a tu equipo (no a los clientes).

---

## 6. Buenas prácticas de seguridad

| Práctica | Descripción |
|----------|-------------|
| **Hash de contraseñas** | Las contraseñas se almacenan solo como **hash** (con algoritmo adecuado, p. ej. bcrypt/argon2). Nunca en texto plano. Ni el proveedor ni los admins pueden “ver” la contraseña del usuario. |
| **No acceso a credenciales** | No hay pantalla ni API que devuelva la contraseña de un usuario. Los resets se hacen generando un **token de un solo uso** y enviando un enlace; el usuario define la nueva contraseña. |
| **Reseteo de contraseña** | Flujo “olvidé mi contraseña”: el usuario pide reset por email; se envía enlace con token limitado en tiempo; al abrirlo introduce la nueva contraseña. Rate limit por email para evitar abusos. |
| **Contraseñas temporales** | Si se entrega una contraseña temporal (por canal acordado), marcarla como “cambio obligatorio” en primer login. |
| **Roles y permisos** | La autorización (qué puede hacer cada usuario) se decide en **backend** según roles/permisos. El frontend oculta botones o rutas por experiencia, pero no sustituye la validación en servidor. |
| **Aislamiento por tenant** | Todas las consultas de datos (ventas, productos, usuarios) se filtran por **tenant** del usuario autenticado. Un usuario de la empresa A nunca puede ver ni modificar datos de la empresa B. |
| **Auditoría** | Registrar acciones sensibles (altas de usuario, cambios de rol, accesos, cambios en configuración) en un **registro de auditoría** (quién, qué, cuándo, tenant). Ayuda a soporte y cumplimiento. |

---

## 7. Qué ocurre si una empresa deja de pagar (suspensión sin pérdida de datos)

- **Objetivo:** dejar de dar acceso al servicio sin **borrar** los datos del cliente. Si más adelante regulariza, puede volver a entrar y encontrar su información.
- **Mecánica típica:**
  - El tenant tiene un campo de estado: **activo** vs **suspendido** (y opcionalmente “cancelado” o “baja definitiva”).
  - Cuando se detecta impago (proceso manual o integración con facturación), se cambia el estado del tenant a **suspendido**.
  - **Al intentar iniciar sesión**, cualquier usuario de ese tenant recibe un mensaje claro: “Cuenta suspendida. Contacte a soporte o facturación.” No se permite usar la aplicación.
  - **Datos:** no se borran. Productos, ventas, usuarios, configuración siguen en la base de datos asociados al tenant. Solo se bloquea el acceso.
  - **Reactivar:** cuando el cliente regulariza, se vuelve a poner el tenant en **activo**. Los usuarios pueden entrar de nuevo con las mismas credenciales (salvo que hayas definido caducidad de sesiones o de contraseñas).
- **Retención de datos:** puedes definir una política (p. ej. “datos de tenants suspendidos se conservan 12 meses; después se eliminan o se archivan”). Eso se documenta en términos de servicio y se implementa con procesos o jobs programados.

---

## 8. Entidades y módulos mínimos para operar como producto SaaS

Resumen de **conceptos** que el sistema debe tener para funcionar como SaaS multi-empresa de forma profesional. El proyecto incluye **Tenant**, **Plan**, **Subscription**, **User** con RBAC, API del proveedor y **última actividad** (lastActivityAt / lastLoginAt).

| Área | Entidades / conceptos | Nota |
|------|------------------------|------|
| **Multi-tenant** | **Tenant** (empresa), con nombre, slug, estado (activo/suspendido). Todos los datos de negocio (productos, ventas, usuarios, etc.) asociados al tenant. | Ya lo tienes. |
| **Suscripción / oferta** | **Plan** (qué incluye y a qué precio). **Suscripción** o vínculo explícito tenant–plan con fechas (inicio, fin, renovación) y estado (activa, suspendida, cancelada). Opcional: **Add-on** por módulo extra. | **Implementado:** modelo `Subscription` (tenantId, planId, status, currentPeriodStart/End). Se crea al dar de alta el tenant. |
| **Módulos por cliente** | Qué funcionalidades tiene cada tenant: por **plan** + **add-ons** + overrides (activar/desactivar módulo). Cálculo de “módulos habilitados” y validación en backend y frontend. | PlanFeature, TenantModule, TenantAddOn ya cubren el diseño. |
| **Usuarios y acceso** | **User** asociado a un **tenant**, con email único global, hash de contraseña, estado activo/inactivo, “debe cambiar contraseña”. **Roles** y **permisos** (RBAC) para que la empresa gestione quién puede hacer qué. | User, Role, Permission, UserRole ya están. **Implementado:** `User.lastLoginAt` para última actividad por usuario. |
| **Panel del proveedor** | Aplicación o zona restringida (solo tu equipo) para: listar y dar de alta **tenants**, crear el primer **usuario admin** por tenant, ver **empresas activas**, **usuarios por tenant**, **métricas de uso** y **última actividad**, y cambiar estado (activo/suspendido). No es la app que usa el cliente; es la “consola de operaciones”. | **Implementado:** API bajo `/provider` (solo usuarios con `tenantId === null`, p. ej. el admin creado con bootstrap). Ver sección 9. |
| **Visibilidad de uso** | **Última actividad** por tenant (y opcionalmente por usuario): último login o último evento. Métricas agregadas (logins, uso por módulo) si quieres ir más allá. **Auditoría** (AuditLog) para trazabilidad. | **Implementado:** `Tenant.lastActivityAt` y `User.lastLoginAt`; se actualizan en cada login. AuditLog existe. |

En conjunto:

- **Empresa (Tenant)** + **Suscripción** (o al menos plan y estado activo/suspendido) definen **quién** tiene derecho a usar el producto.
- **Usuarios** y **roles/permisos** definen **quién** dentro de la empresa hace qué, y se gestionan por la propia empresa (admin).
- **Panel del proveedor** y **métricas/última actividad** definen **cómo** tú sabes quién usa el producto y cómo operar altas, bajas y suspensiones.

---

## 9. Implementación actual (referencia técnica)

Resumen de lo implementado para operar como SaaS y panel del proveedor.

### Migración de base de datos

- **Migración:** `20260208100000_add_subscription_and_activity_tracking`
- **Cambios:** enum `SubscriptionStatus` (ACTIVE, SUSPENDED, CANCELLED); tabla `Subscription` (tenantId, planId, status, currentPeriodStart/End); en `Tenant` campo `lastActivityAt`; en `User` campo `lastLoginAt`.
- **Aplicar:** desde `apps/api`: `npx prisma migrate deploy` (producción) o `npx prisma migrate dev` (desarrollo).

### Login y suspensión

- En cada **login** se actualizan `User.lastLoginAt` y, si el usuario tiene tenant, `Tenant.lastActivityAt`.
- Si el **tenant está suspendido** (`isActive: false`), el login devuelve error: *"Cuenta suspendida. Contacte a soporte o facturación."*

### API del panel del proveedor (`/provider`)

Solo pueden acceder usuarios **sin tenant** (administradores de plataforma), por ejemplo el usuario creado con `POST /auth/bootstrap-admin` la primera vez.

| Método y ruta | Descripción |
|---------------|-------------|
| **GET /provider/plans** | Lista planes activos (id, name, slug, description, priceMonthly, priceYearly). Para selector al crear/actualizar tenant. |
| **GET /provider/tenants** | Lista tenants paginada. Query: `limit`, `offset`, `isActive` (true/false). Respuesta: items con id, name, slug, isActive, lastActivityAt, plan, subscription, usersCount. |
| **GET /provider/tenants/:id** | Detalle de un tenant: datos básicos, plan, subscription, conteos (users, products, sales, customers). |
| **PATCH /provider/tenants/:id/status** | Body: `{ "isActive": true \| false }`. Suspender o reactivar el tenant. |
| **PATCH /provider/tenants/:id** | Body: `{ "planId": "uuid" \| null }` (opcional). Actualiza el plan del tenant y de su suscripción; si no tenía suscripción, se crea con periodo 30 días. |
| **PATCH /provider/tenants/:id/subscription/renew** | Body: `{ "extendDays": 30 }` (opcional, default 30). Prorroga el periodo de la suscripción (currentPeriodEnd). |
| **POST /provider/tenants** | Crear tenant y primer usuario administrador. Se crea suscripción con currentPeriodStart = ahora, currentPeriodEnd = ahora + 30 días. Body: name, slug, planId (opcional), adminEmail, adminName (opcional), adminPassword (opcional). Si no se envía adminPassword se genera contraseña temporal y el admin debe cambiarla en el primer login. En desarrollo se devuelve `tempAdminPassword` en la respuesta. |

**Flujo recomendado de alta de cliente:**  
1) Hacer login con el usuario de plataforma (bootstrap).  
2) En la app web: ir a **Panel proveedor → Nueva empresa** (o `POST /provider/tenants` con datos del cliente y del admin).  
3) Entregar al cliente la URL de la app, el email del admin y la contraseña (o enlace “establecer contraseña” si se usó temporal).  
4) En la misma app, la sección **Panel proveedor** (visible solo para el admin de plataforma) permite listar empresas, ver detalle, suspender/reactivar, cambiar plan, **renovar suscripción** (botón “Renovar 30 días”) y crear nueva empresa + primer admin. **Runbook:** `docs/RUNBOOK_ALTA_CLIENTE.md`. **Retención de datos de tenants suspendidos:** `docs/POLITICA_RETENCION_TENANTS_SUSPENDIDOS.md`.

Con esto tienes una base técnico-empresarial clara para vender y operar el software como SaaS a múltiples empresas de forma profesional y escalable.
