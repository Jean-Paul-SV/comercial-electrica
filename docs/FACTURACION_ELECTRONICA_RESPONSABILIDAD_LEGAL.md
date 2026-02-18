# Facturación electrónica: responsabilidad legal (razón social y NIT)

## Contexto

En la aplicación, la **razón social** (`issuerName`) del emisor **solo se puede establecer al crear la empresa (tenant)** desde el Panel Proveedor. No es editable después por el cliente. El **NIT** sí se puede configurar y editar en Configuración → Facturación electrónica.

Estos datos se envían a la DIAN en el XML de la factura electrónica y aparecen en los documentos generados.

## Obligación legal (Colombia)

- La **razón social** y el **NIT** que figuren en las facturas electrónicas deben coincidir **exactamente** con los datos del contribuyente registrado ante:
  - La **DIAN** (registro tributario).
  - La **Cámara de Comercio** (para personas jurídicas).
- Usar una razón social o un NIT que no correspondan al contribuyente que emite la factura puede:
  - Invalidar las facturas ante la DIAN.
  - Generar responsabilidad tributaria y sanciones.
  - Constituir incumplimiento de la normativa de facturación electrónica.

## Responsabilidad del usuario

- Es **responsabilidad del cliente (tenant)** asegurarse de que la razón social y el NIT configurados en la aplicación sean los datos legales correctos.
- La plataforma solo almacena y transmite los datos que el usuario ingresa; no valida contra registros oficiales.
- Se recomienda que el proveedor, al crear el tenant, informe al cliente que debe verificar y mantener actualizados estos datos en Configuración → Facturación electrónica.

## Avisos en la aplicación

- La **razón social solo se define al crear la empresa** (Panel Proveedor). En Configuración → Facturación electrónica se muestra en solo lectura; para cambiarla el cliente debe contactar al administrador de la plataforma.
- En **Configuración → Facturación electrónica** (Datos del emisor) se muestra un aviso indicando que los datos deben coincidir con el registro ante la DIAN y la Cámara de Comercio.
- En el formulario de **Nueva empresa** (Panel Proveedor), el campo de razón social incluye una nota indicando que debe ser la razón social legal y que el cliente es responsable de que coincida con su registro tributario.

## Recomendaciones para el negocio

- Incluir en los términos de uso o contrato de servicio que el cliente es responsable de la veracidad de los datos de facturación.
- Opcional: en el futuro, validar o cruzar NIT/razón social con servicios de la DIAN si se dispone de integración autorizada.
