# Facturación y planes

Guía de cómo funcionan los planes, el cambio de plan y la facturación en la plataforma.

---

## 1. Tipos de plan

- **Plan sin DIAN:** Incluye ventas, inventario, clientes y (según el plan) reportes y backups. No incluye facturación electrónica a la DIAN; las facturas son solo documentos internos.
- **Plan con DIAN:** Incluye lo anterior más el módulo de facturación electrónica (certificado, NIT, numeración, envío a la DIAN).

En el **Panel proveedor → Planes** cada plan muestra la etiqueta **Con DIAN** o **Sin DIAN**. Al crear una empresa puedes asignar uno u otro plan.

---

## 2. Cambio de plan (desde la empresa)

Cuando un usuario de la empresa entra en **Configuración → Plan** y elige otro plan:

1. **Confirmación:** Antes de aplicar el cambio se muestra un modal que explica:
   - Se aplicará un **crédito** por la parte no usada del plan actual.
   - Se aplicará un **cargo prorrateado** por el nuevo plan hasta el fin del periodo.
   - El detalle exacto aparece en la próxima factura (o en "Gestionar método de pago y facturas").

2. **Efecto inmediato:** En cuanto se confirma, el plan en la app cambia al nuevo y el usuario tiene acceso a las nuevas funciones de inmediato.

3. **Facturación (Stripe):** Si la empresa paga con Stripe, la suscripción se actualiza al nuevo precio con prorrateo. Los importes (crédito y cargo) se generan al instante y se reflejan en la **próxima factura** (fecha de renovación). El cobro en la tarjeta ocurre en esa fecha.

---

## 3. Cambio de plan (desde el Panel proveedor)

En **Panel proveedor → Empresas → [empresa]**, el selector "Cambiar plan" actualiza el plan asignado a la empresa en la plataforma. Si la empresa paga con Stripe, el cargo prorrateado y la próxima factura se gestionan desde la **página de facturación del propio cliente** (Configuración → Plan); el cambio desde el panel solo actualiza qué plan tiene la empresa a nivel de módulos y límites.

---

## 4. Renovación y cobro

- **Si la empresa paga con Stripe:** El cobro recurrente se hace en la **fecha de la próxima factura** (Stripe cobra automáticamente al método de pago guardado). El usuario puede ver y gestionar pagos en **"Gestionar método de pago y facturas"** (portal de Stripe).
- **Botones "Renovar 30 días" / "Renovar 1 año" (Panel proveedor):** Extienden el periodo de la suscripción en la base de datos. Son útiles cuando cobras fuera de Stripe (por ejemplo transferencia o efectivo). Si la empresa paga con Stripe, el cobro real sigue siendo en la fecha de la próxima factura de Stripe.

---

## 5. Plan con DIAN pero sin configurar

Si la empresa tiene un **plan con DIAN** y aún no ha configurado certificado, NIT y numeración, en la página de **Configuración → Plan** se muestra un aviso:

> Tu plan incluye facturación electrónica (DIAN). Para emitir facturas a la DIAN, configura certificado, NIT y numeración en **Configuración de facturación electrónica**. Hasta entonces podrás usar documentos internos.

El enlace lleva a **Configuración → Facturación electrónica**, donde se completa la configuración DIAN.

---

## 6. Cómo saber que ya pasaste las pruebas DIAN

Cuando la empresa está en **ambiente de habilitación (pruebas)** y envías facturas de prueba a la DIAN:

1. **En la app (Ventas o Facturas):** Cada factura que tenga documento DIAN muestra un **estado**:
   - **En cola DIAN** / **Enviada a DIAN** → la DIAN aún no ha respondido o está en proceso.
   - **Emitida** (o badge verde) → la DIAN **aceptó** el documento. Eso significa que esa factura de prueba **pasó**.
   - **Rechazada por DIAN** (badge rojo) → la DIAN rechazó el documento; suele mostrar el mensaje de error. Hay que corregir datos (NIT, numeración, certificado, etc.) y volver a intentar.

2. **Que “ya pasaste” las pruebas:** Cuando **varias facturas de prueba** salen con estado **Emitida** (ACCEPTED), en la práctica la integración con la DIAN para ese contribuyente en habilitación está funcionando. No tienes que “pasar pruebas” cada vez que agregas un cliente: cada empresa hace sus pruebas **una vez** (con su propio Software ID y PIN en habilitación).

3. **Pasar a producción:** Cuando la DIAN dé por aprobado al contribuyente (según su proceso, a veces con resolución o notificación), en **Panel proveedor → Empresa → Configurar DIAN** (o Facturación electrónica) cambia el **ambiente** de esa empresa de **HABILITACION** a **PRODUCCION**. A partir de ahí las facturas son válidas legalmente.

---

## 7. Planes mensuales y anuales

Cada plan puede tener en Stripe dos precios:
- **Stripe Price ID (mensual):** cobro cada mes.
- **Stripe Price ID (anual):** cobro una vez al año.

En **Panel proveedor → Planes** puedes definir ambos en cada plan. Al **crear una empresa** o al **cambiar el plan** de una existente, si el plan tiene los dos Price IDs podrás elegir **Cobro mensual** o **Cobro anual**. La suscripción en Stripe se crea o actualiza con el precio correspondiente.

---

## 8. Resumen

| Acción | Dónde se ve el efecto |
|--------|------------------------|
| Cambiar de plan (usuario empresa) | Plan nuevo en la app: inmediato. Próxima factura: en la fecha de renovación. |
| Cambiar de plan (Panel proveedor) | Plan y módulos en la app: inmediato. Facturación Stripe: la gestiona el cliente en su página de facturación. |
| Cobro mensual vs anual | Definido por plan (dos Price IDs) y por empresa (campo Cobro). Al crear empresa o cambiar plan se usa el precio elegido. |
| Renovar (Panel proveedor) | Periodo extendido en la BD. Cobro real: según método (Stripe en fecha de factura, o manual). |
| Configurar DIAN | Plan con DIAN + configuración completa → puede emitir a la DIAN. Sin configurar → solo documentos internos. |

Para configurar Stripe (keys, webhooks, Price IDs), ver [CONFIGURAR_PAGOS_WOMPI_STRIPE.md](./CONFIGURAR_PAGOS_WOMPI_STRIPE.md).
