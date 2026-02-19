# Uso de datos para mejorar el producto

La plataforma registra **eventos de uso** exclusivamente para uso interno, con el fin de mejorar el software y la experiencia de los usuarios. **No se venden ni se comparten estos datos con terceros.**

## ¿Es legal?

**Sí.** Recopilar datos de uso para mejorar el producto es legal cuando se hace con **transparencia** y respetando la normativa de protección de datos (en Colombia, la **Ley 1581 de 2012** y el decreto reglamentario). Para que quede bien encuadrado en la ley:

1. **Informar** en la política de privacidad o en los términos de uso qué datos de uso se recopilan y con qué fin (mejora del producto y del servicio).
2. **Base legal:** el tratamiento puede apoyarse en la **ejecución del contrato** (dar y mejorar el servicio que el usuario contrata) y/o en el **interés legítimo** del responsable (mejorar el producto). No es necesario consentimiento adicional si se informa con claridad.
3. **Minimización:** solo se recogen datos necesarios para ese fin (secciones visitadas, tipo de acciones, sin datos personales sensibles en el payload).

Si incluyes en tu política/términos un párrafo claro como el de más abajo y mantienes el tratamiento limitado a lo descrito, estarás haciendo este uso **de forma legal**.

## Qué se registra

- **Pantallas visitadas** (`screen_view`): sección o ruta (ej. `sales`, `invoices`, `provider`) para saber qué módulos se usan más. Se limita a una vez por sección cada 60 segundos.
- **Acciones relevantes** (ej. `sale_created`): para medir uso de funciones y priorizar mejoras. El payload solo incluye datos no personales (ej. si la venta llevó factura electrónica).

Cada evento se guarda con:
- `tenantId` y `userId` (del JWT) para análisis agregado por empresa y por usuario.
- **No** se almacenan datos personales en el payload (nombres, NIT, correos, etc.).

## Dónde está implementado

- **API:** `POST /usage/events` (requiere JWT). Módulo `UsageModule`, modelo `UsageEvent` en Prisma.
- **Web:** hook `useTrackUsage()` y componente `UsageTracker` (envía `screen_view` al cambiar de ruta). Eventos explícitos como `sale_created` en las pantallas correspondientes.

## Consultar los datos

Los eventos están en la tabla `UsageEvent`. Puedes hacer consultas SQL o un panel interno (por ejemplo en el panel proveedor) para ver tendencias: eventos más frecuentes, secciones más visitadas, etc.

## Privacidad: texto para hacerlo legal

Para que el tratamiento sea **legal y transparente**, incluye en tu **política de privacidad** o en los **términos de uso** un apartado de “Datos de uso” o “Mejora del producto” con un texto como el siguiente (puedes adaptarlo al tono de tu documento):

---

**Datos de uso para mejora del producto**

Con el fin de mejorar el software y la experiencia de uso, recopilamos datos de uso de la plataforma de forma automática, tales como: secciones o pantallas que se visitan, y determinadas acciones realizadas en el sistema (por ejemplo, registro de ventas o uso de módulos). Estos datos se asocian de forma interna a su cuenta y empresa únicamente para análisis agregados; no incluimos en este tratamiento datos personales sensibles ni información que permita identificar a clientes o terceros.

Utilizamos esta información exclusivamente para uso interno: priorizar mejoras, detectar errores y optimizar el producto. **No vendemos ni compartimos estos datos con terceros.** El tratamiento se basa en la ejecución del contrato y en nuestro interés legítimo de ofrecer un mejor servicio, en cumplimiento de la normativa de protección de datos aplicable (Ley 1581 de 2012 en Colombia).

Si desea más información sobre el tratamiento de sus datos personales, puede consultar el resto de esta política de privacidad o contactarnos.

---

Con esto quedas informando de forma clara el qué, para qué y base legal, y el uso de datos para mejorar el producto queda **legalmente cubierto**.

Si en el futuro añades más eventos (ej. `invoice_issued`, `report_exported`), mantén el mismo criterio: `track('nombre_evento', { ... })` con payload sin datos personales (PII).
