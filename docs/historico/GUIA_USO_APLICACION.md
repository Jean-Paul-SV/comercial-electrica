# Guía de uso de la aplicación

> **Para quién:** Usuarios del negocio (administradores, vendedores, cajeros) que usan el sistema a diario.  
> **Objetivo:** Cómo realizar las tareas más habituales: entrar, vender, abrir caja, registrar gastos, gestionar productos y clientes, ver reportes.

---

## 1. Acceso

### Entrar a la aplicación

1. Abre la **URL** que te haya dado tu proveedor (ej. `https://app.tudominio.com`).
2. Escribe tu **correo electrónico** y tu **contraseña**.
3. Pulsa **Iniciar sesión**.

Si es la **primera vez** y te dieron una contraseña temporal, el sistema te pedirá **cambiarla** antes de continuar. Elige una contraseña nueva y guárdala.

### Olvidé mi contraseña

1. En la pantalla de login, haz clic en **Olvidé mi contraseña**.
2. Introduce tu **correo** y envía.
3. Revisa tu bandeja de entrada; recibirás un **enlace** (válido 1 hora) para restablecer la contraseña.
4. Abre el enlace y define la nueva contraseña.

---

## 2. Pantalla principal (Dashboard)

Tras iniciar sesión verás el **Dashboard**:

- **Resumen del día:** ventas, caja, indicadores según tu plan.
- **Sugerencias:** alertas o recomendaciones (productos con poco margen, stock bajo, etc.).
- **Accesos rápidos** a Ventas, Caja, Productos, Clientes, etc. según tu menú.

El **menú lateral** (sidebar) agrupa las secciones según tu rol y el plan de tu empresa. Si no ves alguna opción (ej. Inventario, Compras), es porque no está incluida en tu plan o no tienes permiso.

---

## 3. Operaciones del día a día

### Ventas

1. Menú **Operaciones → Ventas**.
2. Selecciona una **sesión de caja abierta** (si hay que registrar el pago en caja).
3. Opcional: selecciona un **cliente**.
4. Busca y agrega **productos** (por nombre o código), indica cantidades.
5. Revisa totales, descuentos si aplican, y pulsa **Registrar venta**.

La venta queda registrada y, si elegiste sesión de caja, el dinero se refleja en la caja.

### Caja

- **Abrir caja:** Menú **Operaciones → Caja**. Si no hay sesión abierta, pulsa **Abrir caja** e indica el monto inicial (ej. efectivo con el que empiezas).
- **Cerrar caja:** Al final del día (o turno), pulsa **Cerrar caja** e indica el monto con el que cierras. El sistema compara con lo esperado.
- **Movimientos:** Puedes ver movimientos de la sesión (ventas cobradas, gastos pagados, ajustes).

Solo puede haber **una sesión de caja abierta** a la vez. Las ventas que se cobran en efectivo suelen asociarse a esa sesión.

### Gastos

1. Menú **Operaciones → Gastos**.
2. Pulsa **Nuevo gasto** (o similar).
3. Indica **monto**, **descripción**, **categoría** (opcional), **forma de pago** y, si aplica, la **sesión de caja** si pagas de esa caja.
4. Guarda.

Los gastos sirven para control interno y para cuadrar la caja.

### Cotizaciones

1. Menú **Operaciones → Cotizaciones**.
2. **Nueva cotización:** agrega productos y cantidades, opcionalmente cliente y validez.
3. Guarda. Puedes **enviar** la cotización al cliente (según cómo esté configurado).
4. Cuando el cliente acepte, desde la misma cotización puedes **Convertir a venta** (o a factura si aplica).

### Devoluciones

1. Menú **Operaciones → Devoluciones**.
2. Selecciona la **venta** a devolver.
3. Indica **cantidades** a devolver por producto y el **motivo** si se pide.
4. Registra la devolución. El stock se actualiza si tienes el módulo de inventario.

---

## 4. Catálogo

### Productos

- **Ver y buscar:** Menú **Catálogo → Productos**. Lista de productos con código, nombre, precio, stock (si aplica).
- **Crear producto:** Botón **Nuevo** (o **Agregar producto**). Completa código interno, nombre, categoría, coste, precio, impuesto. Guarda.
- **Editar:** Desde la lista, abre el producto y modifica lo que necesites.

### Diccionario (búsqueda por términos)

Si usas el **Diccionario** (Catálogo → Diccionario), puedes asociar **términos o frases** (ej. “foco ahorrador”, “cable 2.5”) a un producto o categoría. Así, en ventas o búsquedas, al escribir ese término aparecerá el producto correcto.

