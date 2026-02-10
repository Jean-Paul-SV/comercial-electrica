# Runbook: Alta de cliente (tenant + primer administrador)

> **Objetivo:** Checklist interno para dar de alta una nueva empresa en la plataforma y entregar acceso al administrador.  
> **Quién:** Operaciones o persona designada (admin de plataforma).  
> **Referencia:** `SAAS_MODELO_NEGOCIO_Y_OPERACION.md` §2 y §9.

---

## 1. Antes del alta

| Paso | Acción | Notas |
|------|--------|--------|
| 1.1 | Tener cerrado el acuerdo comercial (plan, precio, add-ons si aplica). | Contrato, email de confirmación o CRM. |
| 1.2 | Confirmar datos del cliente: **nombre de la empresa**, **slug** (identificador único, ej. `mi-comercio`), **plan** a asignar. | Slug: solo minúsculas, números y guiones. Debe ser único. |
| 1.3 | Confirmar datos del **primer administrador**: email (único en la plataforma), nombre opcional. | El email no puede estar ya registrado. |
| 1.4 | Decidir cómo entregar el acceso: **contraseña temporal** (el sistema la genera y el admin la cambia en el primer login) o **enlace de activación** (si en el futuro se implementa “invitar admin” con token). | Recomendado: contraseña temporal para no enviar contraseñas en claro por correo. |

---

## 2. Alta en la plataforma

| Paso | Acción | Dónde |
|------|--------|--------|
| 2.1 | Iniciar sesión en la app con el **usuario de plataforma** (el creado con `POST /auth/bootstrap-admin` la primera vez). | Misma URL de la app que usan los clientes. |
| 2.2 | Ir a **Panel proveedor → Nueva empresa**. | Solo visible para el admin de plataforma. |
| 2.3 | Completar el formulario: **Nombre de la empresa**, **Slug**, **Plan** (selector), **Email del admin**, **Nombre del admin** (opcional), **Contraseña** (dejar vacío para generar temporal). | Si se deja contraseña vacía, el sistema genera una temporal y el admin deberá cambiarla en el primer login. |
| 2.4 | Pulsar **Crear empresa y admin**. | En desarrollo, si se generó contraseña temporal, se muestra en pantalla; guardarla de forma segura para el paso 3. |
| 2.5 | Verificar que la empresa aparece en **Panel proveedor → Empresas**. | Comprobar nombre, slug, plan y estado activa. |

---

## 3. Entrega de credenciales al cliente

| Paso | Acción | Buenas prácticas |
|------|--------|-------------------|
| 3.1 | Enviar al contacto del cliente (por el canal acordado): **URL de la aplicación**, **email del administrador** y **contraseña** (temporal o la que se haya definido). | No enviar contraseñas en claro por canales inseguros si es posible; preferir contraseña temporal + cambio obligatorio en primer login. |
| 3.2 | Indicar que en el **primer acceso** deberá cambiar la contraseña si el sistema lo solicita. | El sistema marca `mustChangePassword` cuando se genera temporal. |
| 3.3 | Opcional: adjuntar o enlazar una **guía de primer uso** (ej. cómo crear usuarios, hacer una venta, abrir caja). | Ver `docs/GUIA_USO_APLICACION.md` (guía de uso para el cliente final). |

---

## 4. Después del alta

| Paso | Acción |
|------|--------|
| 4.1 | Registrar en CRM o hoja de control: fecha de alta, tenant (slug), plan, email del admin. |
| 4.2 | Si el cliente reporta que no puede entrar: verificar que el tenant está **activo** (Panel proveedor → detalle de la empresa); que el email es correcto; que no hay bloqueo por contraseña (recordar cambiar en primer login). |

---

## 5. Incidencias frecuentes

| Situación | Qué hacer |
|-----------|-----------|
| **"El correo ya está registrado"** | Ese email pertenece a otro tenant o al admin de plataforma. Usar otro email para el admin de este cliente. |
| **"Ya existe un tenant con ese slug"** | Elegir otro slug (único en la plataforma). |
| **Cliente no ve ciertas secciones (ej. Inventario, Compras)** | Comprobar el **plan** asignado al tenant; esos módulos dependen del plan. En Panel proveedor → detalle → Cambiar plan si aplica. |
| **Cliente dejó de pagar / hay que suspender** | Panel proveedor → detalle de la empresa → **Suspender**. Los usuarios de ese tenant no podrán hacer login; los datos se conservan. Para reactivar: **Reactivar**. |
| **Perdí la contraseña temporal que se mostró** | No se puede recuperar (no se guarda en claro). Usar desde la app **Olvidé mi contraseña** con el email del admin, o crear un nuevo usuario admin desde otro admin del mismo tenant y luego desactivar el anterior si aplica. |

---

## 6. Resumen en una frase

**Alta:** Login como admin de plataforma → Panel proveedor → Nueva empresa → rellenar datos y crear → entregar al cliente URL, email y contraseña (o temporal) por canal acordado → registrar en CRM. **Suspensión:** Panel proveedor → detalle → Suspender; **Reactivación:** Reactivar.