### Clientes

- **Lista:** Menú **Catálogo → Clientes**. Busca por nombre o documento.
- **Nuevo cliente:** Tipo y número de documento, nombre, teléfono, email, dirección si aplica.
- **Editar:** Abre el cliente desde la lista y actualiza datos.

Los clientes se pueden elegir en **ventas** y **cotizaciones** para asociar la operación y, si aplica, facturar.

---

## 5. Inventario (si está en tu plan)

Menú **Inventario**:

- **Entradas:** Registrar ingreso de productos (compra, devolución de proveedor, ajuste).
- **Salidas:** Registrar salida (venta ya descontada, ajuste, merma).
- **Movimientos:** Ver historial de movimientos por producto o por fecha.

Cada movimiento pide tipo (entrada/salida/ajuste), productos y cantidades. El **stock** se actualiza al registrar el movimiento.

---

## 6. Compras (si está en tu plan y tienes permiso)

- **Proveedores:** Menú **Compras → Proveedores**. Alta y edición de proveedores (NIT, nombre, contacto, etc.).
- **Facturas proveedor:** Menú **Compras → Facturas proveedor**. Registrar facturas de compra (número, fechas, montos) y **pagos** (abonos). El sistema puede mostrar saldo pendiente por factura.

Suelen tener acceso los administradores o el personal de compras.

---

## 7. Facturas (ventas)

Menú **Operaciones → Facturas** (o **Facturas**):

- Listado de **facturas** emitidas (si usas facturación electrónica o interna).
- Acciones típicas: **ver**, **anular** (si está permitido). La anulación debe usarse con cuidado y según normativa.

---

## 8. Reportes y auditoría

- **Reportes:** Menú **Análisis → Reportes**. Según tu plan: ventas por período, clientes, productos, exportar a Excel, etc. Descarga o visualiza según lo disponible.
- **Auditoría:** Menú **Análisis → Auditoría**. Registro de acciones importantes (quién hizo qué y cuándo). Solo si tu plan incluye este módulo y tienes permiso.

---

## 9. Administración (solo con permiso)

### Usuarios

Menú **Administración → Usuarios** (solo para quien tenga permiso):

- **Ver** usuarios de tu empresa.
- **Crear usuario:** correo, nombre, contraseña (o “generar temporal”) y **rol** (Administrador o Usuario).
- **Invitar por correo:** en lugar de poner contraseña, se envía un enlace para que el invitado defina la suya.
- **Editar:** cambiar rol, activar o desactivar usuario, cambiar contraseña si aplica.

Los **roles** definen qué puede hacer cada usuario (ej. un “Usuario” puede vender y ver reportes; un “Administrador” además gestiona usuarios, caja y configuración).

### Backups

Menú **Administración → Backups** (si tienes permiso):

- **Crear backup:** genera una copia de los datos de tu empresa.
- **Descargar** o **verificar** backups existentes, según lo que ofrezca la pantalla.

---

## 10. Consejos rápidos

| Necesito… | Dónde |
|-----------|--------|
| Registrar una venta | Operaciones → Ventas |
| Abrir o cerrar caja | Operaciones → Caja |
| Registrar un gasto | Operaciones → Gastos |
| Crear una cotización | Operaciones → Cotizaciones |
| Dar de alta un producto | Catálogo → Productos |
| Dar de alta un cliente | Catálogo → Clientes |
| Que al buscar “X” salga un producto | Catálogo → Diccionario |
| Registrar entrada/salida de stock | Inventario |
| Ver o exportar ventas | Análisis → Reportes |
| Crear otro usuario | Administración → Usuarios |
| Cambiar mi contraseña | Menú de usuario (arriba) → Cambiar contraseña |

---

## 11. Si algo no funciona

- **No puedo entrar:** Comprueba correo y contraseña. Si sigue igual, usa **Olvidé mi contraseña** o pide a un administrador que te reinicie la contraseña o te reenvíe una invitación.
- **No veo una opción del menú:** Depende de tu **rol** y del **plan** de tu empresa. Un administrador puede asignarte otro rol o comprobar el plan.
- **Mensaje “Cuenta suspendida”:** La cuenta de tu empresa está suspendida. Contacta con soporte o facturación del proveedor.
- **Errores al guardar:** Revisa que todos los campos obligatorios estén completos. Si el error persiste, anota el mensaje y contacta a soporte.

Para **instalación técnica** o **configuración del servidor**, el proveedor usa documentación interna (ej. `GUIA_LEVANTAR_PROYECTO.md`). Esta guía es solo para **uso diario de la aplicación** por el personal del negocio.
